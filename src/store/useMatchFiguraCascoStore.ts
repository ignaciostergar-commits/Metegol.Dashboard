import { create } from "zustand";
import {
  doc,
  getDoc,
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
import type { MatchVote, MatchVoteParticipation, MatchVoteStatus, MatchVoteType } from "@/types/match";

// ---- Figura y Casco por fecha (Fase 2, Bloque 3) ----
//
// Mismo patrón de useFiguraCascoVotingStore.ts (la versión global, sin
// tocar), namespaced bajo matches/{matchId}. "type" (figura|casco)
// selecciona una familia de documentos completamente separada de la otra.
//
// Capitán/Subcapitán no pasa por acá. La versión global de Figura/Casco
// tampoco -sigue siendo una ronda independiente de toda la temporada, sin
// relación con las fechas.
//
// Suscripción bajo demanda: solo la fecha que el admin/jugador tiene
// abierta en pantalla (activeMatchId) mantiene listeners activos, para no
// escuchar figura/casco de todas las fechas históricas a la vez. matchId
// no se toma de ningún estado global compartido: cada acción de abajo
// recibe el matchId explícito de quien la invoca (ver FiguraCascoFecha.tsx,
// que lo captura del render de la fecha seleccionada), así que una
// operación sobre la Fecha 7 nunca puede terminar afectando a la Fecha 8.

function matchRef(matchId: string) {
  return doc(db, "matches", matchId);
}
function statusRef(matchId: string, type: MatchVoteType) {
  return doc(db, "matches", matchId, `${type}Status`, "main");
}
function participationRef(matchId: string, type: MatchVoteType) {
  return doc(db, "matches", matchId, `${type}Participation`, "main");
}
function resultsRef(matchId: string, type: MatchVoteType) {
  return doc(db, "matches", matchId, `${type}VoteResults`, "main");
}
function voteRef(matchId: string, type: MatchVoteType, uid: string) {
  return doc(db, "matches", matchId, `${type}Votes`, uid);
}

interface MatchFiguraCascoStore {
  activeMatchId: string | null;
  setActiveMatch: (matchId: string | null) => void;

  figuraStatus: MatchVoteStatus;
  figuraStatusLoaded: boolean;
  figuraParticipation: MatchVoteParticipation | null;
  myFiguraVote: MatchVote | null;
  myFiguraVoteLoaded: boolean;

  cascoStatus: MatchVoteStatus;
  cascoStatusLoaded: boolean;
  cascoParticipation: MatchVoteParticipation | null;
  myCascoVote: MatchVote | null;
  myCascoVoteLoaded: boolean;

  openVoting: (matchId: string, type: MatchVoteType) => Promise<void>;
  closeVoting: (matchId: string, type: MatchVoteType) => Promise<void>;
  castVote: (
    matchId: string,
    type: MatchVoteType,
    twoVotesPlayerId: string,
    oneVotePlayerId: string
  ) => Promise<void>;
}

// Gana quien tenga más votos; si dos o más jugadores empatan en el máximo,
// TODOS quedan como ganadores (comparten el premio) -no hay desempate, ni
// automático ni manual. Misma lógica pura ya probada en
// useFiguraCascoVotingStore.ts (la versión global); se duplica acá -6
// líneas, sin ninguna dependencia de Firestore- a propósito, para no tener
// que tocar ese archivo ni siquiera para exportar una función.
function computeWinnerIds(counts: Record<string, number>): string[] {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) return [];
  const max = Math.max(...entries.map(([, count]) => count));
  return entries.filter(([, count]) => count === max).map(([id]) => id);
}

const EMPTY_STATUS: MatchVoteStatus = { open: false, closedAtMs: null };

