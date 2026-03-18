import * as admin from "firebase-admin";
import * as fs from "node:fs";

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON_PATH;
  if (path) {
    const content = fs.readFileSync(path, "utf8");
    return JSON.parse(content);
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    // Usualmente ocurre por JSON multilínea en .env (dotenv lo recorta).
    console.error(
      "FIREBASE_SERVICE_ACCOUNT_JSON no es JSON válido. Usá FIREBASE_SERVICE_ACCOUNT_PATH en lugar de pegar el JSON en .env.",
    );
    throw e;
  }
}

// Inicializa Firebase Admin una sola vez (import singleton).
const serviceAccount = getServiceAccount();

if (!admin.apps.length) {
  if (!serviceAccount) {
    // No tiramos error en import para no romper tooling; el guard/controlador fallarán al verificar.
    console.warn("FIREBASE_SERVICE_ACCOUNT_JSON no configurado");
  } else {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
}

export const firebaseAdmin = admin;
