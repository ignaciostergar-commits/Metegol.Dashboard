import { AlertTriangle } from "lucide-react";
import { useTeamStore } from "@/store/useTeamStore";

const MAX_YELLOW = 3;

function barColor(count: number) {
  if (count >= MAX_YELLOW) return "bg-danger";
  if (count === 2) return "bg-warn";
  return "bg-accent-blue";
}

export function AmarillasCard() {
  const players = useTeamStore((s) => s.team.players);
  const sorted = [...players].sort((a, b) => b.yellow_cards - a.yellow_cards);

  return (
    <div className="rounded-xl2 bg-base-850 border border-base-700 p-5 shadow-soft lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-400">Acumulación de Amarillas</p>
          <p className="text-xs text-gray-500 mt-0.5">A la 3ra tarjeta, invita ronda de birras</p>
        </div>
        <div className="rounded-lg p-2.5 bg-warn/10 text-warn ring-1 ring-warn/20">
          <AlertTriangle className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm text-gray-300 truncate">{p.name}</span>
            <div className="flex-1 h-2.5 rounded-full bg-base-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor(p.yellow_cards)}`}
                style={{ width: `${Math.min((p.yellow_cards / MAX_YELLOW) * 100, 100)}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-sm tabular-nums text-gray-400">
              {p.yellow_cards}/{MAX_YELLOW}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
