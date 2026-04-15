import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type Auth } from "firebase/auth";

let authSingleton: Auth | null = null;
let authReadyPromise: Promise<Auth> | null = null;

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function getFirebaseAuth() {
  if (authSingleton) return authSingleton;

  const cfg = getFirebaseConfig();
  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) {
    throw new Error("Faltan variables de Firebase en NEXT_PUBLIC_*");
  }

  const app = getApps().length ? getApps()[0] : initializeApp(cfg);
  authSingleton = getAuth(app);
  return authSingleton;
}

export async function waitForFirebaseAuthReady() {
  const auth = getFirebaseAuth();
  if (typeof window === "undefined") return auth;

  const authWithReady = auth as Auth & { authStateReady?: () => Promise<void> };
  if (typeof authWithReady.authStateReady === "function") {
    await authWithReady.authStateReady();
    return auth;
  }

  if (!authReadyPromise) {
    authReadyPromise = new Promise<Auth>((resolve) => {
      const unsubscribe = onAuthStateChanged(
        auth,
        () => {
          unsubscribe();
          resolve(auth);
        },
        () => {
          unsubscribe();
          resolve(auth);
        },
      );
    });
  }

  await authReadyPromise;
  return auth;
}
