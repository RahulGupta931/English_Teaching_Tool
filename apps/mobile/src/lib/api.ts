import { Platform } from "react-native";

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
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      ...init,
      headers: {
        ...(json ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your internet connection and try again.", 0);
  }
  if (res.status === 401 && token) await supabase?.auth.signOut(); // the app then shows the sign-in screen
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(typeof body?.detail === "string" ? body.detail : `Something went wrong (${res.status}).`, res.status);
  return body as T;
}

export const postJson = <T>(path: string, data: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(data) });

/** Upload files (recordings, resume) as multipart form fields; React Native sends a local file from its uri,
 *  the browser needs the bytes as a Blob. */
export async function postFiles<T>(path: string, files: Record<string, { uri: string; name: string; type: string }>, fields: Record<string, string> = {}) {
  const form = new FormData();
  for (const [k, f] of Object.entries(files)) {
    if (Platform.OS === "web") form.append(k, await (await fetch(f.uri)).blob(), f.name);
    else form.append(k, f as unknown as Blob);
  }
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  return api<T>(path, { method: "POST", body: form });
}

export const wavPart = (uri: string) => ({ uri, name: "recording.wav", type: "audio/wav" });
export const postAudio = <T>(path: string, uri: string, fields: Record<string, string> = {}) =>
  postFiles<T>(path, { audio: wavPart(uri) }, fields);

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");

export type Mistake = { type: string; original: string; correction: string; explanation: string; source?: string };
export type User = {
  name: string;
  level: string | null;
  xp: number;
  streak: number;
  email: string | null;
  phone: string | null;
  explain_lang: "english" | "hinglish";
  plan: { name: string; expires: string | null; azure_voice: boolean; interviews_left: number | null; upcoming: string | null };
  is_minor: boolean;
};
export type Me = {
  user: User;
  activities: { kind: string; score: number | null; xp: number; created_at: string }[];
  mistakes: Mistake[];
  best: Record<string, number>;
  speaking_seconds_today: number;
  speaking_limit_seconds: number;
};
