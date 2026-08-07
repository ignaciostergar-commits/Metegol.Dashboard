import { Clock, UserX, Square } from "lucide-react";
import { useTeamStore } from "@/store/useTeamStore";
import { StatCard } from "./StatCard";

export function ImpuntualidadesCard() {
  const players = useTeamStore((s) => s.team.players);
  const total = players.reduce((sum, p) => sum + p.late_arrivals, 0);
  const topPlayer = [...players].sort((a, b) => b.late_arrivals - a.late_arrivals)[0];

  return (
    <StatCard
      icon={Clock}
      label="Impuntualidades"
      value={total}
      sublabel={
        topPlayer && topPlayer.late_arrivals > 0
          ? `Más llegadas tarde: ${topPlayer.name} (${topPlayer.late_arrivals})`
          : "Nadie llegó tarde este mes 🎉"
      }
      accent="amber"
    />
  );
}

export function AusenciasCard() {
  const players = useTeamStore((s) => s.team.players);
  const total = players.reduce((sum, p) => sum + p.undisclosed_absences, 0);

  return (
    <StatCard
      icon={UserX}
      label="Ausencias sin aviso"
      value={total}
      sublabel="Regla activa: arquero directo o invitación de birra"
      accent="blue"
    />
  );
}

export function TarjetasRojasCard() {
  const players = useTeamStore((s) => s.team.players);
  const total = players.reduce((sum, p) => sum + p.red_cards, 0);
  const expelled = players.filter((p) => p.red_cards > 0);

  return (
    <StatCard
      icon={Square}
      label="Tarjetas Rojas"
      value={total}
      sublabel={
        expelled.length > 0
          ? `Invitan birras: ${expelled.map((p) => p.name).join(", ")}`
          : "Sin expulsados este mes"
      }
      accent="red"
    />
  );
}
