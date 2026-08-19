import { create } from "zustand";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import type { ContractAcceptance } from "@/types/player";

export const DEFAULT_CONTRACT_CONTENT = `## 1. Reglas de titularidad y disciplina
Puntualidad: llegar tarde el día del partido implica la pérdida de la titularidad en ese partido.
Ausencias: toda ausencia debe avisarse con al menos un (1) día de anticipación. Si no se avisa en ese plazo, en la próxima fecha el jugador arranca al arco (si el equipo no tiene arquero); si el equipo ya tiene arquero, invita una ronda de birras.
Tarjeta roja: el jugador expulsado invita una ronda de birras.
Acumulación de amarillas: al llegar a tres (3) tarjetas amarillas, el jugador invita una ronda de birras (no queda suspendido).

## 2. Normas de convivencia y respeto
Nada de agresividad, ni con los compañeros ni con el árbitro.
¿Bardo con un compañero? Se habla afuera de la cancha, con altura.
Al capi, al sub y al árbitro se los banca, aunque la caguen.

## 3. Para sumar en el semestre
Figura de la fecha: se vota al toque de cada partido. El que más figuritas junte en el semestre se lleva algo simbólico.
Caja chica: todos ponen una moneda fija por fecha jugada, para bancar el próximo asado o alguna previa.
Casco de la fecha: al peor blooper o gol en contra, le toca un objeto de joda que va rotando de fecha en fecha.
Ranking de asistencia: se lleva la cuenta de quién menos faltó en ese mes. El conteo se hace a fin de cada mes, en la última fecha jugada. El que gana no invita en la próxima ronda.

## 4. Vigencia
Este contrato entra en vigencia a partir de la fecha de firma y se mantiene durante toda la temporada. El capitán y subcapitán son responsables de velar por su cumplimiento.`;

const CONTRACT_DOC = doc(db, "contract", "main");
const ACCEPTANCES_COL = collection(db, "contractAcceptances");

interface ContractStore {
  content: string;
  version: number;
  loaded: boolean;

  // Aceptación del usuario logueado (null si nunca aceptó ninguna versión).
  myAcceptance: ContractAcceptance | null;
  myAcceptanceLoaded: boolean;

  // Solo se completa para el admin (las reglas de Firestore no dejan que un
  // jugador lea las aceptaciones de otros).
  allAcceptances: ContractAcceptance[];

  // true una vez que el usuario logueado aceptó la versión vigente.
  hasAcceptedCurrent: () => boolean;

  saveContract: (newContent: string) => Promise<void>;
  accept: () => Promise<void>;
}

export const useContractStore = create<ContractStore>((_set, get) => ({
  content: DEFAULT_CONTRACT_CONTENT,
  version: 1,
  loaded: false,
  myAcceptance: null,
  myAcceptanceLoaded: false,
  allAcceptances: [],

  hasAcceptedCurrent: () => {
    const { myAcceptance, version } = get();
    return !!myAcceptance && myAcceptance.version >= version;
  },

  saveContract: async (newContent) => {
    const { content, version } = get();
    const changed = newContent !== content;
    await setDoc(CONTRACT_DOC, {
      content: newContent,
      version: changed ? version + 1 : version,
      updatedAt: Date.now(),
    });
  },

  accept: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const { version } = get();
    await setDoc(doc(ACCEPTANCES_COL, user.uid), {
      uid: user.uid,
      email: user.email,
      name: user.name,
      version,
      acceptedAt: serverTimestamp(),
    });
  },
}));

function acceptanceFromDoc(id: string, data: Record<string, unknown>): ContractAcceptance {
  const acceptedAt = data.acceptedAt as Timestamp | undefined;
  return {
    uid: (data.uid as string) ?? id,
    email: (data.email as string) ?? "",
    name: (data.name as string) ?? "",
    version: (data.version as number) ?? 1,
    acceptedAtMs: acceptedAt ? acceptedAt.toMillis() : null,
  };
}

