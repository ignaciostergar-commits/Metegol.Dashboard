import { HardHat } from "lucide-react";
import { useTeamStore } from "@/store/useTeamStore";

export function CascoBlooperCard() {
  const blooper = useTeamStore((s) => s.getBlooperFecha());

  return (
    <div className="relative overflow-hidden rounded-xl2 border border-warn/30 bg-gradient-to-br from-warn/10 via-base-850 to-base-850 p-5 shadow-soft">
      <div className="flex items-center gap-2 text-warn text-sm font-semibold">
        <HardHat className="h-4 w-4" />
        El Casco / Blooper de la Fecha
      </div>

      {blooper ? (
        <div className="mt-4">
          <p className="text-lg font-bold text-white">{blooper.name}</p>
          <p className="text-xs text-gray-400 mt-1">
            Le toca cargar el casco hasta la próxima fecha 🪖
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Nadie se lo ganó todavía esta fecha.</p>
      )}
    </div>
  );
}