export const useMatchFiguraCascoStore = create<MatchFiguraCascoStore>(() => ({
  activeMatchId: null,

  figuraStatus: EMPTY_STATUS,
  figuraStatusLoaded: false,
  figuraParticipation: null,
  myFiguraVote: null,
  myFiguraVoteLoaded: false,

  cascoStatus: EMPTY_STATUS,
  cascoStatusLoaded: false,
  cascoParticipation: null,
  myCascoVote: null,
  myCascoVoteLoaded: false,

  setActiveMatch: (matchId) => {
    useMatchFiguraCascoStore.setState({ activeMatchId: matchId });
    const user = useAuthStore.getState().user;
    subscribeActiveMatch(matchId, user?.uid ?? null, user?.role === "admin");
  },

  // Protección: si <type>Status/main YA existe (esta votación ya se abrió
  // alguna vez para esta fecha -esté actualmente abierta, o ya cerrada con
  // resultado-), se rechaza sin tocar nada. Evita que una segunda ejecución
  // accidental (doble click, volver a apretar "Abrir" más tarde) resetee
  // counts/votedCount/winnerIds de una ronda que ya tiene votos o
  // resultado. Un solo admin en este sistema, sin necesidad de
  // transacción: un getDoc + un if alcanza.
  openVoting: async (matchId, type) => {
    const matchSnap = await getDoc(matchRef(matchId));
    if (matchSnap.data()?.status !== "open") {
      throw new Error("match-closed");
    }

    const statusSnap = await getDoc(statusRef(matchId, type));
    if (statusSnap.exists()) {
      throw new Error("voting-already-started");
    }

    await setDoc(statusRef(matchId, type), { open: true, closedAt: null });
    await setDoc(participationRef(matchId, type), { votedCount: 0 });
    await setDoc(resultsRef(matchId, type), { counts: {} });
    await updateDoc(matchRef(matchId), { [`${type}Open`]: true, [`${type}WinnerIds`]: [] });
  },

  // Una sola transacción atómica: lee los resultados, calcula el/los
  // ganador(es), y escribe el cierre del status Y los winnerIds en el
  // documento padre en el MISMO commit. O se aplican las dos escrituras
  // juntas, o no se aplica ninguna -no puede quedar una votación cerrada
  // sin resultado por una falla a mitad de camino; reintentar el cierre es
  // seguro (se vuelve a correr la misma transacción desde cero). Como los
  // conteos quedan congelados apenas <type>Status/main.open pasa a false
  // (ningún voto nuevo puede entrar), recalcular contra el mismo resultado
  // congelado siempre da el mismo ganador, sin importar cuántas veces se
  // reintente o si dos llamadas llegan a superponerse.
  closeVoting: async (matchId, type) => {
    const status = statusRef(matchId, type);
    const results = resultsRef(matchId, type);
    const match = matchRef(matchId);

    await runTransaction(db, async (tx) => {
      const resultsSnap = await tx.get(results);
      const counts = (resultsSnap.data()?.counts as Record<string, number>) ?? {};
      const winnerIds = computeWinnerIds(counts);

      tx.set(status, { open: false, closedAt: Date.now() }, { merge: true });
      tx.update(match, { [`${type}Open`]: false, [`${type}WinnerIds`]: winnerIds });
    });
  },

  // Transacción atómica, mismo orden ya probado en useFiguraCascoVotingStore
  // (FIX B de Capitán): los increment() de resultados y participación van
  // ANTES del set() del voto individual, porque la regla de "todavía no
  // votó" depende de que <type>Votes/{uid} no exista todavía al momento en
  // que Firestore evalúa esas reglas.
  castVote: async (matchId, type, twoVotesPlayerId, oneVotePlayerId) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("not-authenticated");
    if (!twoVotesPlayerId || !oneVotePlayerId || twoVotesPlayerId === oneVotePlayerId) {
      throw new Error("invalid-choice");
    }
    const ref = voteRef(matchId, type, user.uid);
    const results = resultsRef(matchId, type);
    const participation = participationRef(matchId, type);

    await runTransaction(db, async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists()) {
        throw new Error("already-voted");
      }

      tx.update(results, {
        [`counts.${twoVotesPlayerId}`]: increment(2),
        [`counts.${oneVotePlayerId}`]: increment(1),
      });
      tx.update(participation, { votedCount: increment(1) });
      tx.set(ref, { twoVotesPlayerId, oneVotePlayerId, votedAt: serverTimestamp() });
    });
  },
}));

// ---- Suscripciones bajo demanda de la fecha activa ----
let unsubFiguraStatus: (() => void) | null = null;
let unsubCascoStatus: (() => void) | null = null;
let unsubFiguraParticipation: (() => void) | null = null;
let unsubCascoParticipation: (() => void) | null = null;
let unsubMyFiguraVote: (() => void) | null = null;
let unsubMyCascoVote: (() => void) | null = null;

function teardownActiveMatchSubscriptions() {
  unsubFiguraStatus?.();
  unsubCascoStatus?.();
  unsubFiguraParticipation?.();
  unsubCascoParticipation?.();
  unsubMyFiguraVote?.();
  unsubMyCascoVote?.();
  unsubFiguraStatus = null;
  unsubCascoStatus = null;
  unsubFiguraParticipation = null;
  unsubCascoParticipation = null;
  unsubMyFiguraVote = null;
  unsubMyCascoVote = null;
}

function subscribeStatus(matchId: string, type: MatchVoteType) {
  const key = type === "figura" ? "figuraStatus" : "cascoStatus";
  const loadedKey = type === "figura" ? "figuraStatusLoaded" : "cascoStatusLoaded";
  return onSnapshot(
    statusRef(matchId, type),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        useMatchFiguraCascoStore.setState({
          [key]: {
            open: data.open === true,
            closedAtMs: typeof data.closedAt === "number" ? data.closedAt : null,
          },
          [loadedKey]: true,
        } as Partial<MatchFiguraCascoStore>);
      } else {
        useMatchFiguraCascoStore.setState({
          [key]: { open: false, closedAtMs: null },
          [loadedKey]: true,
        } as Partial<MatchFiguraCascoStore>);
      }
    },
    () => {
      useMatchFiguraCascoStore.setState({
        [key]: { open: false, closedAtMs: null },
        [loadedKey]: true,
      } as Partial<MatchFiguraCascoStore>);
    }
  );
}

