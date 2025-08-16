import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

function readEnv(name: string): string | undefined {
  const raw = (import.meta.env as any)[name] as string | undefined;
  if (typeof raw !== "string") return undefined;
  let value = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  return value || undefined;
}

const firebaseConfig = {
  apiKey: readEnv("VITE_FIREBASE_API_KEY"),
  authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("VITE_FIREBASE_APP_ID"),
  measurementId: readEnv("VITE_FIREBASE_MEASUREMENT_ID"),
} as const;

if (import.meta.env.DEV) {
  const mask = (v?: string) => (v ? `${v.slice(0, 6)}…` : "undefined");
  // eslint-disable-next-line no-console
  console.debug("[Firebase config]", {
    apiKey: mask(firebaseConfig.apiKey),
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
  });
}

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
  throw new Error(
    "Missing Firebase env vars. Ensure VITE_FIREBASE_* are set in a .env file at project root and restart dev server."
  );
}

// Initialize only once for Vite HMR
const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig as any);

const auth = getAuth(app);
const db = getFirestore(app);

// Persist auth state across reloads/PWA restarts
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('[Firebase] Auth persistence set to browserLocalPersistence');
  })
  .catch((error) => {
    console.warn('[Firebase] Failed to set auth persistence:', error);
    // non-blocking if persistence fails (e.g., private mode)
  });

export { app, auth, db };


