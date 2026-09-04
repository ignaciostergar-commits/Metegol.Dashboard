import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { detectHasGoalkeeper, parsePlayersFile } from "@/utils/parseImport";
import { useTeamStore } from "@/store/useTeamStore";
import { useMatchesStore } from "@/store/useMatchesStore";

interface ImportarFechaButtonProps {
  matchId: string;
  number: number;
  disabled?: boolean;
}

// Botón de importación específico de UNA fecha (Bloque 2). NO reemplaza a
// ImportButton.tsx (que sigue en el header, sin tocar, actualizando
// team/main de forma global sin ningún concepto de fecha): este es un
// botón nuevo y separado que hace las DOS cosas -actualiza team/main
// igual que siempre, llamando a la MISMA acción useTeamStore.importPlayers()
// sin modificarla, Y ADEMÁS guarda los datos de esa fecha puntual en
// matches/{matchId}/playerStats/*.
//
// El matchId llega por props, capturado en el closure de este componente
// en el momento en que se renderiza para ESA fecha seleccionada -por eso
// una importación de Fecha 7 nunca puede terminar escribiendo en Fecha 8,
// aunque el admin seleccione otra fecha mientras la importación está en
// curso: el handler ya arrancado sigue apuntando al matchId original.
export function ImportarFechaButton({ matchId, number, disabled }: ImportarFechaButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const importPlayers = useTeamStore((s) => s.importPlayers);
  const importMatchPlayerStats = useMatchesStore((s) => s.importMatchPlayerStats);
  // Mismo gate que ImportButton.tsx: mientras esto sea false, team.players
  // en el store puede seguir siendo el mock inicial -importar en ese
  // estado pisaría el histórico real con datos de ejemplo.
  const teamLoaded = useTeamStore((s) => s.loaded);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!teamLoaded) {
      toast.error(
        "Todavía se están sincronizando los datos del equipo. Esperá unos segundos y volvé a intentar."
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setLoading(true);
    try {
      const { players, missingColumns } = await parsePlayersFile(file);
      if (players.length === 0) {
        toast.error("No se encontraron jugadores en el archivo.");
        return;
      }
      const hasGoalkeeper = detectHasGoalkeeper(players);

      // Paso 1: team/main, igual que el importador de siempre. Si esto
      // falla, no se intenta el paso 2 -no tiene sentido guardar datos de
      // la fecha si el Dashboard ni siquiera se actualizó.
      try {
        await importPlayers(players, hasGoalkeeper);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[fecha ${number}] no se pudo actualizar team/main:`, err);
        toast.error("No se pudo actualizar el Dashboard. La Fecha tampoco se modificó. Probá de nuevo.");
        return;
      }

      // Paso 2: playerStats de esta fecha puntual. Si esto falla, el
      // Dashboard YA se actualizó -el mensaje tiene que dejarlo clarísimo,
      // nunca mostrar éxito genérico acá.
      try {
        await importMatchPlayerStats(matchId, players);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[fecha ${number}] no se pudo guardar playerStats:`, err);
        const message = err instanceof Error ? err.message : "";
        const code = (err as { code?: string })?.code;
        if (message === "import-in-progress") {
          toast.error(
            `Ya hay otra importación en curso para la Fecha ${number}. Esperá a que termine y volvé a intentar.`,
            { duration: 10000 }
          );
        } else if (message === "match-closed" || code === "permission-denied") {
          toast.error(`La Fecha ${number} está cerrada -no se puede importar.`, { duration: 10000 });
        } else {
          toast.error(
            `El Dashboard se actualizó, pero los datos de la Fecha ${number} NO se pudieron guardar. ` +
              `Volvé a importar el mismo Excel en esta Fecha para reintentarlo -no hace falta tocar el Dashboard de nuevo.`,
            { duration: 10000 }
          );
        }
        return;
      }

      toast.success(`Fecha ${number}: Dashboard y datos de la fecha actualizados correctamente.`);
      if (missingColumns.length > 0) {
        toast.warning(
          `Ojo: el archivo no tenía estas columnas (quedaron en 0): ${missingColumns.join(", ")}`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al importar el archivo.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const isDisabled = disabled || loading || !teamLoaded;

  return (
    <>
      <input
        ref={inputRef}
        id={`import-fecha-input-${matchId}`}
        type="file"
        // Mismos MIME types que ImportButton.tsx: en iOS, "accept" se
        // resuelve contra un UTI de Apple, no contra la extensión como
        // texto plano -sin esto el selector de archivos puede no abrir.
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={handleFileChange}
      />
      <label
        htmlFor={`import-fecha-input-${matchId}`}
        aria-disabled={isDisabled}
        title={
          disabled
            ? "Esta fecha está cerrada"
            : !teamLoaded
            ? "Sincronizando datos del equipo..."
            : undefined
        }
        onClick={(e) => {
          if (isDisabled) e.preventDefault();
        }}
        className={`inline-flex items-center gap-2 rounded-lg bg-accent-green px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-base-950 shadow-soft transition-colors ${
          isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-accent-emerald"
        }`}
      >
        {loading || !teamLoaded ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UploadCloud className="h-4 w-4" />
        )}
        <span>
          {loading
            ? "Importando..."
            : !teamLoaded
            ? "Sincronizando..."
            : `Importar Excel para Fecha ${number}`}
        </span>
      </label>
    </>
  );
}
