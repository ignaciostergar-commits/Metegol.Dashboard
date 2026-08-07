import { useState } from "react";
import { Wallet, Pencil, Check, X } from "lucide-react";
import { useTeamStore } from "@/store/useTeamStore";
import { useAuthStore } from "@/store/useAuthStore";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function CajaChicaCard() {
  const total = useTeamStore((s) => s.team.caja_chica_total);
  const players = useTeamStore((s) => s.team.players);
  const updateCajaChica = useTeamStore((s) => s.setCajaChica);
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");
  const contributors = players.filter((p) => p.caja_chica_paid > 0).length;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(total));
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setDraft(String(total));
    setEditing(true);
  }

  async function save() {
    const parsed = Number(draft.replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) return;
    setSaving(true);
    try {
      await updateCajaChica(parsed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl2 bg-base-850 border border-base-700 p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400">Caja Chica</p>

          {editing ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl font-bold text-white">$</span>
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="w-32 bg-base-700 rounded-lg px-2 py-1 text-2xl font-bold text-white outline-none ring-1 ring-accent-emerald/40 focus:ring-accent-emerald"
              />
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md p-1.5 bg-accent-emerald/10 text-accent-emerald hover:bg-accent-emerald/20 disabled:opacity-50"
                aria-label="Guardar"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="rounded-md p-1.5 bg-base-700 text-gray-400 hover:text-gray-200"
                aria-label="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="mt-2 text-3xl font-bold text-white flex items-center gap-2">
              {currencyFormatter.format(total)}
              {isAdmin && (
                <button
                  onClick={startEditing}
                  className="text-gray-500 hover:text-accent-emerald transition-colors"
                  aria-label="Editar caja chica"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </p>
          )}

          <p className="mt-1 text-xs text-gray-500">
            {contributors}/{players.length} jugadores al día
          </p>
        </div>
        <div className="rounded-lg p-2.5 bg-accent-emerald/10 text-accent-emerald ring-1 ring-accent-emerald/20">
          <Wallet className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 h-2.5 rounded-full bg-base-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent-emerald transition-all"
          style={{ width: `${(contributors / Math.max(players.length, 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
