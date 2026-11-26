import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, type Href } from "expo-router";
import { AudioLines, Briefcase, ChevronRight, GraduationCap, LayoutGrid, Link2, ListChecks, MessagesSquare, Search, Target, Timer, X, type LucideIcon } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { C, F } from "@/lib/theme";
import { Chip, GreenCard, H1, IconTile, List, Muted, Row, RoundButton, Screen, s as ui } from "./ui";

type Group = "Speaking" | "Games" | "Tests";
type Item = { title: string; text: string; icon: LucideIcon; href: Href; group: Group; bg?: string };

export const TWISTER_LEVEL_KEY = "twister-unlocked";

/** Every practice activity (Figma page 4). The Games tab shows the same list filtered to games. */
export function PracticeList({ title, initial = "All" }: { title: string; initial?: "All" | Group }) {
  const [filter, setFilter] = useState<"All" | Group>(initial);
  const [query, setQuery] = useState<string | null>(null);
  const [twister, setTwister] = useState(1);
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(TWISTER_LEVEL_KEY).then((v) => setTwister(Number(v) || 1)).catch(() => {});
  }, []));

  const ITEMS: Item[] = [
    { title: "AI Role-Play", text: "Job interview or everyday chat", icon: MessagesSquare, href: "/roleplay", group: "Speaking" },
    { title: "Mistake Coach", text: "Hands-free", icon: GraduationCap, href: "/coach", group: "Speaking", bg: C.peachSoft },
    { title: "Interview", text: "From your resume", icon: Briefcase, href: "/interview", group: "Speaking" },
    { title: "JAM", text: "Speak for 1 minute", icon: Timer, href: "/jam", group: "Speaking" },
    { title: "Daily Word", text: "New word today", icon: LayoutGrid, href: "/daily-word", group: "Games", bg: C.mint },
    { title: "Word Chain", text: "Beat the AI", icon: Link2, href: "/word-chain", group: "Games" },
    { title: "Tongue Twister", text: `Level ${twister} of 15`, icon: AudioLines, href: "/tongue-twister", group: "Games" },
    { title: "MCQ Quiz", text: "10 grammar and vocabulary questions", icon: ListChecks, href: "/quiz", group: "Tests" },
    { title: "Placement Test", text: "Answer 3 questions to find your level", icon: Target, href: "/placement", group: "Tests" },
  ];
  const q = query?.trim().toLowerCase() ?? "";
  const shown = ITEMS.filter((i) => (filter === "All" || i.group === filter) && (!q || `${i.title} ${i.text}`.toLowerCase().includes(q)));
  const [hero, ...rest] = shown[0]?.title === "AI Role-Play" ? shown : [null, ...shown];
  const tiles = rest.filter((i) => i!.group !== "Tests") as Item[];
  const tests = rest.filter((i) => i!.group === "Tests") as Item[];

  return (
    <Screen scroll style={{ paddingBottom: 140 }}>
      <View style={s.top}>
        <H1 style={{ fontSize: 44, flex: 1 }}>{title}</H1>
        <RoundButton icon={query === null ? Search : X} label={query === null ? "Search" : "Close search"} onPress={() => setQuery(query === null ? "" : null)} />
      </View>
      {query !== null && <TextInput autoFocus style={ui.input} value={query} onChangeText={setQuery} placeholder="Search practice" placeholderTextColor={C.muted} />}
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        {(["All", "Speaking", "Games", "Tests"] as const).map((f) => (
          <Chip key={f} text={f} tone={filter === f ? "mint" : "white"} onPress={() => setFilter(f)} style={{ paddingHorizontal: 18, paddingVertical: 10 }} />
        ))}
      </View>

      {hero && (
        <Pressable accessibilityRole="button" onPress={() => router.push(hero.href)}>
          <GreenCard style={s.hero}>
            <IconTile icon={hero.icon} bg={C.mint} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>{hero.title}</Text>
              <Muted style={{ color: C.onDarkMuted }}>{hero.text}</Muted>
            </View>
            <ChevronRight color={C.mint} size={26} />
          </GreenCard>
        </Pressable>
      )}

      <View style={s.grid}>
        {tiles.map((i) => (
          <Pressable key={i.title} accessibilityRole="button" onPress={() => router.push(i.href)} style={[s.tile, { backgroundColor: i.bg ?? "#fff" }]}>
            <i.icon size={32} color={C.ink} strokeWidth={1.8} />
            <Text style={s.tileTitle}>{i.title}</Text>
            <Muted numberOfLines={1}>{i.text}</Muted>
          </Pressable>
        ))}
      </View>

      {tests.length > 0 && (
        <List>
          {tests.map((i, n) => <Row key={i.title} first={n === 0} icon={i.icon} iconBg={C.grey} title={i.title} subtitle={i.text} onPress={() => router.push(i.href)} />)}
        </List>
      )}
      {shown.length === 0 && <Muted style={{ textAlign: "center" }}>Nothing matches &quot;{query}&quot;.</Muted>}
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  hero: { flexDirection: "row", alignItems: "center", gap: 18, paddingVertical: 26 },
  heroTitle: { fontFamily: F.bold, fontSize: 22, color: C.onDark },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  tile: { width: "47.8%", borderRadius: 28, padding: 22, gap: 6 },
  tileTitle: { fontFamily: F.bold, fontSize: 19, color: C.ink, marginTop: 14 },
});
