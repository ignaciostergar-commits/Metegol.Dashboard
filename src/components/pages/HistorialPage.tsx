import { useMemo, useState } from "react";
import { Trophy, Shield, Pencil, Check, X, Star, PiggyBank, Goal } from "lucide-react";
import { useTeamStore } from "@/store/useTeamStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useHistoryStore } from "@/store/useHistoryStore";

export function HistorialPage() {
  const vallas = useTeamStore((s) => s.getRankingVallasInvictas());
  const setCleanSheets = useTeamStore((s) => s.setCleanSheets);
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");

  // El mes que está corriendo ahora mismo ya se ve en vivo en el resto del
  // dashboard: acá solo listamos meses ya cerrados, así que si por algún
  // motivo quedó un snapshot con el mismo período que el actual, lo
  // ocultamos para no duplicarlo.
  const currentMonthKey = useTeamStore((s) => s.team.month_key);
  const allMonths = useHistoryStore((s) => s.months);
  const historyLoaded = useHistoryStore((s) => s.loaded);
  const months = useMemo(
    () => allMonths.filter((m) => m.month_key !== currentMonthKey),
    [allMonths, currentMonthKey]
  );

  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = months[selectedIdx];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("0");
  const [saving, setSaving] = useState(false);

  function startEditing(id: string, current: number) {
    setEditingId(id);
    setDraft(String(current));
  }

  async function save(id: string) {
    const parsed = Number(draft);
    if (!Number.isInteger(parsed) || parsed < 0) return;
    setSaving(true);
    try {
      await setCleanSheets(id, parsed);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-xl2 bg-base-850 border border-base-700 p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-400">Vallas Invictas — Histórico</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Contador acumulado, se suma cada vez que se importa una fecha con valla invicta
            </p>
          </div>
          <div className="rounded-lg p-2.5 bg-accent-blue/10 text-accent-blue ring-1 ring-accent-blue/20">
            <Shield className="h-5 w-5" />
          </div>
        </div>

        {vallas.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-base-700">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Jugador</th>
                <th className="pb-2 font-medium text-right">Vallas invictas</th>
              </tr>
            </thead>
            <tbody>
              {vallas.map((p, i) => (
                <tr key={p.id} className="border-b border-base-700/60 last:border-0">
                  <td className="py-2 text-gray-500">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </td>
                  <td className="py-2 text-gray-200 font-medium">{p.name}</td>
                  <td className="py-2 text-right tabular-nums text-accent-blue">
                    {editingId === p.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <input
                          autoFocus
                          type="text"
                          inputMode="numeric"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") save(p.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="w-14 bg-base-700 rounded-md px-2 py-0.5 text-right text-white outline-none ring-1 ring-accent-blue/40 focus:ring-accent-blue"
                        />
                        <button
                          onClick={() => save(p.id)}
                          disabled={saving}
                          className="rounded p-1 bg-accent-emerald/10 text-accent-emerald hover:bg-accent-emerald/20 disabled:opacity-50"
                          aria-label="Guardar"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={saving}
                          className="rounded p-1 bg-base-700 text-gray-400 hover:text-gray-200"
                          aria-label="Cancelar"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        {p.clean_sheets_total}
                        {isAdmin && (
                          <button
                            onClick={() => startEditing(p.id, p.clean_sheets_total)}
                            className="text-gray-500 hover:text-accent-blue transition-colors"
                            aria-label="Corregir contador"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">
            Todavía no se registró ninguna valla invicta.
          </p>
        )}
      </div>

      {months.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl2 bg-base-850 border border-base-700 p-12 text-center shadow-soft">
          <div className="rounded-full bg-accent-blue/10 p-4 ring-1 ring-accent-blue/20 mb-4">
            <Trophy className="h-6 w-6 text-accent-blue" />
          </div>
          <p className="text-white font-semibold">
            {historyLoaded ? "Todavía no hay meses cerrados" : "Cargando historial..."}
          </p>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">
            {historyLoaded
              ? "Acá vas a ver la evolución mes a mes apenas se cierre el primero: cada vez que importes un Excel para un mes nuevo, el mes anterior queda archivado acá con sus rankings, figuras y caja chica."
              : ""}
          </p>
        </div>
      ) : (
        <div className="rounded-xl2 bg-base-850 border border-base-700 p-5 shadow-soft space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-medium text-gray-400">Meses cerrados</p>
              <p className="text-xs text-gray-500 mt-0.5">Rankings, figuras y caja chica de fechas anteriores</p>
            </div>
            <select
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className="bg-base-700 text-sm text-gray-200 rounded-lg px-3 py-1.5 outline-none ring-1 ring-base-600 focus:ring-accent-blue"
            >
              {months.map((m, i) => (
                <option key={m.month_label + i} value={i}>
                  {m.month_label || "Mes sin nombre"}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-base-700 p-4">
                <div className="flex items-center gap-2 mb-3 text-gray-400 text-sm font-medium">
                  <Goal className="h-4 w-4 text-accent-emerald" /> Goleadores
                </div>
                {selected.players.filter((p) => p.goals_month > 0).length > 0 ? (
                  <ul className="space-y-1.5 text-sm">
                    {[...selected.players]
                      .filter((p) => p.goals_month > 0)
                      .sort((a, b) => b.goals_month - a.goals_month)
                      .slice(0, 5)
                      .map((p) => (
                        <li key={p.id} className="flex justify-between text-gray-200">
                          <span>{p.name}</span>
                          <span className="text-accent-emerald tabular-nums">{p.goals_month}</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-500">Sin goles cargados ese mes.</p>
                )}
              </div>

              <div className="rounded-lg border border-base-700 p-4">
                <div className="flex items-center gap-2 mb-3 text-gray-400 text-sm font-medium">
                  <Star className="h-4 w-4 text-yellow-400" /> Figura de la fecha
                </div>
                {selected.players.find((p) => p.is_figura_fecha) ? (
                  <p className="text-sm text-gray-200">
                    {selected.players.find((p) => p.is_figura_fecha)?.name}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">No quedó registrada esa fecha.</p>
                )}
              </div>

              <div className="rounded-lg border border-base-700 p-4">
                <div className="flex items-center gap-2 mb-3 text-gray-400 text-sm font-medium">
                  <Shield className="h-4 w-4 text-accent-blue" /> Ausencias del mes
                </div>
                {selected.players.filter((p) => p.absences_month > 0).length > 0 ? (
                  <ul className="space-y-1.5 text-sm">
                    {[...selected.players]
                      .filter((p) => p.absences_month > 0)
                      .sort((a, b) => b.absences_month - a.absences_month)
                      .slice(0, 5)
                      .map((p) => (
                        <li key={p.id} className="flex justify-between text-gray-200">
                          <span>{p.name}</span>
                          <span className="text-accent-blue tabular-nums">{p.absences_month}</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-500">Nadie faltó ese mes.</p>
                )}
              </div>

              <div className="rounded-lg border border-base-700 p-4">
                <div className="flex items-center gap-2 mb-3 text-gray-400 text-sm font-medium">
                  <PiggyBank className="h-4 w-4 text-accent-emerald" /> Caja chica de ese mes
                </div>
                <p className="text-2xl font-semibold text-gray-100 tabular-nums">
                  ${selected.caja_chica_total.toLocaleString("es-AR")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
