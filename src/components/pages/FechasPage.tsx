import { useEffect, useMemo, useState } from "react";
import { Calendar, Plus, Square, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/useAuthStore";
import { useMatchesStore } from "@/store/useMatchesStore";
import { ImportarFechaButton } from "@/components/ImportarFechaButton";
import { FiguraCascoFecha } from "@/components/FiguraCascoFecha";

// Bloque 1: crear / listar / seleccionar / cerrar fechas.
// Bloque 2: importar el Excel asociado a la fecha seleccionada.
// Bloque 3: Figura y Casco de la fecha seleccionada.
// Sin historial detallado todavía -eso llega en el Bloque 4.

function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function NuevaFechaForm() {
  const matches = useMatchesStore((s) => s.matches);
  const matchesLoaded = useMatchesStore((s) => s.matchesLoaded);
  const createMatch = useMatchesStore((s) => s.createMatch);
  const selectMatch = useMatchesStore((s) => s.selectMatch);

  const suggestedNumber = useMemo(() => {
    if (matches.length === 0) return 1;
    return Math.max(...matches.map((m) => m.number)) + 1;
  }, [matches]);

  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (matchesLoaded && number === "") {
      setNumber(String(suggestedNumber));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchesLoaded]);

  const numberAlreadyVisible = matches.some((m) => m.number === Number(number));

  async function handleCreate() {
    const parsedNumber = Number(number);
    if (!Number.isInteger(parsedNumber) || parsedNumber <= 0 || !date) {
      toast.error("Completá un número de fecha válido y la fecha del partido.");
      return;
    }
    setCreating(true);
    try {
      const matchId = await createMatch(parsedNumber, date);
      selectMatch(matchId);
      toast.success(`Fecha ${parsedNumber} creada.`);
      setNumber("");
      setDate("");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[fechas] no se pudo crear la fecha:", err);
      const message = err instanceof Error ? err.message : "";
      const code = (err as { code?: string })?.code;
      if (message === "number-already-exists") {
        toast.error(`Ya existe la Fecha ${parsedNumber}. Elegí otro número.`);
      } else if (code === "permission-denied") {
        toast.error(
          "No se pudo crear la fecha: faltan permisos. Verificá que firestore.rules esté publicado en Firebase Console."
        );
      } else {
        toast.error("No se pudo crear la fecha. Probá de nuevo.");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rounded-xl2 bg-base-850 border border-base-700 p-5 shadow-soft">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-4 w-4 text-accent-green" />
        <p className="text-sm font-semibold text-gray-200">Nueva Fecha</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto] sm:items-end">
        <div>
          <label className="text-xs font-medium text-gray-400">Número</label>
          <input
            type="number"
            min={1}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="mt-1 w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-accent-green"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-400">Fecha del partido</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-accent-green"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || !number || !date}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-accent-green px-4 py-2 text-sm font-semibold text-base-950 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {creating ? "Creando..." : "Crear"}
        </button>
      </div>

      {numberAlreadyVisible && (
        <p className="mt-2 text-xs text-warn">
          Ya hay una fecha con ese número en la lista de abajo -elegí otro.
        </p>
      )}
    </div>
  );
}

