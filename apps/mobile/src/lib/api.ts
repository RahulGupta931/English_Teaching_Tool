import { supabase } from "./supabase";

// Same FastAPI backend as the web app. On a phone, localhost is the phone itself: use your PC's LAN IP or the deployed URL.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const json = init.body && !(init.body instanceof FormData);
  const res = await fetch(API_URL + path, {
    ...init,
    headers: {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401 && token) await supabase?.auth.signOut();
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(typeof body?.detail === "string" ? body.detail : `Something went wrong (${res.status}).`, res.status);
  return body as T;
}

export const postJson = <T>(path: string, data: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(data) });

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");
