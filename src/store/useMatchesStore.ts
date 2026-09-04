import { create } from "zustand";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import type { Match, MatchPlayerStats } from "@/types/match";
import type { Player } from "@/types/player";

// ---- Entidad Fecha/Partido (Fase 2) ----
//
// Bloque 1: crear/listar/seleccionar/cerrar fechas.
// Bloque 2: importación de Excel asociada a una fecha (playerStats), con
// reemplazo completo y lock anti-concurrencia. Nada de Figura/Casco por
// fecha todavía -eso es el Bloque 3, deliberadamente fuera de este
// archivo por ahora. Capitán/Subcapitán tampoco pasa por acá: sigue
// siendo la ronda global de toda la temporada (useVotingStore.ts, sin
// tocar).
//
// matchNumbers/{number}: documento de "reserva" (doc id = String(number)),
// creado en la MISMA transacción que matches/{matchId}. Mismo mecanismo de
// "creación única" que ya usamos para bloquear el doble voto (existencia
// de un documento como prueba de unicidad), aplicado acá a "number" en vez
// de a "uid". Reserva PERMANENTE: firestore.rules no permite borrarla
// nunca (ni al admin), así que no puede quedar un número liberado mientras
// el match correspondiente siga existiendo (y los matches tampoco se
// pueden borrar). Corregir un número mal tipeado queda, a propósito,
// fuera de este bloque.

const MATCHES_COL = collection(db, "matches");

function matchRef(matchId: string) {
  return doc(db, "matches", matchId);
}
function matchNumberRef(number: number) {
  return doc(db, "matchNumbers", String(number));
}
function playerStatsCol(matchId: string) {
  return collection(db, "matches", matchId, "playerStats");
}

// Una importación real de un plantel (15-25 jugadores) tarda segundos. Si
// un lock queda con más de este tiempo sin liberarse, se trata como
// abandonado (cliente que se cayó a mitad de una importación) y se puede
// volver a tomar -ver acquireImportLock más abajo.
const STALE_LOCK_MS = 2 * 60 * 1000;

interface MatchesStore {
  matches: Match[]; // ordenados por number desc (más reciente primero)
  matchesLoaded: boolean;
  selectedMatchId: string | null;

  selectMatch: (matchId: string | null) => void;

  // Devuelve el matchId creado. Tira "number-already-exists" si ya existe
  // una fecha con ese número (chequeado y reservado dentro de la misma
  // transacción que crea el match, sin condición de carrera posible entre
  // dos creaciones concurrentes).
  createMatch: (number: number, date: string) => Promise<string>;

  // Bloqueo duro, sin reapertura en este bloque (ver types/match.ts).
  closeMatch: (matchId: string) => Promise<void>;

  // Reemplazo COMPLETO de matches/{matchId}/playerStats a partir de un
  // Excel ya parseado (mismos Player[] que usa useTeamStore.importPlayers,
  // reutilizados tal cual -esta función NO toca team/main, eso lo hace por
  // separado quien llama, ver ImportarFechaButton.tsx). Tira
  // "import-in-progress" si ya hay otra importación de ESTA fecha
  // corriendo, "match-closed" si la fecha no está abierta (chequeo extra
  // client-side; el bloqueo real y definitivo es server-side, ver
  // isMatchOpen() en firestore.rules sobre playerStats).
  importMatchPlayerStats: (matchId: string, players: Player[]) => Promise<void>;
}

function matchFromDoc(id: string, data: DocumentData): Match {
  const createdAt = data.createdAt as Timestamp | undefined;
  const closedAt = data.closedAt as Timestamp | undefined;
  const importedAt = data.importedAt as Timestamp | undefined;
  const importLockAt = data.importLockAt as Timestamp | undefined;
  return {
    id,
    number: typeof data.number === "number" ? data.number : 0,
    date: typeof data.date === "string" ? data.date : "",
    status: data.status === "closed" ? "closed" : "open",
    createdAtMs: createdAt ? createdAt.toMillis() : null,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    closedAtMs: closedAt ? closedAt.toMillis() : null,
    importedAtMs: importedAt ? importedAt.toMillis() : null,
    importedBy: typeof data.importedBy === "string" ? data.importedBy : null,
    figuraOpen: data.figuraOpen === true,
    cascoOpen: data.cascoOpen === true,
    figuraWinnerIds: Array.isArray(data.figuraWinnerIds)
      ? data.figuraWinnerIds.filter((id: unknown): id is string => typeof id === "string")
      : [],
    cascoWinnerIds: Array.isArray(data.cascoWinnerIds)
      ? data.cascoWinnerIds.filter((id: unknown): id is string => typeof id === "string")
      : [],
    importInProgress: data.importInProgress === true,
    importLockAtMs: importLockAt ? importLockAt.toMillis() : null,
  };
}

// Convierte un Player ya parseado (parseImport.ts) al subconjunto de
// campos que le corresponde a ESTA fecha puntual -ver MatchPlayerStats en
// types/match.ts para el porqué de no incluir name/avatar_url/position/
// clean_sheets_total.
function toMatchPlayerStats(p: Player): MatchPlayerStats {
  return {
    goals: p.goals_month,
    late_arrivals: p.late_arrivals,
    undisclosed_absences: p.undisclosed_absences,
    red_cards: p.red_cards,
    yellow_cards: p.yellow_cards,
    is_valla_invicta: p.is_valla_invicta_fecha,
    is_hat_trick: p.is_hat_trick_fecha,
    caja_chica_paid: p.caja_chica_paid,
  };
}

