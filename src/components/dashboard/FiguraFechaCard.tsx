import { Star } from "lucide-react";
import { useTeamStore } from "@/store/useTeamStore";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function FiguraFechaCard() {
  const figura = useTeamStore((s) => s.getFiguraFecha());

  return (
    <div className="relative overflow-hidden rounded-xl2 border border-accent-green/30 bg-gradient-to-br from-accent-green/10 via-base-850 to-base-850 p-5 shadow-glow">
      <div className="flex items-center gap-2 text-accent-green text-sm font-semibold">
        <Star className="h-4 w-4 fill-accent-green" />
        Figura de la Fecha
      </div>

      {figura ? (
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-green/20 text-xl font-bold text-accent-green ring-2 ring-accent-green/40">
            {figura.avatar_url ? (
              <img
                src={figura.avatar_url}
                alt={figura.name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              initials(figura.name)
            )}
          </div>
          <div>
            <p className="text-lg font-bold text-white">{figura.name}</p>
            <p className="text-xs text-gray-400">Elegido por el equipo · última fecha</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Todavía no se votó la figura de esta fecha.</p>
      )}
    </div>
  );
}
