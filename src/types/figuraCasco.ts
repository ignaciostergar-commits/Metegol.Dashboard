// ---- Votacion de Figura y Casco de la fecha ----
//
// Mismo patron que la votacion de Capitan/Subcapitan (ver player.ts y
// useVotingStore.ts): ronda global unica (no hay entidad de fecha/
// partido -eso queda para una eventual Fase 2), abrir resetea la ronda
// anterior, votacion secreta hasta el cierre. Se duplica x2 (figura,
// casco) para que ambas votaciones tengan estados completamente
// independientes -nunca comparten un documento.
//
// Se definen tipos NUEVOS y separados de los de Capitan (no se reutilizan
// VotingStatus/VotingParticipation/VoteResults/Vote de player.ts) a
// proposito: evita cualquier acoplamiento entre ambos sistemas, y ese
// archivo/Capitan quedan sin tocar.
export type FiguraCascoVoteType = "figura" | "casco";

export interface FiguraCascoVotingStatus {
  open: boolean;
  closedAt: number | null;
  // Ganador(es) del primer puesto, fijado una sola vez al cerrar la
  // votacion. Vacio = todavia no hay resultado (no se cerro, o se cerro
  // sin ningun voto). Mas de un elemento = empate en el primer puesto:
  // TODOS comparten el premio, no hay desempate ni seleccion manual.
  winnerIds: string[];
}

// Cuanta gente ya voto (X de Y). Lectura exclusiva del admin -mismo
// patron que VotingParticipation de Capitan.
export interface FiguraCascoParticipation {
  votedCount: number;
}

// Conteos agregados por jugador. Mas estricto que Capitan a proposito:
// lectura EXCLUSIVA del admin, nunca de un jugador, ni siquiera una vez
// cerrada la votacion -asi "no mostrar cantidad de votos" no depende solo
// de que la UI no lo muestre. El resultado (sin cantidades) se expone por
// separado en FiguraCascoVotingStatus.winnerIds.
export interface FiguraCascoResults {
  counts: Record<string, number>;
}

// Voto individual: 2 votos a twoVotesPlayerId, 1 voto a un
// oneVotePlayerId DISTINTO. Solo el propio dueno puede leerlo (ni el
// admin); de creacion unica.
export interface FiguraCascoVote {
  twoVotesPlayerId: string;
  oneVotePlayerId: string;
  votedAtMs: number | null;
}
