import { create } from "zustand";
import {
  doc,
  getDoc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  FiguraCascoParticipation,
  FiguraCascoVote,
  FiguraCascoVoteType,
  FiguraCascoVotingStatus,
} from "@/types/figuraCasco";

// ---- Votacion de Figura y Casco de la fecha ----
//
// Calcado del patron de Capitan (useVotingStore.ts): ronda global unica,
// 4 documentos separados por responsabilidad (status siempre legible /
// participation solo admin / results solo admin, nunca jugadores / voto
// individual solo el dueno), transaccion atomica para votar,
// re-suscripcion en cada cambio de usuario logueado. "type" (figura|
// casco) selecciona una familia de documentos completamente separada de
// la otra, para no duplicar 6 funciones casi identicas y a la vez que sus
// estados nunca se mezclen.
//
// Capitan NO se toca en esta implementacion: sigue siendo exactamente el
// mismo store/documentos/reglas de siempre.
//
// Diferencia deliberada respecto de Capitan: figuraVoteResults/main y
// cascoVoteResults/main son de lectura EXCLUSIVA del admin, siempre -a
// diferencia de voteResults/main de Capitan, que cualquier usuario
// logueado puede leer una vez cerrada la votacion. Es asi porque se pidio
// explicitamente que ningun jugador vea cantidades de votos, ni siquiera
// despues del cierre -el resultado (sin cantidades) se expone aparte en
// <type>VotingStatus/main.winnerIds.

function statusDoc(type: FiguraCascoVoteType) {
  return doc(db, `${type}VotingStatus`, "main");
}
function participationDoc(type: FiguraCascoVoteType) {
  return doc(db, `${type}VotingParticipation`, "main");
}
function resultsDoc(type: FiguraCascoVoteType) {
  return doc(db, `${type}VoteResults`, "main");
}
function voteDoc(type: FiguraCascoVoteType, uid: string) {
  return doc(db, `${type}Votes`, uid);
}

interface FiguraCascoVotingStore {
  figuraStatus: FiguraCascoVotingStatus;
  figuraStatusLoaded: boolean;
  figuraParticipation: FiguraCascoParticipation | null;
  myFiguraVote: FiguraCascoVote | null;
  myFiguraVoteLoaded: boolean;

  cascoStatus: FiguraCascoVotingStatus;
  cascoStatusLoaded: boolean;
  cascoParticipation: FiguraCascoParticipation | null;
  myCascoVote: FiguraCascoVote | null;
  myCascoVoteLoaded: boolean;

  openFiguraVoting: () => Promise<void>;
  closeFiguraVoting: () => Promise<void>;
  castFiguraVote: (twoVotesPlayerId: string, oneVotePlayerId: string) => Promise<void>;

  openCascoVoting: () => Promise<void>;
  closeCascoVoting: () => Promise<void>;
  castCascoVote: (twoVotesPlayerId: string, oneVotePlayerId: string) => Promise<void>;
}

// Gana quien tenga mas votos; si dos o mas jugadores empatan en el
// maximo, TODOS quedan como ganadores (comparten el premio) -no hay
// desempate, ni automatico ni manual. Se calcula una sola vez, al cerrar,
// y se persiste en <type>VotingStatus/main.winnerIds: no se recalcula
// despues, asi que no depende del orden de lectura de Firestore en
// ningun momento posterior.
function computeWinnerIds(counts: Record<string, number>): string[] {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) return [];
  const max = Math.max(...entries.map(([, count]) => count));
  return entries.filter(([, count]) => count === max).map(([id]) => id);
}

async function openVotingFor(type: FiguraCascoVoteType): Promise<void> {
  await setDoc(statusDoc(type), { open: true, closedAt: null, winnerIds: [] });
  await setDoc(participationDoc(type), { votedCount: 0 });
  await setDoc(resultsDoc(type), { counts: {} });
}

