import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Estas claves NO son secretas (son públicas por diseño en apps de Firebase),
// pero igual las tomamos de variables de entorno para poder cambiarlas sin
// tocar código y para no tener que subir un proyecto real a este repo.
// Ver README.md -> "Configurar Firebase" para saber de dónde salen estos valores.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  // Falta configurar las variables de entorno. Ver README.md.
  // eslint-disable-next-line no-console
  console.error(
    "Falta configuración de Firebase. Copiá .env.example a .env y completá tus datos (ver README.md)."
  );
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
