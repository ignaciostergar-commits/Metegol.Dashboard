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
import { useAuthStore } from "@/store/useAuthStore";
import type { Player, TeamData } from "@/types/player";
import { mockTeamData } from "@/data/mockData";

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

// AAAA-MM de una fecha, para comparar "en qué mes calendario estamos".
function periodIdFor(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Etiqueta linda para mostrar ("Agosto 2026"), generada sola a partir de
// la fecha real: nadie tiene que escribirla ni acordarse de actualizarla.
function monthLabelFor(date: Date): string {
  const label = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const useTeamStore = create<TeamStore>((_set, get) => ({
  team: mockTeamData,
  loaded: false,

  importPlayers: async (players, teamHasGoalkeeper) => {
    const { team } = get();
    const now = new Date();
    const nowPeriod = periodIdFor(now);

    // ¿Cambió el mes calendario desde el último import? Si month_key
    // todavía no existe (primerísimo import contra este Firebase) no hay
    // nada que archivar, arrancamos derecho. Si existe y es distinto al de
    // hoy, significa que el mes anterior ya cerró: lo archivamos tal cual
    // estaba, antes de pisarlo con los datos nuevos.
    const isNewMonth = !!team.month_key && team.month_key !== nowPeriod;
    if (isNewMonth && team.players.length > 0) {
      await setDoc(doc(db, "history", team.month_key as string), {
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
      month_label: monthLabelFor(now),
      month_key: nowPeriod,
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
//
// Se envuelve en una función re-suscribible porque este listener se
// registraba antes una sola vez, apenas cargaba el módulo — ANTES de que
// Firebase Auth terminara de resolver la sesión. Si esa primera conexión
// corría sin request.auth todavía disponible, Firestore la rechazaba
// (allow read: if isSignedIn()) y el listener quedaba muerto para
// siempre: el usuario se quedaba viendo el mock/datos viejos del equipo
// sin ningún error visible, aunque estuviera logueado un instante
// después. Con muchos jugadores entrando en simultáneo (lanzamiento), esa
// carrera se vuelve mucho más probable. Por eso nos re-suscribimos cada
// vez que cambia el usuario logueado, igual que ya se hace en
// useContractStore para el documento del contrato.
let unsubTeamDoc: (() => void) | null = null;

function subscribeTeamDoc() {
  if (unsubTeamDoc) {
    unsubTeamDoc();
    unsubTeamDoc = null;
  }
  unsubTeamDoc = onSnapshot(
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
}

subscribeTeamDoc();

let lastUidForTeamDoc: string | null = useAuthStore.getState().user?.uid ?? null;
useAuthStore.subscribe((state) => {
  const uid = state.user?.uid ?? null;
  if (uid !== lastUidForTeamDoc) {
    lastUidForTeamDoc = uid;
    subscribeTeamDoc();
  }
});
