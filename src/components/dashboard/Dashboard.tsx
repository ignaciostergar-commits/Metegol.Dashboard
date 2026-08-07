import {
  ImpuntualidadesCard,
  AusenciasCard,
  TarjetasRojasCard,
} from "./CounterCards";
import { AmarillasCard } from "./AmarillasCard";
import { FiguraFechaCard } from "./FiguraFechaCard";
import { CascoBlooperCard } from "./CascoBlooperCard";
import { CajaChicaCard } from "./CajaChicaCard";
import { RankingAsistenciaTable } from "./RankingAsistenciaTable";
import { GoleadoresCard } from "./GoleadoresCard";

export function Dashboard() {
  return (
    <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 xl:grid-cols-4">
      <ImpuntualidadesCard />
      <AusenciasCard />
      <TarjetasRojasCard />
      <CajaChicaCard />

      <AmarillasCard />
      <RankingAsistenciaTable />

      <GoleadoresCard />

      <FiguraFechaCard />
      <CascoBlooperCard />
    </div>
  );
}