// Cierre en 2 pasos, igual que Capitan: primero se cierra el status (eso
// habilita la regla de lectura de <type>VoteResults/main para el admin);
// recien despues se lee -una sola vez- para calcular el/los ganador(es) y
// se persiste. Como nadie puede votar con la votacion cerrada, los counts
// quedan congelados apenas se cierra: recalcular en una llamada repetida
// es siempre seguro (idempotente), no hace falta ningun guard extra.
async function closeVotingFor(type: FiguraCascoVoteType): Promise<void> {
  await setDoc(statusDoc(type), { open: false, closedAt: Date.now() }, { merge: true });
  const snap = await getDoc(resultsDoc(type));
  const counts = (snap.data()?.counts as Record<string, number>) ?? {};
  const winnerIds = computeWinnerIds(counts);
  await setDoc(statusDoc(type), { winnerIds }, { merge: true });
}

// Transaccion atomica, mismo orden documentado en useVotingStore.castVote
// de Capitan (FIX B): los increment() de resultados y participacion van
// ANTES del set() del voto individual, porque la regla de "todavia no
// voto" de esos dos documentos depende de que <type>Votes/{uid} no exista
// todavia al momento en que Firestore evalua esas reglas.
async function castVoteFor(
  type: FiguraCascoVoteType,
  twoVotesPlayerId: string,
  oneVotePlayerId: string
): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("not-authenticated");
  if (!twoVotesPlayerId || !oneVotePlayerId || twoVotesPlayerId === oneVotePlayerId) {
    throw new Error("invalid-choice");
  }
  const ref = voteDoc(type, user.uid);
  const results = resultsDoc(type);
  const participation = participationDoc(type);

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
}

export const useFiguraCascoVotingStore = create<FiguraCascoVotingStore>(() => ({
  figuraStatus: { open: false, closedAt: null, winnerIds: [] },
  figuraStatusLoaded: false,
  figuraParticipation: null,
  myFiguraVote: null,
  myFiguraVoteLoaded: false,

  cascoStatus: { open: false, closedAt: null, winnerIds: [] },
  cascoStatusLoaded: false,
  cascoParticipation: null,
  myCascoVote: null,
  myCascoVoteLoaded: false,

  openFiguraVoting: () => openVotingFor("figura"),
  closeFiguraVoting: () => closeVotingFor("figura"),
  castFiguraVote: (twoVotesPlayerId, oneVotePlayerId) =>
    castVoteFor("figura", twoVotesPlayerId, oneVotePlayerId),

  openCascoVoting: () => openVotingFor("casco"),
  closeCascoVoting: () => closeVotingFor("casco"),
  castCascoVote: (twoVotesPlayerId, oneVotePlayerId) =>
    castVoteFor("casco", twoVotesPlayerId, oneVotePlayerId),
}));

// STATUS_DOC de cada tipo: re-suscribe con cada cambio de usuario
// logueado, igual que el resto de los stores -el primer listener se
// registra al cargar el modulo, potencialmente ANTES de que Firebase Auth
// resuelva la sesion; si esa carrera se pierde, hay que reconectar.
let unsubFiguraStatus: (() => void) | null = null;
let unsubCascoStatus: (() => void) | null = null;

function subscribeStatus(type: FiguraCascoVoteType) {
  const current = type === "figura" ? unsubFiguraStatus : unsubCascoStatus;
  if (current) current();

  const next = onSnapshot(
    statusDoc(type),
    (snap) => {
      const statusKey = type === "figura" ? "figuraStatus" : "cascoStatus";
      const loadedKey = type === "figura" ? "figuraStatusLoaded" : "cascoStatusLoaded";
      if (snap.exists()) {
        const data = snap.data();
        useFiguraCascoVotingStore.setState({
          [statusKey]: {
            open: data.open === true,
            closedAt: typeof data.closedAt === "number" ? data.closedAt : null,
            winnerIds: Array.isArray(data.winnerIds)
              ? data.winnerIds.filter((id: unknown): id is string => typeof id === "string")
              : [],
          },
          [loadedKey]: true,
        } as Partial<FiguraCascoVotingStore>);
      } else {
        useFiguraCascoVotingStore.setState({
          [statusKey]: { open: false, closedAt: null, winnerIds: [] },
          [loadedKey]: true,
        } as Partial<FiguraCascoVotingStore>);
      }
    },
    () => {
      const loadedKey = type === "figura" ? "figuraStatusLoaded" : "cascoStatusLoaded";
      useFiguraCascoVotingStore.setState({ [loadedKey]: true } as Partial<FiguraCascoVotingStore>);
    }
  );

  if (type === "figura") unsubFiguraStatus = next;
  else unsubCascoStatus = next;
}

