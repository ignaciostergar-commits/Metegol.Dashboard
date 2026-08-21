import { create } from "zustand";
import { collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import type { TeamSnapshot } from "@/types/player";

interface HistoryStore {
  months: TeamSnapshot[]; // más reciente primero
  loaded: boolean;
}

export const useHistoryStore = create<HistoryStore>(() => ({
  months: [],
  loaded: false,
}));

const HISTORY_COL = collection(db, "history");

// Mismo patrón que useContractStore/useTeamStore/useVotingStore: este
// listener se registraba una sola vez al cargar el módulo, antes de que
// Firebase Auth resolviera la sesión. Si perdía esa carrera, quedaba
// muerto para siempre y el Historial parecía vacío para ese usuario
// aunque hubiera meses archivados. Se re-suscribe en cada cambio de uid.
let unsubHistory: (() => void) | null = null;

function subscribeHistory() {
  if (unsubHistory) {
    unsubHistory();
    unsubHistory = null;
  }
  unsubHistory = onSnapshot(
    query(HISTORY_COL, orderBy("archived_at", "desc")),
    (snap) => {
      const months = snap.docs.map((d) => {
        const data = d.data();
        const archivedAt = data.archived_at as Timestamp | undefined;
        return {
          ...data,
          archived_at_ms: archivedAt ? archivedAt.toMillis() : null,
        } as TeamSnapshot;
      });
      useHistoryStore.setState({ months, loaded: true });
    },
    () => {
      // Sin permisos, sin conexión, o todavía no existe la colección (nunca
      // se hizo un import que dispare el primer archivado): no rompemos la
      // UI, simplemente queda vacío.
      useHistoryStore.setState({ months: [], loaded: true });
    }
  );
}

subscribeHistory();

let lastUidForHistory: string | null = useAuthStore.getState().user?.uid ?? null;
useAuthStore.subscribe((state) => {
  const uid = state.user?.uid ?? null;
  if (uid !== lastUidForHistory) {
    lastUidForHistory = uid;
    subscribeHistory();
  }
});
