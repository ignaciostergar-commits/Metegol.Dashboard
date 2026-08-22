import { create } from "zustand";
import {
  doc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import type { Vote, VoteResults, VotingParticipation, VotingStatus } from "@/types/player";

const STATUS_DOC = doc(db, "votingStatus", "main");
const PARTICIPATION_DOC = doc(db, "votingParticipation", "main");
const RESULTS_DOC = doc(db, "voteResults", "main");

interface VotingStore {
  status: VotingStatus;
  statusLoaded: boolean;

  // Solo se completa para el admin (las reglas bloquean la lectura a
  // cualquier otro usuario): cuántos ya votaron, nunca a quién.
  participation: VotingParticipation | null;

  // Solo llega con datos una vez que la votación está cerrada (así lo
  // hacen cumplir las reglas de Firestore).
  results: VoteResults | null;

  // Voto propio: null si todavía no votó. Nadie más puede leer este dato.
  myVote: Vote | null;
  myVoteLoaded: boolean;

  openVoting: () => Promise<void>;
  closeVoting: () => Promise<void>;
  castVote: (captainId: string, subcaptainId: string) => Promise<void>;
}

export const useVotingStore = create<VotingStore>(() => ({
  status: { open: false, closedAt: null },
  statusLoaded: false,
  participation: null,
  results: null,
  myVote: null,
  myVoteLoaded: false,

  openVoting: async () => {
    await setDoc(STATUS_DOC, { open: true, closedAt: null });
    await setDoc(PARTICIPATION_DOC, { votedCount: 0 });
    await setDoc(RESULTS_DOC, { captainCounts: {}, subcaptainCounts: {} });
  },

  closeVoting: async () => {
    await setDoc(STATUS_DOC, { open: false, closedAt: Date.now() }, { merge: true });
  },

  // FIX B: las tres escrituras (conteos agregados, participación y el
  // voto individual) corren dentro de UNA sola transacción -ya no hay
  // updateDoc() sueltos después de crear votes/{uid}-, así que o se
  // aplican las tres o ninguna.
  //
  // Orden interno DENTRO de la transacción (importante, no es arbitrario):
  // los incrementos de voteResults/main y votingParticipation/main van
  // ANTES del set() de votes/{uid}. Esto es al revés de "primero registro
  // el voto, después sumo los contadores" porque las reglas de Firestore
  // para esos dos documentos exigen !exists(votes/{uid}) ("todavía no
  // votó"). Dentro de una misma transacción, cada escritura se evalúa
  // contra el estado que dejaron las escrituras ANTERIORES de esa misma
  // transacción: si votes/{uid} se creara primero, los incrementos
  // siguientes verían el voto como ya existente y la regla los
  // rechazaría en silencio (esto era exactamente lo que pasaba: el voto
  // quedaba registrado pero voteResults/main nunca se actualizaba). Con
  // los incrementos primero y el voto al final, todo queda autorizado y
  // sigue siendo 100% atómico: si cualquier paso falla, la transacción
  // entera se descarta y no se aplica ninguno.
  castVote: async (captainId, subcaptainId) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("not-authenticated");
    if (!captainId || !subcaptainId || captainId === subcaptainId) {
      throw new Error("invalid-choice");
    }
    const voteRef = doc(db, "votes", user.uid);

    await runTransaction(db, async (tx) => {
      // 1. Leer votes/{uid}.
      const existing = await tx.get(voteRef);
      // 2. Si ya existe, se lanza already-voted (nada se escribe).
      if (existing.exists()) {
        throw new Error("already-voted");
      }

      // 4. Incrementar el contador del capitán elegido.
      // 5. Incrementar el contador del subcapitán elegido.
      tx.update(RESULTS_DOC, {
        [`captainCounts.${captainId}`]: increment(1),
        [`subcaptainCounts.${subcaptainId}`]: increment(1),
      });

      // 6. Incrementar votingParticipation/main.votedCount.
      tx.update(PARTICIPATION_DOC, { votedCount: increment(1) });

      // 3. Crear votes/{uid} (al final, ver nota de orden arriba).
      tx.set(voteRef, { captainId, subcaptainId, votedAt: serverTimestamp() });
    });
  },
}));

// STATUS_DOC: se re-suscribe con cada cambio de usuario logueado, igual
// que el resto de los stores (contrato, equipo, historial). Antes se
// registraba una sola vez al cargar el módulo, ANTES de que Firebase Auth
// resolviera la sesión; si esa primera conexión perdía esa carrera,
// Firestore la rechazaba y el listener quedaba muerto para siempre.
let unsubStatusDoc: (() => void) | null = null;

function subscribeStatusDoc() {
  if (unsubStatusDoc) {
    unsubStatusDoc();
    unsubStatusDoc = null;
  }
  unsubStatusDoc = onSnapshot(
    STATUS_DOC,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        useVotingStore.setState({
          status: {
            open: data.open === true,
            closedAt: typeof data.closedAt === "number" ? data.closedAt : null,
          },
          statusLoaded: true,
        });
      } else {
        useVotingStore.setState({ status: { open: false, closedAt: null }, statusLoaded: true });
      }
    },
    () => useVotingStore.setState({ statusLoaded: true })
  );
}

