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

  const disabled = loading || !teamLoaded;

  return (
    <>
      <input
        ref={inputRef}
        id="import-file-input"
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
        // sr-only (en vez de "hidden"/display:none): mantiene al input con
        // layout real en el árbol de render, solo invisible por CSS
        // (position absolute + tamaño 1px + overflow hidden). iOS Safari
        // puede ignorar en silencio un click programático
        // (inputRef.current?.click()) sobre un input con display:none, por
        // no haber tenido nunca presencia real en el render tree. Con
        // sr-only + activación nativa por <label htmlFor>, la apertura del
        // selector queda a cargo del navegador como parte directa del
        // mismo gesto táctil, sin depender de que WebKit "honre" un click
        // sintético.
        className="sr-only"
        onChange={handleFileChange}
      />
      {/*
        Antes: <button onClick={() => inputRef.current?.click()}>.
        Ahora: <label htmlFor="import-file-input">. Un <label> asociado a
        un input por htmlFor/id dispara la activación del input de forma
        nativa al tocarlo -no vía JavaScript-, que es el mecanismo más
        confiable en iOS Safari para abrir el selector de archivos.

        <label> no tiene atributo "disabled" nativo, así que el gate de
        loading/teamLoaded se replica a mano: mientras "disabled" es true,
        se evita la apertura del input con preventDefault en el propio
        click del label (además de las clases visuales/aria que ya tenía
        el <button>). El aspecto visual queda idéntico al botón anterior.
      */}
      <label
        htmlFor="import-file-input"
        aria-disabled={disabled}
        title={!teamLoaded ? "Sincronizando datos del equipo..." : undefined}
        onClick={(e) => {
          if (disabled) e.preventDefault();
        }}
        className={`inline-flex items-center gap-2 rounded-lg bg-accent-green px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-base-950 shadow-soft transition-colors ${
          disabled
            ? "opacity-60 cursor-not-allowed"
            : "cursor-pointer hover:bg-accent-emerald"
        }`}
      >
        {loading || !teamLoaded ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UploadCloud className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">
          {loading ? "Importando..." : !teamLoaded ? "Sincronizando..." : "Importar Datos"}
        </span>
      </label>
    </>
  );
}
