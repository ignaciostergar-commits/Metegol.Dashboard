import { create } from "zustand";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { AppUser } from "@/types/player";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  user: null,
  loading: true,
  error: null,

  login: async (email, password) => {
    set({ error: null });
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      set({ error: "Usuario o contraseña incorrectos." });
      throw new Error("auth-failed");
    }
  },

  logout: async () => {
    await signOut(auth);
  },
}));

// Cada jugador tiene un perfil en Firestore: users/{uid} = { name, role, playerId }.
// El rol NUNCA se calcula en el cliente: se lee de ahí y las reglas de
// seguridad de Firestore (firestore.rules) son las que realmente lo hacen
// cumplir del lado del servidor.
let unsubUserDoc: (() => void) | null = null;

onAuthStateChanged(auth, (fbUser) => {
  if (unsubUserDoc) {
    unsubUserDoc();
    unsubUserDoc = null;
  }

  if (!fbUser) {
    useAuthStore.setState({ firebaseUser: null, user: null, loading: false });
    return;
  }

  useAuthStore.setState({ firebaseUser: fbUser, loading: true });

  unsubUserDoc = onSnapshot(
    doc(db, "users", fbUser.uid),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        useAuthStore.setState({
          user: {
            uid: fbUser.uid,
            email: fbUser.email ?? "",
            name: (data.name as string) ?? fbUser.email ?? "Jugador",
            role: data.role === "admin" ? "admin" : "player",
            playerId: data.playerId as string | undefined,
          },
          loading: false,
        });
      } else {
        // No tiene perfil todavía: lo tratamos como jugador de solo lectura
        // hasta que el administrador le cree su documento en users/.
        useAuthStore.setState({
          user: {
            uid: fbUser.uid,
            email: fbUser.email ?? "",
            name: fbUser.email ?? "Jugador",
            role: "player",
          },
          loading: false,
        });
      }
    },
    () => {
      useAuthStore.setState({ loading: false });
    }
  );
});
