import { create } from "zustand";
import { collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
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

onSnapshot(
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
