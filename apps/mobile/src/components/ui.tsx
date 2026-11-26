import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight, X, Zap, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import type { Mistake } from "@/lib/api";
import { C, F } from "@/lib/theme";

type Kids = { children?: ReactNode };

/** Page background + safe area. `scroll` for long pages; `footer` stays pinned at the bottom. */
export function Screen({ children, scroll, footer, dark, style }: Kids & { scroll?: boolean; footer?: ReactNode; dark?: boolean; style?: StyleProp<ViewStyle> }) {
  const bg = dark ? C.night : C.bg;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={["top", "bottom"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={[s.page, style]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      ) : (
        <View style={[s.page, { flex: 1 }, style]}>{children}</View>
      )}
      {footer && <View style={s.footer}>{footer}</View>}
    </SafeAreaView>
  );
}

type TxtProps = Kids & { style?: StyleProp<TextStyle>; numberOfLines?: number };
export const H1 = ({ children, style }: TxtProps) => <Text style={[s.h1, style]}>{children}</Text>;
export const H2 = ({ children, style }: TxtProps) => <Text style={[s.h2, style]}>{children}</Text>;
export const Title = ({ children, style, numberOfLines }: TxtProps) => <Text numberOfLines={numberOfLines} style={[s.title, style]}>{children}</Text>;
export const Body = ({ children, style }: TxtProps) => <Text style={[s.body, style]}>{children}</Text>;
export const Muted = ({ children, style, numberOfLines }: TxtProps) => <Text numberOfLines={numberOfLines} style={[s.muted, style]}>{children}</Text>;
export const Label = ({ children, style }: TxtProps) => <Text style={[s.label, style]}>{children}</Text>;
/** The italic serif accent word in headlines ("with *confidence*"). */
export const Em = ({ children, style }: TxtProps) => <Text style={[s.em, style]}>{children}</Text>;
export const ErrorText = ({ children }: Kids) => (children ? <Text style={s.error}>{children}</Text> : null);

type ButtonTone = "mint" | "dark" | "outline" | "peach" | "white" | "grey";
const BTN: Record<ButtonTone, { bg: string; fg: string; border?: string }> = {
  mint: { bg: C.mint, fg: C.ink },
  dark: { bg: C.ink, fg: "#fff" },
  outline: { bg: "#fff", fg: C.ink, border: C.ink },
  peach: { bg: C.peach, fg: C.ink },
  white: { bg: "#fff", fg: C.ink },
  grey: { bg: C.grey, fg: C.ink },
};

export function Button({ title, onPress, tone = "mint", icon: I, busy, disabled, style, small }: {
  title: string; onPress?: () => void; tone?: ButtonTone; icon?: LucideIcon; busy?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const t = BTN[tone];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        s.btn,
        small && { minHeight: 48, paddingHorizontal: 22 },
        { backgroundColor: t.bg, borderColor: t.border ?? t.bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {busy ? <ActivityIndicator color={t.fg} /> : (
        <>
          {I && <I size={20} color={tone === "dark" ? C.mint : t.fg} strokeWidth={2.2} />}
          <Text style={[s.btnText, { color: t.fg }, small && { fontSize: 16 }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** White circle with an icon: close, back, settings. */
export function RoundButton({ icon: I, onPress, label, dark }: { icon: LucideIcon; onPress: () => void; label: string; dark?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}
      style={[s.round, dark && { backgroundColor: "rgba(255,255,255,0.1)" }]}>
      <I size={22} color={dark ? C.onDark : C.ink} strokeWidth={2.2} />
    </Pressable>
  );
}

const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
export const BackButton = () => <RoundButton icon={ChevronLeft} onPress={back} label="Back" />;
export const CloseButton = ({ dark, onPress }: { dark?: boolean; onPress?: () => void }) =>
  <RoundButton icon={X} onPress={onPress ?? back} label="Close" dark={dark} />;

/** Back button, title + subtitle, optional pill on the right (page 9, 14, 16 headers). */
export function Header({ title, subtitle, right, close }: { title?: string; subtitle?: string; right?: ReactNode; close?: boolean }) {
  return (
    <View style={s.header}>
      {close ? <CloseButton /> : <BackButton />}
      <View style={{ flex: 1 }}>
        {title && <Title numberOfLines={1}>{title}</Title>}
        {subtitle && <Muted numberOfLines={1} style={{ fontSize: 14 }}>{subtitle}</Muted>}
      </View>
      {right}
    </View>
  );
}

type ChipTone = "mint" | "peach" | "grey" | "white" | "dark" | "mintSoft";
const CHIP: Record<ChipTone, { bg: string; fg: string }> = {
  mint: { bg: C.mint, fg: C.ink },
  peach: { bg: C.peachSoft, fg: C.ink },
  grey: { bg: C.grey, fg: C.ink },
  white: { bg: "#fff", fg: C.ink },
  dark: { bg: C.ink, fg: "#fff" },
  mintSoft: { bg: C.mintSoft, fg: C.ink },
};
export function Chip({ text, tone = "white", icon: I, onPress, style }: { text: string; tone?: ChipTone; icon?: LucideIcon; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const t = CHIP[tone];
  const body = (
    <View style={[s.chip, { backgroundColor: t.bg }, style]}>
      {I && <I size={16} color={t.fg} strokeWidth={2.2} />}
      <Text style={[s.chipText, { color: t.fg }]}>{text}</Text>
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress}>{body}</Pressable> : body;
}

export const Card = ({ children, style }: Kids & { style?: StyleProp<ViewStyle> }) => <View style={[s.card, style]}>{children}</View>;

/** The dark green gradient card. */
export const GreenCard = ({ children, style }: Kids & { style?: StyleProp<ViewStyle> }) => (
  <LinearGradient colors={[C.green, C.green2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.card, style]}>{children}</LinearGradient>
);

/** Rounded square holding an icon (list rows, feature cards). */
export function IconTile({ icon: I, bg = C.peachSoft, color = C.ink, size = 48 }: { icon: LucideIcon; bg?: string; color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <I size={size * 0.48} color={color} strokeWidth={2} />
    </View>
  );
}

/** White grouped list with dividers (Keep practising, MCQ/Placement rows, settings). */
export const List = ({ children }: Kids) => <View style={s.list}>{children}</View>;
export function Row({ icon, iconBg, title, subtitle, onPress, right, first }: {
  icon?: LucideIcon; iconBg?: string; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode; first?: boolean;
}) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [s.row, !first && s.rowLine, pressed && { opacity: 0.7 }]}>
      {icon && <IconTile icon={icon} bg={iconBg} />}
      <View style={{ flex: 1 }}>
        <Title style={{ fontSize: 17 }}>{title}</Title>
        {subtitle && <Muted numberOfLines={1}>{subtitle}</Muted>}
      </View>
      {right ?? (onPress && <ChevronRight size={22} color={C.muted} />)}
    </Pressable>
  );
}

/** Circular progress ring with content in the middle (scores, timers). */
export function Ring({ value, size = 180, stroke = 16, color = C.mint, track = "rgba(255,255,255,0.15)", children }: Kids & {
  value: number; size?: number; stroke?: number; color?: string; track?: string;
}) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - v)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
}

/** Number + caption tile (Total XP, Words per minute...). */
export function Stat({ value, label, bg = "#fff", align = "center", style }: { value: string | number; label: string; bg?: string; align?: "center" | "left"; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.stat, { backgroundColor: bg, alignItems: align === "center" ? "center" : "flex-start" }, style]}>
      <Text style={s.statValue}>{value}</Text>
      <Muted style={{ fontSize: 15 }}>{label}</Muted>
    </View>
  );
}

