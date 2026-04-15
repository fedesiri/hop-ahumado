import { getFirebaseAuth, waitForFirebaseAuthReady } from "@/lib/firebase";

export async function getAuthHeaders(headers?: HeadersInit) {
  await waitForFirebaseAuthReady();

  const mergedHeaders = new Headers(headers);
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  const idToken = user ? await user.getIdToken() : null;

  if (!mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }

  if (idToken) {
    mergedHeaders.set("Authorization", `Bearer ${idToken}`);
  } else {
    mergedHeaders.delete("Authorization");
  }

  return mergedHeaders;
}

export async function authFetch(input: string, init: RequestInit = {}) {
  const headers = await getAuthHeaders(init.headers);
  return fetch(input, {
    ...init,
    headers,
  });
}
