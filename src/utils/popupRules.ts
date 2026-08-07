import type { Player } from "@/types/player";

export type PopupTone = "warning" | "danger" | "info" | "success";

export interface PopupMessage {
  id: string;
  tone: PopupTone;
  message: string;
}

/**
 * Evalúa las métricas de un jugador contra las reglas del contrato
 * Metegol Areia y devuelve la lista de popups que corresponde mostrarle
 * al iniciar sesión. Se evalúan TODAS las reglas que apliquen (no solo la
 * primera), porque un jugador puede estar en más de una situación a la vez.
 */
export function getPopupsForPlayer(
  player: Player,
  teamHasGoalkeeper: boolean
): PopupMessage[] {
  const popups: PopupMessage[] = [];

  // Regla: Casco / Blooper de la fecha
  if (player.has_blooper) {
    popups.push({
      id: "blooper",
      tone: "warning",
      message:
        "👷‍♂️ ¡Al que le toca el Casco esta fecha por meterla en propia! Prepárate para la joda.",
    });
  }

  // Regla: Ausencia sin aviso -> arco o birras, según si el equipo tiene arquero
  if (player.undisclosed_absences > 0) {
    if (!teamHasGoalkeeper) {
      popups.push({
        id: "absence-goalkeeper",
        tone: "info",
        message: "🥅 ¡Ausente sin aviso! Gracias por ir al arco la próxima fecha.",
      });
    } else {
      popups.push({
        id: "absence-beers",
        tone: "warning",
        message: "🍺 ¡Ausente sin aviso! Invita una ronda de birras al equipo.",
      });
    }
  }

  // Regla: Tarjeta roja -> birras
  if (player.red_cards > 0) {
    popups.push({
      id: "red-card",
      tone: "danger",
      message: "🟥 ¡Tarjeta Roja! A la próxima vas con el bolsillo lleno para invitar birras.",
    });
  }

  // Regla: 3ra amarilla -> birras (ya se cumplió)
  if (player.yellow_cards >= 3) {
    popups.push({
      id: "yellow-cards-hit",
      tone: "danger",
      message: "🟡 ¡Llegaste a 3 amarillas! Te toca invitar una ronda de birras.",
    });
  } else if (player.yellow_cards === 2) {
    // Regla: a una amarilla de la ronda completa (aviso preventivo)
    popups.push({
      id: "yellow-cards-warning",
      tone: "warning",
      message: "🟡 ¡Cuidado! Estás a una amarilla de invitar una ronda completa.",
    });
  }

  // Regla: Valla invicta (arqueros) en la última fecha -> no paga cerveza
  if (player.is_valla_invicta_fecha) {
    popups.push({
      id: "valla-invicta",
      tone: "success",
      message: "🧤 ¡Valla invicta! No paga cerveza.",
    });
  }

  // Regla: Hat-trick (3+ goles en un partido) en la última fecha -> no paga cerveza
  if (player.is_hat_trick_fecha) {
    popups.push({
      id: "hat-trick",
      tone: "success",
      message: "⚽ ¡Hat-trick! No paga cerveza.",
    });
  }

  // Bonus positivo: si es la figura de la fecha, mensaje de reconocimiento
  if (player.is_figura_fecha) {
    popups.push({
      id: "figura",
      tone: "success",
      message: "🌟 ¡Sos la Figura de la última fecha! Que no se te suba a la cabeza.",
    });
  }

  return popups;
}
