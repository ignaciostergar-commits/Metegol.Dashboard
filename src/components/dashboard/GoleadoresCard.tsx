import { Target } from "lucide-react";
import { useTeamStore } from "@/store/useTeamStore";

export function GoleadoresCard() {
  const ranking = useTeamStore((s) => s.getRankingGoleadores());
  const monthLabel = useTeamStore((s) => s.team.month_label);

  return (
    <div className="rounded-xl2 bg-base-850 border border-base-700 p-5 shadow-soft lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-400">Ranking de Goleadores</p>
          <p className="text-xs text-gray-500 mt-0.5">Goles del mes — {monthLabel}</p>
        </div>
        <div className="rounded-lg p-2.5 bg-accent-green/10 text-accent-green ring-1 ring-accent-green/20">
          <Target className="h-5 w-5" />
        </div>
      </div>

      {ranking.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-base-700">
              <th className="pb-2 font-medium">#</th>
              <th className="pb-2 font-medium">Jugador</th>
              <th className="pb-2 font-medium text-right">Goles</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((p, i) => (
              <tr key={p.id} className="border-b border-base-700/60 last:border-0">
                <td className="py-2 text-gray-500">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </td>
                <td className="py-2 text-gray-200 font-medium">
                  {p.name}
                  {p.is_hat_trick_fecha && (
                    <span className="ml-2 text-xs text-accent-green">⚽ hat-trick</span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums text-gray-300">{p.goals_month}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-gray-500">Todavía nadie convirtió goles este mes.</p>
      )}
    </div>
  );
}
