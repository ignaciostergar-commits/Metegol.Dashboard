import { ListOrdered } from "lucide-react";
import { useTeamStore } from "@/store/useTeamStore";

export function RankingAsistenciaTable() {
  const ranking = useTeamStore((s) => s.getRankingAsistenciaMes());
  const monthLabel = useTeamStore((s) => s.team.month_label);

  return (
    <div className="rounded-xl2 bg-base-850 border border-base-700 p-5 shadow-soft lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-400">Ranking de Asistencia</p>
          <p className="text-xs text-gray-500 mt-0.5">Conteo del mes — {monthLabel}</p>
        </div>
        <div className="rounded-lg p-2.5 bg-accent-blue/10 text-accent-blue ring-1 ring-accent-blue/20">
          <ListOrdered className="h-5 w-5" />
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-base-700">
            <th className="pb-2 font-medium">#</th>
            <th className="pb-2 font-medium">Jugador</th>
            <th className="pb-2 font-medium text-right">Partidos</th>
            <th className="pb-2 font-medium text-right">Faltas</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((p, i) => (
            <tr key={p.id} className="border-b border-base-700/60 last:border-0">
              <td className="py-2 text-gray-500">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </td>
              <td className="py-2 text-gray-200 font-medium">{p.name}</td>
              <td className="py-2 text-right text-gray-400 tabular-nums">
                {p.matches_played_month}
              </td>
              <td className="py-2 text-right tabular-nums">
                <span
                  className={
                    p.absences_month === 0 ? "text-accent-green" : "text-gray-400"
                  }
                >
                  {p.absences_month}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
