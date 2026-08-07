export interface Player {
  id: string;
  name: string;
  avatar_url?: string;
  position?: string; // arquero, defensor, mediocampista, delantero, etc.

  // Métricas de compromiso (según contrato Metegol Areia)
  late_arrivals: number; // impuntualidades -> pierde titularidad
  undisclosed_absences: number; // ausencias sin aviso -> arco o birras
  red_cards: number; // tarjetas rojas -> birras
  yellow_cards: number; // amarillas acumuladas -> a la 3ra, birras
  matches_played_month: number;
  absences_month: number;

  is_figura_fecha: boolean; // figura de la última fecha
  has_blooper: boolean; // le toca "el casco" esta fecha
  caja_chica_paid: number; // aportes a la caja chica

  // Goleadores
  goals_month: number; // goles convertidos en el mes -> ranking de goleadores

  // Valla invicta (arqueros) y Hat-trick: banderas de "la última fecha"
  // (mismo patrón que is_figura_fecha / has_blooper). El store se encarga
  // de acumular clean_sheets_total automáticamente cada vez que
  // is_valla_invicta_fecha llega en true desde una importación nueva.
  is_valla_invicta_fecha: boolean; // valla invicta en la última fecha
  is_hat_trick_fecha: boolean; // 3 o más goles en un mismo partido, última fecha
  clean_sheets_total: number; // contador histórico acumulado de vallas invictas
}

export interface TeamData {
  team_name: string;
  tournament_name: string;
  team_has_goalkeeper: boolean;
  caja_chica_total: number;
  month_label: string;
  players: Player[];
}

export type UserRole = "admin" | "player";

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  playerId?: string; // vincula con Player.id, si corresponde
}

// Shape esperado del archivo Excel/CSV importado.
// Una fila por jugador. Encabezados esperados (insensible a mayúsculas):
// name, late_arrivals, undisclosed_absences, red_cards, yellow_cards,
// matches_played_month, absences_month, is_figura_fecha, has_blooper, caja_chica_paid,
// goals_month, is_valla_invicta_fecha, is_hat_trick_fecha
export interface PlayerImportRow {
  name: string;
  position?: string;
  late_arrivals?: string | number;
  undisclosed_absences?: string | number;
  red_cards?: string | number;
  yellow_cards?: string | number;
  matches_played_month?: string | number;
  absences_month?: string | number;
  is_figura_fecha?: string | boolean;
  has_blooper?: string | boolean;
  caja_chica_paid?: string | number;
  goals_month?: string | number;
  is_valla_invicta_fecha?: string | boolean;
  is_hat_trick_fecha?: string | boolean;
}
