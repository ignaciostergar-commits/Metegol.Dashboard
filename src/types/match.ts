// ---- Fecha/Partido (Fase 2, Bloque 1) ----
//
// Entidad nueva e independiente de team/main: cada fecha del torneo es un
// documento propio y permanente en matches/{matchId}, con id auto-generado
// por Firestore (estable, no depende de "number" ni de "date" -así se
// puede corregir el número o la fecha real más adelante sin romper nada
// que ya apunte a este documento).
//
// El esquema completo se define acá desde el Bloque 1, aunque este bloque
// solo llena una parte: importedAt/importedBy (Bloque 2) y
// figuraOpen/cascoOpen/figuraWinnerIds/cascoWinnerIds (Bloque 3) se crean
// en su valor inicial y quedan pendientes de que los bloques siguientes
// los completen -así no hace falta migrar el esquema del documento entre
// bloques.
//
// NO toca team/main, el importador de Excel actual, la votación de
// Capitán (que sigue siendo la ronda global de toda la temporada, ver
// useVotingStore.ts) ni la implementación actual de Figura/Casco (que
// todavía es una ronda global, ver useFiguraCascoVotingStore.ts -pasa a
// ser por fecha recién en el Bloque 3).
export interface Match {
  id: string;
  number: number; // "Fecha 7" -único, garantizado server-side vía matchNumbers/{number}
  date: string; // "AAAA-MM-DD", fecha real del partido

  // Bloqueo duro: una fecha "closed" no admite nuevos votos de Figura/Casco,
  // reimportación de Excel, ni modificar/eliminar playerStats (Bloque 2/3
  // son los que agregan esas restricciones a sus propias reglas; acá en
  // Bloque 1 no hay todavía nada más que bloquear salvo el propio match).
  // Sin reapertura por ahora -acción administrativa a diseñar más adelante.
  status: "open" | "closed";

  createdAtMs: number | null;
  createdBy: string; // uid del admin que creó la fecha
  closedAtMs: number | null;

  // Poblados recién en Bloque 2 (importación por fecha). En Bloque 1 quedan
  // en null.
  importedAtMs: number | null;
  importedBy: string | null;

  // Poblados recién en Bloque 3 (Figura/Casco por fecha). En Bloque 1
  // quedan en false/[]. Booleanos y arrays de ids, nunca conteos -mismo
  // criterio de privacidad que ya usa la implementación global actual.
  figuraOpen: boolean;
  cascoOpen: boolean;
  figuraWinnerIds: string[];
  cascoWinnerIds: string[];

  // ---- Bloque 2: lock de importación ----
  // Evita que dos importaciones de la MISMA fecha corran en paralelo y se
  // mezclen (ver useMatchesStore.ts, acquireImportLock/releaseImportLock).
  // importLockAtMs se usa para tratar un lock como abandonado si pasaron
  // más de STALE_LOCK_MS sin liberarse (cliente que se cayó a mitad de una
  // importación).
  importInProgress: boolean;
  importLockAtMs: number | null;
}

// ---- Bloque 2: estadísticas de un jugador en UNA fecha puntual ----
//
// matches/{matchId}/playerStats/{playerId}, playerId = el mismo
// slugify(name) que ya calcula parseImport.ts (rowToPlayer) -determinístico
// y estable entre importaciones, se reutiliza tal cual, sin inventar un id
// nuevo. Deliberadamente NO incluye name/avatar_url/position ni
// clean_sheets_total: eso es identidad/acumulado del jugador, no un dato
// de esta fecha -se resuelve por playerId contra team.players al mostrar.
export interface MatchPlayerStats {
  goals: number;
  late_arrivals: number;
  undisclosed_absences: number;
  red_cards: number;
  yellow_cards: number;
  is_valla_invicta: boolean;
  is_hat_trick: boolean;
  caja_chica_paid: number;
}

// ---- Bloque 3: Figura y Casco por fecha ----
//
// matches/{matchId}/figuraStatus|figuraParticipation|figuraVoteResults|
// figuraVotes (y lo mismo con "casco"), namespaced bajo la fecha. Capitán/
// Subcapitán NO pasa por acá -sigue siendo la ronda global de toda la
// temporada, sin cambios (useVotingStore.ts). La implementación global
// actual de Figura/Casco (useFiguraCascoVotingStore.ts) tampoco se toca:
// sigue siendo una ronda independiente, sin relación con las fechas.
export type MatchVoteType = "figura" | "casco";

// A diferencia de FiguraCascoVotingStatus (la versión global), NO incluye
// winnerIds -esos viven en el documento padre matches/{matchId}
// (figuraWinnerIds/cascoWinnerIds, ya definidos desde el Bloque 1), para
// poder mostrarlos desde el historial sin abrir esta subcolección.
export interface MatchVoteStatus {
  open: boolean;
  closedAtMs: number | null;
}

// Cuánta gente ya votó en esa votación de esa fecha. Lectura exclusiva del
// admin, igual que en la versión global.
export interface MatchVoteParticipation {
  votedCount: number;
}

// Conteos agregados por jugador para una votación de una fecha puntual.
// Lectura exclusiva del admin, igual que en la versión global -ningún
// jugador puede leerlos, ni abierta ni cerrada la votación.
export interface MatchVoteResults {
  counts: Record<string, number>;
}

// Voto individual de un usuario en una fecha y tipo de votación puntual.
// Reparto obligatorio: 2 votos a twoVotesPlayerId, 1 voto a un
// oneVotePlayerId DISTINTO. Solo el propio dueño puede leer su documento
// (ni el admin), y es de creación única.
export interface MatchVote {
  twoVotesPlayerId: string;
  oneVotePlayerId: string;
  votedAtMs: number | null;
}
