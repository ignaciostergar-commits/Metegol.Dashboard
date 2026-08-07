import { useTeamStore } from "@/store/useTeamStore";

export function JugadoresPage() {
  const players = useTeamStore((s) => s.team.players);

  return (
    <div className="p-6">
      <div className="rounded-xl2 bg-base-850 border border-base-700 p-5 shadow-soft overflow-x-auto">
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-400">Plantel completo</p>
          <p className="text-xs text-gray-500 mt-0.5">{players.length} jugadores cargados</p>
        </div>

        <table className="w-full text-sm min-w-[840px]">
          <thead>
            <tr className="text-left text-gray-500 border-b border-base-700">
              <th className="pb-2 font-medium">Jugador</th>
              <th className="pb-2 font-medium text-right">Tarde</th>
              <th className="pb-2 font-medium text-right">Ausencias</th>
              <th className="pb-2 font-medium text-right">Rojas</th>
              <th className="pb-2 font-medium text-right">Amarillas</th>
              <th className="pb-2 font-medium text-right">Partidos (mes)</th>
              <th className="pb-2 font-medium text-right">Goles</th>
              <th className="pb-2 font-medium text-right">Vallas invictas</th>
              <th className="pb-2 font-medium text-right">Caja chica</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b border-base-700/60 last:border-0">
                <td className="py-2.5 text-gray-200 font-medium whitespace-nowrap">
                  {p.name}
                  {p.is_figura_fecha && <span className="ml-2 text-xs text-accent-green">★ figura</span>}
                  {p.has_blooper && <span className="ml-2 text-xs text-warn">🪖 casco</span>}
                  {p.is_valla_invicta_fecha && (
                    <span className="ml-2 text-xs text-accent-blue">🧤 valla invicta</span>
                  )}
                  {p.is_hat_trick_fecha && (
                    <span className="ml-2 text-xs text-accent-green">⚽ hat-trick</span>
                  )}
                </td>
                <td className="py-2.5 text-right tabular-nums text-gray-300">{p.late_arrivals}</td>
                <td className="py-2.5 text-right tabular-nums text-gray-300">
                  {p.undisclosed_absences}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  <span className={p.red_cards > 0 ? "text-danger" : "text-gray-300"}>
                    {p.red_cards}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  <span
                    className={
                      p.yellow_cards >= 3
                        ? "text-danger"
                        : p.yellow_cards === 2
                        ? "text-warn"
                        : "text-gray-300"
                    }
                  >
                    {p.yellow_cards}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums text-gray-300">
                  {p.matches_played_month}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  <span className={p.goals_month > 0 ? "text-accent-green" : "text-gray-500"}>
                    {p.goals_month}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  <span className={p.clean_sheets_total > 0 ? "text-accent-blue" : "text-gray-500"}>
                    {p.clean_sheets_total}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  <span className={p.caja_chica_paid > 0 ? "text-accent-green" : "text-gray-500"}>
                    ${p.caja_chica_paid.toLocaleString("es-AR")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
