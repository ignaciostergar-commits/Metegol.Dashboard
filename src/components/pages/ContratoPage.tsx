import { useEffect, useState } from "react";
import { ShieldCheck, Pencil, Save, X } from "lucide-react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/useAuthStore";

const CONTRACT_DOC = doc(db, "contract", "main");

const DEFAULT_CONTENT = `## 1. Reglas de titularidad y disciplina
Puntualidad: llegar tarde el día del partido implica la pérdida de la titularidad en ese partido.
Ausencias: toda ausencia debe avisarse con al menos un (1) día de anticipación. Si no se avisa en ese plazo, en la próxima fecha el jugador arranca al arco (si el equipo no tiene arquero); si el equipo ya tiene arquero, invita una ronda de birras.
Tarjeta roja: el jugador expulsado invita una ronda de birras.
Acumulación de amarillas: al llegar a tres (3) tarjetas amarillas, el jugador invita una ronda de birras (no queda suspendido).

## 2. Normas de convivencia y respeto
Nada de agresividad, ni con los compañeros ni con el árbitro.
¿Bardo con un compañero? Se habla afuera de la cancha, con altura.
Al capi, al sub y al árbitro se los banca, aunque la caguen.

## 3. Para sumar en el semestre
Figura de la fecha: se vota al toque de cada partido. El que más figuritas junte en el semestre se lleva algo simbólico.
Caja chica: todos ponen una moneda fija por fecha jugada, para bancar el próximo asado o alguna previa.
Casco de la fecha: al peor blooper o gol en contra, le toca un objeto de joda que va rotando de fecha en fecha.
Ranking de asistencia: se lleva la cuenta de quién menos faltó en ese mes. El conteo se hace a fin de cada mes, en la última fecha jugada. El que gana no invita en la próxima ronda.

## 4. Vigencia
Este contrato entra en vigencia a partir de la fecha de firma y se mantiene durante toda la temporada. El capitán y subcapitán son responsables de velar por su cumplimiento.`;

function renderContent(content: string) {
  return content.split(/\n\s*\n/).map((block, i) => {
    const lines = block.split("\n").filter(Boolean);
    if (lines.length === 0) return null;
    const isHeader = lines[0].startsWith("## ");

    if (isHeader) {
      const title = lines[0].replace(/^##\s*/, "");
      return (
        <div key={i} className="mb-6 last:mb-0">
          <h3 className="text-sm font-semibold text-accent-green mb-3">{title}</h3>
          <div className="space-y-2">
            {lines.slice(1).map((line, j) => {
              const [label, ...rest] = line.split(": ");
              const hasLabel = rest.length > 0;
              return (
                <p key={j} className="text-sm text-gray-300 leading-relaxed">
                  {hasLabel && <span className="font-semibold text-gray-100">{label}: </span>}
                  {hasLabel ? rest.join(": ") : line}
                </p>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <p key={i} className="text-sm text-gray-300 leading-relaxed mb-3 last:mb-0">
        {block}
      </p>
    );
  });
}

export function ContratoPage() {
  const user = useAuthStore((s) => s.user);
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      CONTRACT_DOC,
      (snap) => {
        if (snap.exists() && typeof snap.data().content === "string") {
          setContent(snap.data().content as string);
        } else if (user?.role === "admin") {
          setDoc(CONTRACT_DOC, { content: DEFAULT_CONTENT, updatedAt: Date.now() }).catch(
            () => undefined
          );
        }
      },
      () => undefined
    );
    return unsub;
  }, [user?.role]);

  function startEdit() {
    setDraft(content);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      await setDoc(CONTRACT_DOC, { content: draft, updatedAt: Date.now() });
      setEditing(false);
      toast.success("Contrato actualizado para todos los jugadores.");
    } catch {
      toast.error("No se pudo guardar el contrato. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-3xl rounded-xl2 bg-base-850 border border-base-700 p-5 sm:p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="h-5 w-5 text-accent-green shrink-0" />
            <p className="text-sm font-semibold text-gray-400 truncate">
              Contrato de Compromiso del Equipo
            </p>
          </div>
          {user?.role === "admin" && !editing && (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-accent-green shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          )}
        </div>
        <p className="text-lg font-bold text-white mb-6">METEGOL — AREIA</p>

        {editing ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={18}
              className="w-full rounded-lg border border-base-700 bg-base-900 p-3 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-accent-green font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Usá "## Título" para empezar una sección nueva y dejá una línea en blanco entre
              secciones.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-accent-green px-3 py-1.5 text-xs font-semibold text-base-950 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 rounded-lg border border-base-700 px-3 py-1.5 text-xs text-gray-400"
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            </div>
          </div>
        ) : (
          renderContent(content)
        )}
      </div>
    </div>
  );
}
