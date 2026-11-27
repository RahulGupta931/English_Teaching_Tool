"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabase";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// The signed-in user's Supabase access token, kept fresh by Supabase (it refreshes tokens on its own).
// undefined until the stored session has been read, null when signed out.
let accessToken: string | null | undefined = undefined;
let recoveringPassword = false;
const listeners = new Set<() => void>();
const publish = (token: string | null) => {
  accessToken = token;
  listeners.forEach((l) => l());
};
if (typeof window !== "undefined") {
  if (supabase) {
    supabase.auth.getSession().then(({ data }) => publish(data.session?.access_token ?? null));
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") recoveringPassword = true; // arrived from a "reset password" email
      publish(session?.access_token ?? null);
    });
  } else {
    publish(null);
  }
}
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const getToken = () => accessToken ?? null;

export async function signOut() {
  recoveringPassword = false;
  await supabase?.auth.signOut();
  publish(null);
}

/** undefined while rendering on the server or loading the session, null when signed out. */
export function useToken(): string | null | undefined {
  return useSyncExternalStore(subscribe, () => accessToken, () => undefined);
}

/** True after following a password-reset link, until a new password is saved. */
export function usePasswordRecovery(): boolean {
  return useSyncExternalStore(subscribe, () => recoveringPassword, () => false);
}

export function finishPasswordRecovery() {
  recoveringPassword = false;
  listeners.forEach((l) => l());
}

/** Send signed-out visitors to the home page to sign in. */
export function useRequireLogin() {
  const token = useToken();
  const router = useRouter();
  useEffect(() => {
    if (token === null) router.replace("/");
  }, [token, router]);
  return token;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const json = init.body && !(init.body instanceof FormData);
  const res = await fetch(API_URL + path, {
    ...init,
    headers: {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401 && token) await signOut(); // useRequireLogin then sends the user to sign in
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(typeof body?.detail === "string" ? body.detail : `Something went wrong (${res.status}).`, res.status);
  return body as T;
}

let meRequest: { promise: Promise<unknown>; at: number } | null = null;
const ME_REUSE_MS = 2000;
/**
 * GET /v1/me, shared: the nav bar and the page both ask on every navigation, a few ms apart, so they get one request.
 * A result is reused for 2 s only, so XP and streak still refresh on the next page visit after an activity.
 */
export function getMe<T>(): Promise<T> {
  if (!meRequest || Date.now() - meRequest.at > ME_REUSE_MS) {
    const promise = api<T>("/v1/me");
    meRequest = { promise, at: Date.now() };
    promise.catch(() => { meRequest = null; }); // never reuse a failure
  }
  return meRequest.promise as Promise<T>;
}

export const postJson = <T>(path: string, data: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(data) });

export function postAudio<T>(path: string, wav: Blob, fields: Record<string, string> = {}) {
  const form = new FormData();
  form.append("audio", wav, "recording.wav");
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  return api<T>(path, { method: "POST", body: form });
}

/** Play the server's voice if it sent one; otherwise (free plan, or TTS failed) read `text` with the browser's own voice.
 *  `onEnd` runs once when playback finishes or can't start. */
export function playAudio(base64?: string | null, text?: string, onEnd?: () => void) {
  let ended = false;
  const done = () => {
    if (!ended) onEnd?.();
    ended = true;
  };
  if (base64) {
    const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
    return;
  }
  if (!text || typeof speechSynthesis === "undefined") return done();
  speechSynthesis.cancel(); // don't queue behind a previous reply
  const speak = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = done;
    utterance.onerror = done;
    const voice = bestVoice(speechSynthesis.getVoices());
    utterance.voice = voice;
    utterance.lang = voice?.lang ?? "en-IN";
    speechSynthesis.speak(utterance);
  };
  if (speechSynthesis.getVoices().length) return speak();
  // Chrome loads its voice list after page load; wait for it briefly rather than fall back to the default voice.
  let spoken = false;
  const once = () => {
    if (spoken) return;
    spoken = true;
    speechSynthesis.removeEventListener("voiceschanged", once);
    speak();
  };
  speechSynthesis.addEventListener("voiceschanged", once);
  setTimeout(once, 600);
}

// Natural-sounding voices: Edge "Online (Natural)", Chrome "Google ...", Safari "Enhanced"/"Premium".
const NATURAL = /natural|online|neural|google|enhanced|premium/i;

/** Natural voices first (Indian English preferred), then any Indian English voice, then other English. */
function bestVoice(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = all.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("en"));
  const rank = (v: SpeechSynthesisVoice) =>
    (NATURAL.test(v.name) ? 2 : 0) + (v.lang.replace("_", "-").toLowerCase() === "en-in" ? 1 : 0);
  return english.reduce<SpeechSynthesisVoice | null>((best, v) => (!best || rank(v) > rank(best) ? v : best), null);
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");

export type Mistake = { type: string; original: string; correction: string; explanation: string; source?: string };
export type User = {
  name: string;
  level: string | null;
  xp: number;
  streak: number;
  email: string | null;
  phone: string | null;
  explain_lang: string;
  plan: { name: string; expires: string | null; azure_voice: boolean; interviews_left: number | null; upcoming: string | null };
  is_minor: boolean;
};
