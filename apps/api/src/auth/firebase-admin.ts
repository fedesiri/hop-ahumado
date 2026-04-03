import * as admin from "firebase-admin";

// Siempre Application Default Credentials (ADC): en local suele venir del JSON indicado por
// GOOGLE_APPLICATION_CREDENTIALS (o FIREBASE_SERVICE_ACCOUNT_PATH en .env, ver load-env.ts).
// En Cloud Run: cuenta de servicio del servicio (sin archivo en disco).
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (e) {
    console.warn(
      "Firebase Admin: no se pudo inicializar con ADC. En apps/api/.env definí " +
        "FIREBASE_SERVICE_ACCOUNT_PATH (ruta al JSON de la cuenta de servicio, fuera del repo) " +
        "o GOOGLE_APPLICATION_CREDENTIALS. En Cloud Run, revisá la cuenta de servicio del servicio.",
      e,
    );
  }
}

export const firebaseAdmin = admin;
