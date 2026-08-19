import { useEffect, useState } from "react";
import { ShieldCheck, Pencil, Save, X, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/useAuthStore";
import { useContractStore } from "@/store/useContractStore";

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

function AcceptancePanel() {
  const user = useAuthStore((s) => s.user);
  const version = useContractStore((s) => s.version);
  const myAcceptance = useContractStore((s) => s.myAcceptance);
  const myAcceptanceLoaded = useContractStore((s) => s.myAcceptanceLoaded);
  const hasAcceptedCurrent = useContractStore((s) => s.hasAcceptedCurrent());
  const accept = useContractStore((s) => s.accept);
  const [checked, setChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    setChecked(false);
  }, [version]);

  if (!myAcceptanceLoaded) {
    return <p className="mt-4 text-xs text-gray-500">Cargando estado de aceptación...</p>;
  }
  if (hasAcceptedCurrent) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-2 text-xs text-accent-green">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        Aceptaste el contrato (versión {myAcceptance?.version}) el{" "}
        {myAcceptance?.acceptedAtMs
          ? new Date(myAcceptance.acceptedAtMs).toLocaleString("es-AR")
          : "-"}
        .
      </div>
    );
  }

  async function handleAccept() {
    if (!checked) return;
    setAccepting(true);
    try {
      await accept();
      toast.success("Contrato aceptado.");
    } catch {
      toast.error("No se pudo registrar la aceptación. Probá de nuevo.");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-warn/30 bg-warn/10 p-4">
      <p className="text-xs text-warn font-medium mb-3">
        {myAcceptance
          ? "El contrato cambió desde tu última aceptación: tenés que volver a aceptarlo."
          : "Todavía no aceptaste el contrato."}
      </p>
      <label className="flex items-start gap-2 text-sm text-gray-200 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-base-600 bg-base-900 accent-accent-green"
        />
        Declaro haber leído y aceptado el contrato.
      </label>
      <button
        onClick={handleAccept}
        disabled={!checked || accepting}
        className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent-green px-3 py-1.5 text-xs font-semibold text-base-950 disabled:opacity-50"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {accepting ? "Guardando..." : "Aceptar contrato"}
      </button>
      {user && (
        <p className="mt-2 text-[11px] text-gray-500">Se registra a nombre de {user.name}.</p>
      )}
    </div>
  );
}

function AdminAcceptancePanel() {
  const version = useContractStore((s) => s.version);
  const allAcceptances = useContractStore((s) => s.allAcceptances);

  const accepted = allAcceptances.filter((a) => a.version >= version);
  const pending = allAcceptances.filter((a) => a.version < version);

  return (
    <div className="max-w-3xl mt-4 rounded-xl2 bg-base-850 border border-base-700 p-5 sm:p-6 shadow-soft">
      <p className="text-sm font-semibold text-gray-200 mb-4">
        Aceptación del contrato (versión {version})
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-accent-green mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Aceptaron ({accepted.length})
          </p>
          {accepted.length > 0 ? (
            <ul className="space-y-1 text-sm text-gray-300">
              {accepted.map((a) => (
                <li key={a.uid}>{a.name || a.email}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500">Nadie aceptó todavía.</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-warn mb-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Pendientes ({pending.length})
          </p>
          {pending.length > 0 ? (
            <ul className="space-y-1 text-sm text-gray-300">
              {pending.map((a) => (
                <li key={a.uid}>{a.name || a.email}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500">No hay pendientes con esta versión.</p>
          )}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-gray-500">
        Esta lista solo incluye usuarios que ya aceptaron alguna versión alguna vez; los que nunca
        entraron a esta sección todavía no generan registro.
      </p>
    </div>
  );
}

export function ContratoPage() {
  const user = useAuthStore((s) => s.user);
  const content = useContractStore((s) => s.content);
  const version = useContractStore((s) => s.version);
  const saveContract = useContractStore((s) => s.saveContract);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(content);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      await saveContract(draft);
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
        <p className="text-lg font-bold text-white mb-1">METEGOL — AREIA</p>
        <p className="text-xs text-gray-500 mb-6">Versión {version}</p>

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
              secciones. Guardar un cambio sube la versión y le vuelve a pedir aceptación a todos.
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
          <>
            {renderContent(content)}
            <AcceptancePanel />
          </>
        )}
      </div>

      {user?.role === "admin" && !editing && <AdminAcceptancePanel />}
    </div>
  );
}
