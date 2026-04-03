import { config } from "dotenv";
import { isAbsolute, resolve } from "node:path";

// En runtime este archivo vive en dist/; un nivel arriba es siempre la raíz del paquete apps/api
// (misma carpeta que .env y firebase-service-account.json), sin depender del cwd.
const apiRoot = resolve(__dirname, "..");

config({ path: resolve(apiRoot, ".env") });

const pathToKey = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (pathToKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = isAbsolute(pathToKey) ? pathToKey : resolve(apiRoot, pathToKey);
}
