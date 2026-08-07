import { useState } from "react";
import { Trophy, Shield, Pencil, Check, X } from "lucide-react";
import { useTeamStore } from "@/store/useTeamStore";
import { useAuthStore } from "@/store/useAuthStore";

export function HistorialPage() {
  const vallas = useTeamStore((s) => s.getRankingVallasInvictas());
  const setCleanSheets = useTeamStore((s) => s.setCleanSheets);
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");

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

      <div className="flex flex-col items-center justify-center rounded-xl2 bg-base-850 border border-base-700 p-12 text-center shadow-soft">
        <div className="rounded-full bg-accent-blue/10 p-4 ring-1 ring-accent-blue/20 mb-4">
          <Trophy className="h-6 w-6 text-accent-blue" />
        </div>
        <p className="text-white font-semibold">Más historial en construcción</p>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">
          Acá vas a poder ver la evolución mes a mes: rankings anteriores, figuras y caja chica
          histórica. Por ahora el dashboard guarda el mes actual, salvo las vallas invictas que
          ya se acumulan arriba.
        </p>
      </div>
    </div>
  );
}