// Participacion (X de Y): lectura limitada a admin por firestore.rules,
// asi que a un jugador esta suscripcion le falla en silencio y queda en
// null.
let unsubFiguraParticipation: (() => void) | null = null;
let unsubCascoParticipation: (() => void) | null = null;

function subscribeParticipation(type: FiguraCascoVoteType, isAdmin: boolean) {
  const current = type === "figura" ? unsubFiguraParticipation : unsubCascoParticipation;
  if (current) current();

  const key = type === "figura" ? "figuraParticipation" : "cascoParticipation";
  if (!isAdmin) {
    useFiguraCascoVotingStore.setState({ [key]: null } as Partial<FiguraCascoVotingStore>);
    if (type === "figura") unsubFiguraParticipation = null;
    else unsubCascoParticipation = null;
    return;
  }

  const next = onSnapshot(
    participationDoc(type),
    (snap) => {
      useFiguraCascoVotingStore.setState({
        [key]: { votedCount: snap.exists() ? ((snap.data().votedCount as number) ?? 0) : 0 },
      } as Partial<FiguraCascoVotingStore>);
    },
    () => useFiguraCascoVotingStore.setState({ [key]: null } as Partial<FiguraCascoVotingStore>)
  );

  if (type === "figura") unsubFiguraParticipation = next;
  else unsubCascoParticipation = next;
}

// Voto propio: se re-suscribe con cada cambio de usuario logueado.
let unsubMyFiguraVote: (() => void) | null = null;
let unsubMyCascoVote: (() => void) | null = null;

function subscribeMyVote(type: FiguraCascoVoteType, uid: string | null) {
  const current = type === "figura" ? unsubMyFiguraVote : unsubMyCascoVote;
  if (current) current();

  const voteKey = type === "figura" ? "myFiguraVote" : "myCascoVote";
  const loadedKey = type === "figura" ? "myFiguraVoteLoaded" : "myCascoVoteLoaded";

  if (!uid) {
    useFiguraCascoVotingStore.setState({
      [voteKey]: null,
      [loadedKey]: true,
    } as Partial<FiguraCascoVotingStore>);
    if (type === "figura") unsubMyFiguraVote = null;
    else unsubMyCascoVote = null;
    return;
  }

  useFiguraCascoVotingStore.setState({ [loadedKey]: false } as Partial<FiguraCascoVotingStore>);
  const next = onSnapshot(
    voteDoc(type, uid),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const votedAt = data.votedAt as Timestamp | undefined;
        useFiguraCascoVotingStore.setState({
          [voteKey]: {
            twoVotesPlayerId: data.twoVotesPlayerId as string,
            oneVotePlayerId: data.oneVotePlayerId as string,
            votedAtMs: votedAt ? votedAt.toMillis() : null,
          },
          [loadedKey]: true,
        } as Partial<FiguraCascoVotingStore>);
      } else {
        useFiguraCascoVotingStore.setState({
          [voteKey]: null,
          [loadedKey]: true,
        } as Partial<FiguraCascoVotingStore>);
      }
    },
    () =>
      useFiguraCascoVotingStore.setState({
        [voteKey]: null,
        [loadedKey]: true,
      } as Partial<FiguraCascoVotingStore>)
  );

  if (type === "figura") unsubMyFiguraVote = next;
  else unsubMyCascoVote = next;
}

subscribeStatus("figura");
subscribeStatus("casco");

let lastUid: string | null = null;
let lastIsAdmin = false;
useAuthStore.subscribe((state) => {
  const uid = state.user?.uid ?? null;
  const isAdmin = state.user?.role === "admin";
  const uidChanged = uid !== lastUid;
  const adminChanged = isAdmin !== lastIsAdmin;

  if (uidChanged) {
    lastUid = uid;
    subscribeStatus("figura");
    subscribeStatus("casco");
    subscribeMyVote("figura", uid);
    subscribeMyVote("casco", uid);
  }
  if (uidChanged || adminChanged) {
    lastIsAdmin = isAdmin;
    subscribeParticipation("figura", isAdmin);
    subscribeParticipation("casco", isAdmin);
  }
});