function FechasList() {
  const matches = useMatchesStore((s) => s.matches);
  const matchesLoaded = useMatchesStore((s) => s.matchesLoaded);
  const selectedMatchId = useMatchesStore((s) => s.selectedMatchId);
  const selectMatch = useMatchesStore((s) => s.selectMatch);

  if (!matchesLoaded) {
    return <p className="text-sm text-gray-500">Cargando...</p>;
  }

  if (matches.length === 0) {
    return (
      <p className="text-sm text-gray-500">Todavía no se creó ninguna fecha.</p>
    );
  }

  return (
    <div className="rounded-xl2 bg-base-850 border border-base-700 shadow-soft overflow-x-auto">
      <table className="w-full text-sm min-w-[420px]">
        <thead>
          <tr className="text-left text-gray-500 border-b border-base-700">
            <th className="px-4 py-2.5 font-medium">Fecha</th>
            <th className="px-4 py-2.5 font-medium">Día</th>
            <th className="px-4 py-2.5 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => {
            const active = m.id === selectedMatchId;
            return (
              <tr
                key={m.id}
                onClick={() => selectMatch(m.id)}
                className={`cursor-pointer border-b border-base-700/60 last:border-0 transition-colors ${
                  active ? "bg-accent-green/10" : "hover:bg-base-800"
                }`}
              >
                <td className="px-4 py-2.5 font-medium text-gray-100">Fecha {m.number}</td>
                <td className="px-4 py-2.5 text-gray-300">{formatDate(m.date)}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-lg ${
                      m.status === "open"
                        ? "bg-accent-green/10 text-accent-green"
                        : "bg-base-700 text-gray-400"
                    }`}
                  >
                    {m.status === "open" ? "Abierta" : "Cerrada"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FechaDetalle() {
  const user = useAuthStore((s) => s.user);
  const matches = useMatchesStore((s) => s.matches);
  const selectedMatchId = useMatchesStore((s) => s.selectedMatchId);
  const closeMatch = useMatchesStore((s) => s.closeMatch);
  const [closing, setClosing] = useState(false);

  const selected = matches.find((m) => m.id === selectedMatchId);

  if (!selected) {
    return (
      <div className="rounded-xl2 bg-base-850 border border-base-700 p-5 shadow-soft">
        <p className="text-sm text-gray-500">Elegí una fecha de la lista para ver el detalle.</p>
      </div>
    );
  }

  async function handleClose() {
    if (!selected) return;
    setClosing(true);
    try {
      await closeMatch(selected.id);
      toast.success(`Fecha ${selected.number} cerrada.`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[fechas] no se pudo cerrar la fecha:", err);
      const code = (err as { code?: string })?.code;
      toast.error(
        code === "permission-denied"
          ? "No se pudo cerrar la fecha: faltan permisos. Verificá que firestore.rules esté publicado en Firebase Console."
          : "No se pudo cerrar la fecha."
      );
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="rounded-xl2 bg-base-850 border border-base-700 p-5 shadow-soft space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent-green" />
          <p className="text-sm font-semibold text-gray-200">Fecha {selected.number}</p>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-lg ${
            selected.status === "open"
              ? "bg-accent-green/10 text-accent-green"
              : "bg-base-700 text-gray-400"
          }`}
        >
          {selected.status === "open" ? "Abierta" : "Cerrada"}
        </span>
      </div>

      <p className="text-sm text-gray-300">Día del partido: {formatDate(selected.date)}</p>

      {user?.role === "admin" && selected.status === "open" && (
        <div>
          <button
            onClick={handleClose}
            disabled={closing}
            className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            <Square className="h-3.5 w-3.5" /> Cerrar fecha
          </button>
          <p className="mt-2 text-[11px] text-gray-500">
            Una vez cerrada, esta fecha queda bloqueada -no se puede reabrir todavía.
          </p>
        </div>
      )}

      {user?.role === "admin" && (
        <div className="border-t border-base-700 pt-4">
          <ImportarFechaButton
            matchId={selected.id}
            number={selected.number}
            disabled={selected.status !== "open"}
          />
          {selected.status !== "open" && (
            <p className="mt-2 text-[11px] text-gray-500">
              Esta fecha está cerrada: no admite nuevas importaciones.
            </p>
          )}
        </div>
      )}

      <div className="border-t border-base-700 pt-4">
        <FiguraCascoFecha matchId={selected.id} match={selected} />
      </div>
    </div>
  );
}

export function FechasPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="max-w-2xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
          <Calendar className="h-5 w-5 text-accent-green" /> Fechas
        </h2>
        <p className="text-sm text-gray-500">
          Cada fecha del torneo queda separada, con su propio historial.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 max-w-5xl">
        <div className="space-y-5">
          {user?.role === "admin" && <NuevaFechaForm />}
          <FechasList />
        </div>
        <FechaDetalle />
      </div>
    </div>
  );
}
