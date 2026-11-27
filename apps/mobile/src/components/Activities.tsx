import { router, type Href } from "expo-router";
import { AudioLines, Briefcase, ChevronRight, GraduationCap, LayoutGrid, Link2, ListChecks, MessagesSquare, Sparkles, Target, Timer, Zap, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { C, F, themed } from "@/lib/theme";
import { IconTile, Muted } from "./ui";

export type Group = "Speaking" | "Games" | "Tests";
export type Activity = { href: Href; title: string; text: string; icon: LucideIcon; group: Group; kind?: string };

/** Every practice activity: same titles and groups as the web app (apps/web/src/components/Activities.tsx). */
export const ACTIVITIES: Activity[] = [
  { href: "/roleplay", title: "AI Role-Play", text: "Job interview or everyday chat", icon: MessagesSquare, group: "Speaking", kind: "roleplay" },
  { href: "/coach", title: "Mistake Coach", text: "Fix recent mistakes, hands-free", icon: GraduationCap, group: "Speaking", kind: "coach" },
  { href: "/interview", title: "Interview Preparation", text: "Questions from your resume", icon: Briefcase, group: "Speaking" },
  { href: "/jam", title: "JAM: Just a Minute", text: "Speak for 60 seconds", icon: Timer, group: "Speaking", kind: "jam" },
  { href: "/daily-word", title: "Daily Word", text: "Today's five-letter word", icon: LayoutGrid, group: "Games", kind: "daily_word" },
  { href: "/word-chain", title: "Word Chain", text: "Last letter, next word", icon: Link2, group: "Games", kind: "word_chain" },
  { href: "/tongue-twister", title: "Tongue Twister", text: "Say it clearly and fast", icon: AudioLines, group: "Games", kind: "tongue_twister" },
  { href: "/quiz", title: "MCQ Quiz", text: "10 grammar and vocabulary questions", icon: ListChecks, group: "Tests", kind: "quiz" },
  { href: "/placement", title: "Placement Test", text: "Find your level out loud", icon: Target, group: "Tests", kind: "placement" },
];

/** One colour per group, matching web: green Speaking, purple Games, blue Tests. Read at render time (the palette changes with the theme). */
export const groupTone = (g: Group) => ({
  Speaking: { bg: C.mint, fg: C.onMint, blob: C.mint },
  Games: { bg: C.peachSoft, fg: C.purple, blob: C.purple },
  Tests: { bg: C.blueSoft, fg: C.blue, blob: C.blue },
})[g];

/** Icon for each activity kind the API records, for history and score rows. */
export const KIND_ICON: Record<string, LucideIcon> = {
  roleplay: MessagesSquare, coach: GraduationCap, jam: Timer, daily_word: LayoutGrid, daily_word_bonus: Sparkles,
  word_chain: Link2, tongue_twister: AudioLines, quiz: ListChecks, placement: Target,
};
export const kindIcon = (k: string) => KIND_ICON[k] ?? Zap;

/** Slow drifting colour blob behind a card's content. Still for anyone who turned on Reduce Motion. */
export function DriftBlob({ color }: { color: string }) {
  const [t] = useState(() => new Animated.Value(0)); // created once; state, not a ref, so render can read it
  const [still, setStill] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [still, t]);
  const translateX = t.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0, -14, 6, 0] });
  const translateY = t.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0, 10, -8, 0] });
  return <Animated.View pointerEvents="none" style={[s.blob, { backgroundColor: color, transform: [{ translateX }, { translateY }] }]} />;
}

/** Practice card: group-coloured icon, title, short text, optional best-score line, drifting blob. `full` makes it span the row. */
export function ActivityCard({ a, meta, full, style }: { a: Activity; meta?: string; full?: boolean; style?: StyleProp<ViewStyle> }) {
  const tone = groupTone(a.group);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${a.title}. ${a.text}`} onPress={() => router.push(a.href)}
      style={({ pressed }) => [s.card, full && { width: "100%" }, pressed && { opacity: 0.85 }, style]}>
      <DriftBlob color={tone.blob} />
      <View style={s.topRow}>
        <IconTile icon={a.icon} bg={tone.bg} color={tone.fg} size={40} />
        <View style={s.chevron}><ChevronRight size={16} color={C.muted} /></View>
      </View>
      <Text style={s.title} numberOfLines={2}>{a.title}</Text>
      <Muted numberOfLines={2} style={{ fontSize: 13 }}>{a.text}</Muted>
      {meta && <Text style={s.meta}>{meta}</Text>}
    </Pressable>
  );
}

const s = themed(() => StyleSheet.create({
  card: { width: "48%", flexGrow: 1, backgroundColor: C.surface, borderRadius: 20, padding: 14, gap: 4, overflow: "hidden" },
  blob: { position: "absolute", top: -40, right: -40, width: 130, height: 130, borderRadius: 65, opacity: 0.16 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  chevron: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  meta: { fontFamily: F.semibold, fontSize: 12, color: C.muted, marginTop: 4 },
}));
