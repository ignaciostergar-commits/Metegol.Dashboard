import { create } from "zustand";
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Player, TeamData } from "@/types/player";
import { mockTeamData } from "@/data/mockData";
import { slugify } from "@/utils/slug";

interface TeamStore {
  team: TeamData;
  loaded: boolean;

  // Solo deben invocarse desde UI de administrador; igual quedan
  // bloqueadas del lado del servidor por firestore.rules.
  importPlayers: (players: Player[], teamHasGoalkeeper?: boolean) => Promise<void>;
  updateCajaChica: (amount: number) => Promise<void>;
  setCajaChica: (total: number) => Promise<void>;

  // selectores derivados
  getPlayerById: (id: string | undefined) => Player | undefined;
  getFiguraFecha: () => Player | undefined;
  getBlooperFecha: () => Player | undefined;
  getRankingAsistenciaMes: () => Player[];
  getRankingGoleadores: () => Player[];
  getRankingVallasInvictas: () => Player[];
  setCleanSheets: (playerId: string, total: number) => Promise<void>;
}

const TEAM_DOC = doc(db, "team", "main");

// Para emparejar un jugador importado con el que ya estaba guardado (y así
// no perder su contador histórico) comparamos por nombre normalizado, no
// por id: cada importación de Excel puede regenerar los ids.
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// Id determinístico para el documento de historial de un mes: usa la
// etiqueta del mes (p.ej. "Agosto 2026" -> "agosto-2026") para que quede
// legible en Firestore, y si no hay etiqueta cargada, cae a AAAA-MM según
// la fecha del momento en que se archiva.
function historyIdFor(monthLabel: string): string {
  const slug = slugify(monthLabel);
  if (slug) return slug;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const useTeamStore = create<TeamStore>((_set, get) => ({
  team: mockTeamData,
  loaded: false,

  importPlayers: async (players, teamHasGoalkeeper) => {
    const { team } = get();

    // Antes de pisar el mes actual con los datos nuevos, lo archivamos tal
    // cual estaba: eso es lo que va a aparecer en "Historial" como un mes
    // ya cerrado. Si no hay jugadores todavía (primera importación contra
    // un Firebase recién armado, con el mock inicial), no hay nada real
    // que archivar y nos lo salteamos.
    if (team.players.length > 0) {
      const historyId = historyIdFor(team.month_label);
      await setDoc(doc(db, "history", historyId), {
        ...team,
        archived_at: serverTimestamp(),
      });
    }

    const previousByName = new Map(team.players.map((p) => [normalizeName(p.name), p]));

    // El contador histórico de vallas invictas no se pisa con cada import:
    // si el arquero viene marcado "valla invicta" en esta fecha, se le
    // suma 1 al total que ya tenía guardado.
    const mergedPlayers = players.map((p) => {
      const previous = previousByName.get(normalizeName(p.name));
      const previousCleanSheets = previous?.clean_sheets_total ?? 0;
      return {
        ...p,
        clean_sheets_total: p.is_valla_invicta_fecha
          ? previousCleanSheets + 1
          : previousCleanSheets,
      };
    });

    const cajaChicaTotal = mergedPlayers.reduce(
      (sum, player) => sum + (player.caja_chica_paid || 0),
      0
    );

    const updated: TeamData = {
      ...team,
      players: mergedPlayers,
      team_has_goalkeeper: teamHasGoalkeeper ?? team.team_has_goalkeeper,
      caja_chica_total: cajaChicaTotal,
    };
    await setDoc(TEAM_DOC, updated, { merge: true });
  },

  updateCajaChica: async (amount) => {
    const { team } = get();
    await updateDoc(TEAM_DOC, { caja_chica_total: team.caja_chica_total + amount });
  },

  // Fija el saldo de la caja chica a un monto exacto (a diferencia de
  // updateCajaChica, que suma/resta un delta). Lo usa el botón de editar
  // en CajaChicaCard.
  setCajaChica: async (total) => {
    await updateDoc(TEAM_DOC, { caja_chica_total: total });
  },

  getPlayerById: (id) => {
    if (!id) return undefined;
    return get().team.players.find((p) => p.id === id);
  },

  getFiguraFecha: () => {
    const { team } = get();
    return team.players.find((p) => p.is_figura_fecha);
  },

  getBlooperFecha: () => {
    const { team } = get();
    return team.players.find((p) => p.has_blooper);
  },

  getRankingAsistenciaMes: () => {
    const { team } = get();
    return [...team.players].sort((a, b) => a.absences_month - b.absences_month);
  },

  getRankingGoleadores: () => {
    const { team } = get();
    return [...team.players]
      .filter((p) => p.goals_month > 0)
      .sort((a, b) => b.goals_month - a.goals_month);
  },

  getRankingVallasInvictas: () => {
    const { team } = get();
    return [...team.players]
      .filter((p) => p.clean_sheets_total > 0)
      .sort((a, b) => b.clean_sheets_total - a.clean_sheets_total);
  },

  // Corrige a mano el contador histórico de un jugador puntual (por si
  // quedó mal, p.ej. arrastrado de los datos de ejemplo iniciales). El
  // import normal nunca pisa este número, solo lo suma; esto es la única
  // vía para bajarlo o corregirlo.
  setCleanSheets: async (playerId, total) => {
    const { team } = get();
    const updatedPlayers = team.players.map((p) =>
      p.id === playerId ? { ...p, clean_sheets_total: total } : p
    );
    await updateDoc(TEAM_DOC, { players: updatedPlayers });
  },
}));

// Escucha en vivo: cualquier cambio que haga el administrador (import de
// Excel, ajuste de caja chica, etc.) se refleja al instante en todas las
// pantallas abiertas, sin recargar ni volver a iniciar sesión.
onSnapshot(
  TEAM_DOC,
  (snap) => {
    if (snap.exists()) {
      useTeamStore.setState({ team: snap.data() as TeamData, loaded: true });
    } else {
      // Primera vez que corre el proyecto contra este Firebase: sembramos
      // el documento con los datos de ejemplo para no arrancar vacío.
      //
      // OJO: esto va dentro de una transacción para evitar una condición
      // de carrera. Antes se hacía un setDoc() suelto (sin esperar), y si
      // alguien importaba un Excel real casi al mismo tiempo, esa siembra
      // podía llegar al servidor DESPUÉS del import real y pisarlo con los
      // datos de ejemplo ("gana el último que escribe"). La transacción
      // vuelve a chequear, en el mismo instante de guardar, si el
      // documento sigue sin existir; si alguien ya escribió datos reales
      // mientras tanto, Firestore reintenta la transacción sola, la ve
      // existente y no siembra nada.
      runTransaction(db, async (tx) => {
        const fresh = await tx.get(TEAM_DOC);
        if (!fresh.exists()) {
          tx.set(TEAM_DOC, mockTeamData);
        }
      }).catch(() => {
        /* si falla (p.ej. reglas de seguridad), no rompemos la UI */
      });
      useTeamStore.setState({ team: mockTeamData, loaded: true });
    }
  },
  () => {
    // Sin permisos o sin conexión: seguimos mostrando lo último conocido.
    useTeamStore.setState({ loaded: true });
  }
);
