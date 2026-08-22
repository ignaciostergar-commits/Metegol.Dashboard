import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parsePlayersFile } from "@/utils/parseImport";
import { useTeamStore } from "@/store/useTeamStore";

export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const importPlayers = useTeamStore((s) => s.importPlayers);
  // Mientras esto sea false, team.players en el store puede seguir siendo
  // el mock inicial (todavía no llegó el onSnapshot con los datos reales
  // de Firestore). Importar en ese estado pisa el histórico real con datos
  // de ejemplo. Bloqueamos el botón hasta que sincronice.
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
      // Reconoce tanto "Arquero" completo como abreviaturas comunes
      // ("Arq", "Medio/Arq", "Defensor/Arq", etc.), sin distinguir
      // mayúsculas/tildes.
      const hasGoalkeeper = players.some((p) =>
        (p.position ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes("arq")
      );

      await importPlayers(players, hasGoalkeeper);

      toast.success(`Se importaron ${players.length} jugadores. Ya está visible para todo el equipo.`);
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

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        // Safari/iOS resuelve "accept" contra un UTI (Uniform Type
        // Identifier) de Apple, no contra la extensión como texto plano.
        // Si el atributo trae SOLO extensiones (".xlsx", ".xls"), iOS
        // puede fallar al resolver ese UTI y no abrir ningún selector
        // -ni Fotos, ni Cámara, ni "Examinar" (que es la opción que lleva
        // a la app Archivos y de ahí a Google Drive)-, sin ningún error
        // visible. Sumar los MIME types reales le da a iOS una forma
        // confiable de resolverlo. Chrome/Edge ya funcionaban bien con
        // cualquiera de las dos formas, así que esto no les cambia nada.
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading || !teamLoaded}
        title={!teamLoaded ? "Sincronizando datos del equipo..." : undefined}
        className="inline-flex items-center gap-2 rounded-lg bg-accent-green px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-base-950 shadow-soft hover:bg-accent-emerald transition-colors disabled:opacity-60"
      >
        {loading || !teamLoaded ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UploadCloud className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">
          {loading ? "Importando..." : !teamLoaded ? "Sincronizando..." : "Importar Datos"}
        </span>
      </button>
    </>
  );
}