// FIX A: RESULTS_DOC.
//
// La regla de lectura de voteResults/main es:
//   allow read: if isSignedIn() && !isVotingOpen();
// Mientras la votación está abierta, cualquier listener activo sobre este
// documento queda sin permiso: Firestore lo corta con permission-denied y
// el listener se apaga solo -no se reintenta-. Por eso "results" se maneja
// así:
//   - Login: se crea la suscripción (ver bloque de useAuthStore.subscribe
//     más abajo, igual que STATUS_DOC).
//   - Logout: subscribeResultsDoc() primero desuscribe la anterior; al no
//     haber uid, no hace falta una activa, y results ya había quedado en
//     null la última vez que la regla lo rechazó.
//   - Cambio de usuario: mismo bloque de abajo, se desuscribe la vieja y
//     se crea una nueva para el nuevo uid.
//   - Mientras la votación está abierta: el callback de error de
//     onSnapshot pone results en null (sin tirar ninguna excepción visible
//     para el usuario; onSnapshot nunca deja de "andar" por esto, solo dejó
//     de recibir datos).
//   - Al cerrarse la votación: como este mismo módulo escucha sus propios
//     cambios de status.open (ver el useVotingStore.subscribe de abajo),
//     apenas STATUS_DOC informa que se cerró, se vuelve a llamar
//     subscribeResultsDoc() con una conexión nueva, que esta vez sí tiene
//     permiso y trae los resultados reales.
let unsubResultsDoc: (() => void) | null = null;

function subscribeResultsDoc() {
  if (unsubResultsDoc) {
    unsubResultsDoc();
    unsubResultsDoc = null;
  }
  unsubResultsDoc = onSnapshot(
    RESULTS_DOC,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        useVotingStore.setState({
          results: {
            captainCounts: (data.captainCounts as Record<string, number>) ?? {},
            subcaptainCounts: (data.subcaptainCounts as Record<string, number>) ?? {},
          },
        });
      } else {
        useVotingStore.setState({ results: null });
      }
    },
    () => {
      // Lectura rechazada (votación abierta) o sin conexión: results
      // queda en null. No se propaga ningún error a la UI.
      useVotingStore.setState({ results: null });
    }
  );
}

subscribeStatusDoc();
subscribeResultsDoc();

// Cada vez que cambia status.open (abrir O cerrar) nos volvemos a
// suscribir a RESULTS_DOC con una conexión nueva, para no quedar nunca
// pegados a un listener que perdió el permiso de lectura al abrirse la
// votación y no lo recupera solo al cerrarse.
let lastVotingOpen = useVotingStore.getState().status.open;
useVotingStore.subscribe((state) => {
  if (state.status.open !== lastVotingOpen) {
    lastVotingOpen = state.status.open;
    subscribeResultsDoc();
  }
});

// Participación (X de Y): la lectura de este doc está limitada a admin por
// firestore.rules, así que a un jugador esta suscripción le falla en
// silencio y participation queda en null.
let unsubParticipation: (() => void) | null = null;

function subscribeParticipation(isAdmin: boolean) {
  if (unsubParticipation) {
    unsubParticipation();
    unsubParticipation = null;
  }
  if (!isAdmin) {
    useVotingStore.setState({ participation: null });
    return;
  }
  unsubParticipation = onSnapshot(
    PARTICIPATION_DOC,
    (snap) => {
      useVotingStore.setState({
        participation: snap.exists()
          ? { votedCount: (snap.data().votedCount as number) ?? 0 }
          : { votedCount: 0 },
      });
    },
    () => useVotingStore.setState({ participation: null })
  );
}

// Voto propio: se re-suscribe con cada cambio de usuario logueado.
let unsubMyVote: (() => void) | null = null;

function subscribeMyVote(uid: string | null) {
  if (unsubMyVote) {
    unsubMyVote();
    unsubMyVote = null;
  }
  if (!uid) {
    useVotingStore.setState({ myVote: null, myVoteLoaded: true });
    return;
  }
  useVotingStore.setState({ myVoteLoaded: false });
  unsubMyVote = onSnapshot(
    doc(db, "votes", uid),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const votedAt = data.votedAt as Timestamp | undefined;
        useVotingStore.setState({
          myVote: {
            captainId: data.captainId as string,
            subcaptainId: data.subcaptainId as string,
            votedAtMs: votedAt ? votedAt.toMillis() : null,
          },
          myVoteLoaded: true,
        });
      } else {
        useVotingStore.setState({ myVote: null, myVoteLoaded: true });
      }
    },
    () => useVotingStore.setState({ myVote: null, myVoteLoaded: true })
  );
}

// FIX A (login/logout/cambio de usuario): mismo bloque que ya cubría
// STATUS_DOC y myVote, ahora también dispara subscribeResultsDoc() en
// cada cambio de uid.
let lastUid: string | null = null;
let lastIsAdmin = false;
useAuthStore.subscribe((state) => {
  const uid = state.user?.uid ?? null;
  const isAdmin = state.user?.role === "admin";
  if (uid !== lastUid) {
    lastUid = uid;
    subscribeMyVote(uid);
    subscribeStatusDoc();
    subscribeResultsDoc();
  }
  if (isAdmin !== lastIsAdmin) {
    lastIsAdmin = isAdmin;
    subscribeParticipation(isAdmin);
  }
});