// Adquiere el lock de importación de una fecha dentro de una transacción:
// -si la fecha no está abierta, tira "match-closed" sin escribir nada (el
//  bloqueo real y definitivo sobre playerStats es server-side, esto es
//  además, para no ni siquiera intentar leer/escribir nada si ya se sabe
//  que va a fallar);
// -si ya hay un lock vigente (no vencido), tira "import-in-progress" sin
//  escribir nada;
// -si no hay lock vigente y la fecha está abierta, toma el lock
//  (importInProgress: true, importLockAt: ahora) en la MISMA transacción.
// Firestore serializa transacciones concurrentes sobre el mismo documento:
// si dos clientes intentan tomar el lock al mismo tiempo, solo una gana;
// la otra se reintenta sola y ve el lock ya tomado -mismo mecanismo de
// "creación única vía transacción" que ya usamos para matchNumbers/{number}
// y para el doble voto.
async function acquireImportLock(matchId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(matchRef(matchId));
    const data = snap.data();

    if (data?.status !== "open") {
      throw new Error("match-closed");
    }

    const inProgress = data?.importInProgress === true;
    const lockAtMs = (data?.importLockAt as Timestamp | undefined)?.toMillis() ?? 0;
    const isStale = Date.now() - lockAtMs > STALE_LOCK_MS;

    if (inProgress && !isStale) {
      throw new Error("import-in-progress");
    }

    tx.update(matchRef(matchId), { importInProgress: true, importLockAt: serverTimestamp() });
  });
}

// Libera el lock -best-effort: si esta escritura también falla (p.ej. sin
// red), el lock queda tomado hasta que STALE_LOCK_MS lo destrabe solo.
async function releaseImportLock(matchId: string): Promise<void> {
  await updateDoc(matchRef(matchId), { importInProgress: false }).catch(() => undefined);
}

export const useMatchesStore = create<MatchesStore>(() => ({
  matches: [],
  matchesLoaded: false,
  selectedMatchId: null,

  selectMatch: (matchId) => {
    useMatchesStore.setState({ selectedMatchId: matchId });
  },

  createMatch: async (number, date) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("not-authenticated");

    const numberRef = matchNumberRef(number);
    const ref = doc(MATCHES_COL);

    await runTransaction(db, async (tx) => {
      const existing = await tx.get(numberRef);
      if (existing.exists()) {
        throw new Error("number-already-exists");
      }

      tx.set(numberRef, { matchId: ref.id, createdAt: serverTimestamp() });
      tx.set(ref, {
        number,
        date,
        status: "open",
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        closedAt: null,
        importedAt: null,
        importedBy: null,
        figuraOpen: false,
        cascoOpen: false,
        figuraWinnerIds: [],
        cascoWinnerIds: [],
        importInProgress: false,
        importLockAt: null,
      });
    });

    return ref.id;
  },

  closeMatch: async (matchId) => {
    await updateDoc(matchRef(matchId), { status: "closed", closedAt: serverTimestamp() });
  },

  // Reemplazo completo, atómico: se leen los playerStats actuales de esta
  // fecha, y en UN SOLO writeBatch se borran todos + se escriben todos los
  // nuevos. batch.commit() es todo o nada -si falla (red, permisos), NADA
  // de lo anterior se toca, la fecha queda exactamente como estaba antes
  // de este intento. Reintentar con el mismo Excel es seguro: cada corrida
  // vuelve a leer lo que realmente hay (nunca lo que un intento fallido
  // "dejó a medias", porque un intento fallido no deja nada) y converge al
  // mismo resultado final -el contenido exacto del Excel reintentado.
  //
  // El plantel típico (15-25 jugadores) genera como mucho ~50 operaciones
  // (borrar los viejos + escribir los nuevos), muy por debajo del límite
  // de 500 por batch -un solo writeBatch() alcanza, no hace falta
  // partirlo ni una Cloud Function.
  importMatchPlayerStats: async (matchId, players) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("not-authenticated");

    await acquireImportLock(matchId);
    try {
      const statsCol = playerStatsCol(matchId);
      const existingSnap = await getDocs(statsCol);

      const batch = writeBatch(db);
      existingSnap.docs.forEach((d) => batch.delete(d.ref));
      players.forEach((p) => {
        batch.set(doc(statsCol, p.id), toMatchPlayerStats(p));
      });
      await batch.commit();

      await updateDoc(matchRef(matchId), {
        importedAt: serverTimestamp(),
        importedBy: user.uid,
        importInProgress: false, // libera el lock y confirma éxito en la misma escritura
      });
    } catch (err) {
      await releaseImportLock(matchId);
      throw err;
    }
  },
}));

// Colección completa de fechas: chica (una por semana de torneo), sin
// conteos de votos en ningún campo -por eso es seguro suscribirse a todo
// el listado de una vez, tanto para el admin (alta) como para jugadores
// (navegar el historial). Re-suscribe con cada cambio de usuario logueado,
// igual que el resto de los stores -el primer listener se registra al
// cargar el módulo, potencialmente ANTES de que Firebase Auth resuelva la
// sesión; si esa carrera se pierde, hay que reconectar.
let unsubMatches: (() => void) | null = null;

function subscribeMatches() {
  if (unsubMatches) {
    unsubMatches();
    unsubMatches = null;
  }
  unsubMatches = onSnapshot(
    query(MATCHES_COL, orderBy("number", "desc")),
    (snap) => {
      const matches = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) =>
        matchFromDoc(d.id, d.data())
      );
      useMatchesStore.setState({ matches, matchesLoaded: true });
    },
    () => useMatchesStore.setState({ matches: [], matchesLoaded: true })
  );
}

subscribeMatches();

let lastUid: string | null = useAuthStore.getState().user?.uid ?? null;
useAuthStore.subscribe((state) => {
  const uid = state.user?.uid ?? null;
  if (uid !== lastUid) {
    lastUid = uid;
    subscribeMatches();
  }
});
