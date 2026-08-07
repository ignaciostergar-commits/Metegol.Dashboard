import { useEffect, useRef } from "react";
import { Toaster, toast } from "sonner";
import { useTeamStore } from "@/store/useTeamStore";
import { useAuthStore } from "@/store/useAuthStore";
import { getPopupsForPlayer, type PopupTone } from "@/utils/popupRules";

const toneToToastFn: Record<PopupTone, typeof toast.success> = {
  success: toast.success,
  warning: toast.warning ?? toast,
  danger: toast.error,
  info: toast.info ?? toast,
};

/**
 * Al montarse (equivalente a "el jugador entra al dashboard"), lee las
 * métricas del jugador actual desde el store y dispara los popups
 * correspondientes según las reglas del contrato. Se dispara una sola vez
 * por sesión (ref guard) para no repetir los toasts en cada re-render.
 */
export function ToastManager() {
  const playerId = useAuthStore((s) => s.user?.playerId);
  const getPlayerById = useTeamStore((s) => s.getPlayerById);
  const teamHasGoalkeeper = useTeamStore((s) => s.team.team_has_goalkeeper);
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    const player = getPlayerById(playerId);
    if (!player) return;

    const popups = getPopupsForPlayer(player, teamHasGoalkeeper);

    popups.forEach((popup, i) => {
      const fn = toneToToastFn[popup.tone] ?? toast;
      // pequeño delay escalonado para que no se pisen los popups
      setTimeout(() => {
        fn(popup.message, { duration: 6000 });
      }, i * 450);
    });

    hasFired.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamHasGoalkeeper]);

  return (
    <Toaster
      position="top-right"
      richColors
      theme="dark"
      toastOptions={{
        style: {
          background: "#171f2a",
          border: "1px solid #2c3a4a",
          color: "#e5e7eb",
        },
      }}
    />
  );
}
