import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

// ChatBubble design system: green primary (#22C55E), purple tertiary, white background, #F3F4F6 surfaces.
// Night follows the web app's Night theme (apps/web/src/styles/theme.css).
const DAY = {
  bg: "#FFFFFF",
  surface: "#F3F4F6", // cards, lists, inputs
  ink: "#111827", // headings, body text and dark buttons
  muted: "#4B5563",
  line: "#E5E7EB",
  green: "#14532D", // gradient start
  green2: "#166534", // gradient end
  mint: "#22C55E",
  mintSoft: "#DCFCE7",
  mintTile: "#86EFAC", // mint used as a card/tile background (dark green at night)
  halo: "#BBF7D0",
  peach: "#C084FC",
  peachSoft: "#F3E8FF",
  grey: "#E5E7EB",
  absent: "#D1D5DB",
  progress: "#16A34A",
  red: "#EF4444",
  redText: "#DC2626",
  redSoft: "#FEE2E2",
  onMint: "#052E16", // text on mint or peach: stays dark in both themes
  purple: "#9333EA", // Games group and highlights (web: --coral)
  blue: "#2563EB", // Tests group and links (web: --link)
  blueSoft: "#DBEAFE",
  chatSent: "#22C55E", // ChatBubble design spec: sent messages
  chatReceived: "#F3F4F6", // received messages
  onInk: "#FFFFFF", // text on an ink-coloured (dark button) background
  inkIcon: "#22C55E", // icon on an ink-coloured button (green at night, when the button is light)
  night: "#0C1512", // JAM screens
  nightCard: "#19211E",
  onDark: "#F0FDF4",
  onDarkMuted: "#BBF7D0",
};

const NIGHT: typeof DAY = {
  ...DAY,
  bg: "#0B0F14",
  surface: "#1F2937",
  ink: "#F9FAFB",
  muted: "#9CA3AF",
  line: "#374151",
  mintSoft: "#052E16",
  mintTile: "#166534",
  halo: "#166534",
  peachSoft: "#3B0764",
  grey: "#374151",
  absent: "#4B5563",
  progress: "#4ADE80",
  redText: "#F87171",
  redSoft: "#450A0A",
  chatReceived: "#1F2937",
  onInk: "#0B0F14",
  purple: "#D8B4FE",
  blue: "#60A5FA",
  blueSoft: "#172554",
  inkIcon: "#166534",
};

/** The live palette. Its values change in place when the theme switches; the root layout then re-renders every screen. */
export const C = { ...DAY };

export const F = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
  serif: "InstrumentSerif_400Regular_Italic",
};

export type ThemeName = "day" | "night";
const KEY = "theme";
let current: ThemeName = "day";
let version = 0;
const listeners = new Set<() => void>();

function apply(t: ThemeName) {
  if (t === current) return;
  current = t;
  Object.assign(C, t === "night" ? NIGHT : DAY);
  version++;
  listeners.forEach((l) => l());
}

export function setTheme(t: ThemeName) {
  apply(t);
  AsyncStorage.setItem(KEY, t).catch(() => {});
}

/** Restore the saved theme before the first screen draws. */
export async function loadTheme() {
  try {
    const t = await AsyncStorage.getItem(KEY);
    if (t === "day" || t === "night") apply(t);
  } catch {}
}

const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
export const useTheme = () => useSyncExternalStore(subscribe, () => current, () => current);

/**
 * Wraps a module-level style or colour table so it is rebuilt from the current palette after a theme switch.
 * Use like StyleSheet.create: `const s = themed(() => StyleSheet.create({ ... }))`; `s.card` stays the same.
 */
export function themed<T extends object>(make: () => T): T {
  let cache = make();
  let at = version;
  return new Proxy({} as T, {
    get(_, key) {
      if (at !== version) {
        cache = make();
        at = version;
      }
      return cache[key as keyof T];
    },
  });
}