function subscribeParticipation(matchId: string, type: MatchVoteType, isAdmin: boolean) {
  const key = type === "figura" ? "figuraParticipation" : "cascoParticipation";
  if (!isAdmin) {
    useMatchFiguraCascoStore.setState({ [key]: null } as Partial<MatchFiguraCascoStore>);
    return null;
  }
  return onSnapshot(
    participationRef(matchId, type),
    (snap) => {
      useMatchFiguraCascoStore.setState({
        [key]: { votedCount: snap.exists() ? ((snap.data().votedCount as number) ?? 0) : 0 },
      } as Partial<MatchFiguraCascoStore>);
    },
    () => useMatchFiguraCascoStore.setState({ [key]: null } as Partial<MatchFiguraCascoStore>)
  );
}

function subscribeMyVote(matchId: string, type: MatchVoteType, uid: string | null) {
  const voteKey = type === "figura" ? "myFiguraVote" : "myCascoVote";
  const loadedKey = type === "figura" ? "myFiguraVoteLoaded" : "myCascoVoteLoaded";

  if (!uid) {
    useMatchFiguraCascoStore.setState({
      [voteKey]: null,
      [loadedKey]: true,
    } as Partial<MatchFiguraCascoStore>);
    return null;
  }

  useMatchFiguraCascoStore.setState({ [loadedKey]: false } as Partial<MatchFiguraCascoStore>);
  return onSnapshot(
    voteRef(matchId, type, uid),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const votedAt = data.votedAt as Timestamp | undefined;
        useMatchFiguraCascoStore.setState({
          [voteKey]: {
            twoVotesPlayerId: data.twoVotesPlayerId as string,
            oneVotePlayerId: data.oneVotePlayerId as string,
            votedAtMs: votedAt ? votedAt.toMillis() : null,
          },
          [loadedKey]: true,
        } as Partial<MatchFiguraCascoStore>);
      } else {
        useMatchFiguraCascoStore.setState({
          [voteKey]: null,
          [loadedKey]: true,
        } as Partial<MatchFiguraCascoStore>);
      }
    },
    () =>
      useMatchFiguraCascoStore.setState({
        [voteKey]: null,
        [loadedKey]: true,
      } as Partial<MatchFiguraCascoStore>)
  );
}

function subscribeActiveMatch(matchId: string | null, uid: string | null, isAdmin: boolean) {
  teardownActiveMatchSubscriptions();

  if (!matchId) {
    useMatchFiguraCascoStore.setState({
      figuraStatus: EMPTY_STATUS,
      figuraStatusLoaded: true,
      cascoStatus: EMPTY_STATUS,
      cascoStatusLoaded: true,
      figuraParticipation: null,
      cascoParticipation: null,
      myFiguraVote: null,
      myFiguraVoteLoaded: true,
      myCascoVote: null,
      myCascoVoteLoaded: true,
    });
    return;
  }

  useMatchFiguraCascoStore.setState({ figuraStatusLoaded: false, cascoStatusLoaded: false });
  unsubFiguraStatus = subscribeStatus(matchId, "figura");
  unsubCascoStatus = subscribeStatus(matchId, "casco");
  unsubFiguraParticipation = subscribeParticipation(matchId, "figura", isAdmin);
  unsubCascoParticipation = subscribeParticipation(matchId, "casco", isAdmin);
  unsubMyFiguraVote = subscribeMyVote(matchId, "figura", uid);
  unsubMyCascoVote = subscribeMyVote(matchId, "casco", uid);
}

// Re-suscribe (solo si hay una fecha activa en este momento) cada vez que
// cambia el usuario logueado o su rol, mismo criterio ya usado en el resto
// de los stores.
let lastUid: string | null = null;
let lastIsAdmin = false;
useAuthStore.subscribe((state) => {
  const uid = state.user?.uid ?? null;
  const isAdmin = state.user?.role === "admin";
  const uidChanged = uid !== lastUid;
  const adminChanged = isAdmin !== lastIsAdmin;

  if (uidChanged || adminChanged) {
    lastUid = uid;
    lastIsAdmin = isAdmin;
    const activeMatchId = useMatchFiguraCascoStore.getState().activeMatchId;
    if (activeMatchId) {
      subscribeActiveMatch(activeMatchId, uid, isAdmin);
    }
  }
});
