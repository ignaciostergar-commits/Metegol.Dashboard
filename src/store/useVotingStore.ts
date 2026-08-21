import { create } from "zustand";
import {
  doc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
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

  castVote: async (captainId, subcaptainId) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("not-authenticated");
    if (!captainId || !subcaptainId || captainId === subcaptainId) {
      throw new Error("invalid-choice");
    }
    const voteRef = doc(db, "votes", user.uid);

    await runTransaction(db, async (tx) => {
      const existing = await tx.get(voteRef);
      if (existing.exists()) {
        throw new Error("already-voted");
      }
      tx.set(voteRef, { captainId, subcaptainId, votedAt: serverTimestamp() });
    });

    // Los contadores agregados se incrementan aparte (fuera de la
    // transacción de arriba, que ya garantizó el "una sola vez") usando
    // increment() atómico: así nunca hace falta leer el total actual, y
    // nadie que mire la lectura de este documento puede reconstruir a
    // quién votó cada usuario a partir de esta escritura.
    await updateDoc(RESULTS_DOC, {
      [`captainCounts.${captainId}`]: increment(1),
      [`subcaptainCounts.${subcaptainId}`]: increment(1),
    });
    await updateDoc(PARTICIPATION_DOC, { votedCount: increment(1) });
  },
}));

// Estado de la votación (abierta/cerrada) y resultados agregados: mismo
// patrón que useContractStore/useTeamStore. Antes estos dos listeners se
// registraban una sola vez al cargar el módulo, ANTES de que Firebase Auth
// terminara de resolver la sesión; si esa primera conexión perdía la
// carrera contra la resolución de auth, Firestore la rechazaba y el
// listener quedaba muerto para siempre (el usuario no se enteraba cuando
// el admin abre/cierra la votación, ni veía los resultados actualizados
// al cerrarse). Se envuelven en funciones re-suscribibles que se vuelven a
// registrar cada vez que cambia el usuario logueado.
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

let unsubResultsDoc: (() => void) | null = null;

function subscribeResultsDoc() {
  if (unsubResultsDoc) {
    unsubResultsDoc();
    unsubResultsDoc = null;
  }
  unsubResultsDoc = onSnapshot(
    RESULTS_DOC,
    (snap) => {
      // Si la votación está abierta, las reglas de Firestore directamente
      // rechazan esta lectura (permission-denied) y caemos al error callback
      // de más abajo: por eso results queda en null mientras está abierta,
      // sin que el cliente llegue a recibir conteos parciales.
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
    () => useVotingStore.setState({ results: null })
  );
}

subscribeStatusDoc();
subscribeResultsDoc();

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

let lastUid: string | null = null;
let lastIsAdmin = false;
useAuthStore.subscribe((state) => {
  const uid = state.user?.uid ?? null;
  const isAdmin = state.user?.role === "admin";
  if (uid !== lastUid) {
    lastUid = uid;
    subscribeMyVote(uid);
    // status/results no dependen del rol, solo de tener una sesión de auth
    // válida: se re-arman en cada cambio de uid (login/logout/otro usuario)
    // para no quedar nunca pegados a una conexión que perdió la carrera
    // contra la resolución de Firebase Auth.
    subscribeStatusDoc();
    subscribeResultsDoc();
  }
  if (isAdmin !== lastIsAdmin) {
    lastIsAdmin = isAdmin;
    subscribeParticipation(isAdmin);
  }
});
