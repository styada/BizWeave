import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const BASE = (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? "http://localhost:3000";
const SESSION_KEY = "bizweave_session";

/**
 * Thin API client that reuses the web app's route handlers. Auth is a session
 * cookie captured at login and replayed as a Cookie header.
 */
async function authHeader(): Promise<Record<string, string>> {
  const cookie = await SecureStore.getItemAsync(SESSION_KEY);
  return cookie ? { Cookie: cookie } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
      ...(init?.headers ?? {}),
    },
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) await SecureStore.setItemAsync(SESSION_KEY, setCookie.split(";")[0]);
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ ok: boolean }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  },
  listBusinesses: () => request<{ businesses: { id: string; name: string }[] }>("/api/businesses"),
  sendChat: (businessId: string, text: string, conversationId?: string) =>
    request<{ conversationId: string; reply: string; intent: string; taskId?: string }>(
      `/api/businesses/${businessId}/chat`,
      { method: "POST", body: JSON.stringify({ text, conversationId }) }
    ),
  registerPush: (token: string, platform: "ios" | "android") =>
    request<{ ok: boolean }>("/api/push/register", {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    }),
  hasSession: async () => !!(await SecureStore.getItemAsync(SESSION_KEY)),
};