export const XpChip = ({ xp, tone = "peach" }: { xp: number; tone?: "peach" | "mint" }) => (
  <View style={[s.chip, { backgroundColor: tone === "peach" ? C.peach : C.mint, alignSelf: "flex-start" }]}>
    <Zap size={16} color={C.ink} strokeWidth={2.4} />
    <Text style={[s.chipText, { color: C.ink, fontSize: 16 }]}>+{xp} XP</Text>
  </View>
);

const TYPE_LABEL: Record<string, string> = { grammar: "Grammar", vocabulary: "Vocabulary", phrasing: "Phrasing" };
/** Struck-through original, correction in green, short explanation (page 7 "Fix these"). */
export function MistakeCard({ m, hideType }: { m: Pick<Mistake, "type" | "original" | "correction"> & { explanation?: string }; hideType?: boolean }) {
  return (
    <Card style={{ gap: 6 }}>
      {!hideType && <Chip text={TYPE_LABEL[m.type] ?? m.type} tone="peach" style={{ alignSelf: "flex-start", marginBottom: 4 }} />}
      <Text style={s.strike}>{m.original}</Text>
      <Text style={s.fixed}>{m.correction}</Text>
      {!!m.explanation && <Body style={{ color: C.muted }}>{m.explanation}</Body>}
    </Card>
  );
}

/** Full-screen spinner or error with retry. */
export function Loading({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <Screen style={{ alignItems: "center", justifyContent: "center", gap: 16 }}>
      {error ? (
        <>
          <Body style={{ textAlign: "center" }}>{error}</Body>
          {onRetry && <Button title="Try again" onPress={onRetry} tone="dark" small />}
          <Button title="Go back" onPress={back} tone="white" small />
        </>
      ) : <ActivityIndicator size="large" color={C.green} />}
    </Screen>
  );
}

export const s = StyleSheet.create({
  page: { padding: 20, gap: 16 },
  footer: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8, flexDirection: "row", gap: 12 },
  h1: { fontFamily: F.extrabold, fontSize: 36, lineHeight: 42, letterSpacing: -1, color: C.ink },
  h2: { fontFamily: F.bold, fontSize: 24, letterSpacing: -0.4, color: C.ink },
  title: { fontFamily: F.bold, fontSize: 19, color: C.ink },
  body: { fontFamily: F.regular, fontSize: 16, lineHeight: 23, color: C.ink },
  muted: { fontFamily: F.regular, fontSize: 15, lineHeight: 21, color: C.muted },
  label: { fontFamily: F.semibold, fontSize: 13, letterSpacing: 1.2, textTransform: "uppercase", color: C.muted },
  em: { fontFamily: F.serif, fontWeight: "normal", letterSpacing: 0 },
  error: { fontFamily: F.medium, fontSize: 15, color: C.redText, textAlign: "center" },
  btn: { minHeight: 58, borderRadius: 999, paddingHorizontal: 28, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  btnText: { fontFamily: F.bold, fontSize: 18 },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  chip: { flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontFamily: F.bold, fontSize: 14 },
  card: { backgroundColor: "#fff", borderRadius: 28, padding: 22 },
  list: { backgroundColor: "#fff", borderRadius: 28, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  rowLine: { borderTopWidth: 1, borderTopColor: C.line },
  stat: { flex: 1, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 16, gap: 2 },
  statValue: { fontFamily: F.extrabold, fontSize: 30, color: C.ink, letterSpacing: -0.5 },
  strike: { fontFamily: F.regular, fontSize: 15, color: C.muted, textDecorationLine: "line-through" },
  fixed: { fontFamily: F.bold, fontSize: 18, color: C.green2 },
  input: { backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 18, paddingVertical: 16, fontFamily: F.regular, fontSize: 17, color: C.ink },
});