// Contrato vigente: en vivo para todos. Si todavía no existe el documento
// (primera vez que se usa esta funcionalidad) y quien mira es admin, lo
// sembramos con el contenido por defecto y versión 1.
onSnapshot(
  CONTRACT_DOC,
  (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      useContractStore.setState({
        content: typeof data.content === "string" ? data.content : DEFAULT_CONTRACT_CONTENT,
        version: typeof data.version === "number" ? data.version : 1,
        loaded: true,
      });
    } else {
      useContractStore.setState({ loaded: true });
      if (useAuthStore.getState().user?.role === "admin") {
        setDoc(CONTRACT_DOC, {
          content: DEFAULT_CONTRACT_CONTENT,
          version: 1,
          updatedAt: Date.now(),
        }).catch(() => undefined);
      }
    }
  },
  () => useContractStore.setState({ loaded: true })
);

// Aceptación propia: se re-suscribe cada vez que cambia el usuario logueado
// (mismo patrón que useAuthStore usa para su doc de perfil).
let unsubMyAcceptance: (() => void) | null = null;

function subscribeMyAcceptance(uid: string | null) {
  if (unsubMyAcceptance) {
    unsubMyAcceptance();
    unsubMyAcceptance = null;
  }
  if (!uid) {
    useContractStore.setState({ myAcceptance: null, myAcceptanceLoaded: true });
    return;
  }
  useContractStore.setState({ myAcceptanceLoaded: false });
  unsubMyAcceptance = onSnapshot(
    doc(ACCEPTANCES_COL, uid),
    (snap) => {
      useContractStore.setState({
        myAcceptance: snap.exists() ? acceptanceFromDoc(snap.id, snap.data()) : null,
        myAcceptanceLoaded: true,
      });
    },
    () => useContractStore.setState({ myAcceptance: null, myAcceptanceLoaded: true })
  );
}

// Todas las aceptaciones: solo el admin tiene permiso de leer la colección
// completa (ver firestore.rules), así que a un jugador esta suscripción le
// va a fallar en silencio y allAcceptances queda vacío.
let unsubAllAcceptances: (() => void) | null = null;

function subscribeAllAcceptances(isAdmin: boolean) {
  if (unsubAllAcceptances) {
    unsubAllAcceptances();
    unsubAllAcceptances = null;
  }
  if (!isAdmin) {
    useContractStore.setState({ allAcceptances: [] });
    return;
  }
  unsubAllAcceptances = onSnapshot(
    ACCEPTANCES_COL,
    (snap) => {
      useContractStore.setState({
        allAcceptances: snap.docs.map((d) => acceptanceFromDoc(d.id, d.data())),
      });
    },
    () => useContractStore.setState({ allAcceptances: [] })
  );
}

let lastUid: string | null = null;
let lastIsAdmin = false;

function syncContractSubscriptions(user: { uid: string; role: string } | null) {
  const uid = user?.uid ?? null;
  const isAdmin = user?.role === "admin";
  if (uid !== lastUid) {
    lastUid = uid;
    subscribeMyAcceptance(uid);
  }
  if (isAdmin !== lastIsAdmin) {
    lastIsAdmin = isAdmin;
    subscribeAllAcceptances(isAdmin);
  }
}

// Sincronizamos primero con el estado YA VIGENTE al cargar este módulo:
// useAuthStore.subscribe() de más abajo solo notifica cambios FUTUROS, así
// que si el usuario (p.ej. el admin) ya estaba logueado -sesión de Firebase
// persistida resuelta antes de registrar este listener-, sin esta línea
// subscribeMyAcceptance nunca se llamaría y myAcceptanceLoaded quedaría
// atascado en false para siempre, ocultando el checkbox por completo.
syncContractSubscriptions(useAuthStore.getState().user);

useAuthStore.subscribe((state) => syncContractSubscriptions(state.user));
