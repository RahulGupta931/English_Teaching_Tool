import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { BookX, Flame, Search, Sparkles, X, type LucideIcon } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSession } from "@/lib/session";
import { C, F, themed } from "@/lib/theme";
import { ACTIVITIES, ActivityCard, groupTone, type Group } from "./Activities";
import { Chip, H1, IconTile, Muted, RoundButton, Screen, s as ui } from "./ui";

export const TWISTER_LEVEL_KEY = "twister-unlocked";

const GROUPS: Group[] = ["Speaking", "Games", "Tests"];
const GROUP_TEXT: Record<Group, string> = {
  Speaking: "Hold a conversation out loud, with an AI partner or your coach.",
  Games: "Quick daily games for new words and clearer speech.",
  Tests: "Check what you know, and find your level.",
};

/** Practice: stats, then every activity in three coloured groups (same layout as the web Practice page). */
export function PracticeList({ title, initial = "All" }: { title: string; initial?: "All" | Group }) {
  const { me, refresh } = useSession();
  const [filter, setFilter] = useState<"All" | Group>(initial);
  const [query, setQuery] = useState<string | null>(null);
  const [twister, setTwister] = useState(1);
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(TWISTER_LEVEL_KEY).then((v) => setTwister(Number(v) || 1)).catch(() => {});
  }, []));

  const q = query?.trim().toLowerCase() ?? "";
  const shown = ACTIVITIES.filter((a) => (filter === "All" || a.group === filter) && (!q || `${a.title} ${a.text}`.toLowerCase().includes(q)));
  const mistakeCount = me ? new Set(me.mistakes.map((m) => m.original.toLowerCase())).size : 0;
  const metaFor = (kind?: string) => {
    if (kind === "tongue_twister") return `Level ${twister} of 15`;
    const b = kind ? me?.best[kind] : undefined;
    return b === undefined ? undefined : `Best score ${Math.round(b)}`;
  };

  return (
    <Screen scroll style={{ paddingBottom: 120, gap: 18 }} onRefresh={refresh}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <H1 style={{ fontSize: 30 }}>{title}</H1>
          <Muted>Speaking, games and tests, all in one place.</Muted>
        </View>
        <RoundButton icon={query === null ? Search : X} label={query === null ? "Search" : "Close search"} onPress={() => setQuery(query === null ? "" : null)} />
      </View>

      {/* Quick stats, as on web */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatTile icon={Sparkles} bg={C.mint} fg={C.onMint} label="Activities" value={ACTIVITIES.length} />
        <StatTile icon={Flame} bg={C.peachSoft} fg={C.purple} label="Day streak" value={me ? me.user.streak : "–"} />
        <StatTile icon={BookX} bg={C.blueSoft} fg={C.blue} label="Mistakes" value={me ? mistakeCount : "–"}
          onPress={mistakeCount ? () => router.push("/mistakes") : undefined} />
      </View>

      {query !== null && <TextInput autoFocus style={ui.input} value={query} onChangeText={setQuery} placeholder="Search practice" placeholderTextColor={C.muted} />}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {(["All", "Speaking", "Games", "Tests"] as const).map((f) => (
          <Chip key={f} text={f} tone={filter === f ? "mint" : "white"} onPress={() => setFilter(f)} style={{ paddingHorizontal: 16, paddingVertical: 9 }} />
        ))}
      </ScrollView>

      {shown.length === 0 && <Muted style={{ textAlign: "center" }}>Nothing matches &quot;{query}&quot;.</Muted>}
      {GROUPS.filter((g) => shown.some((a) => a.group === g)).map((g) => {
        const items = shown.filter((a) => a.group === g);
        const tone = groupTone(g);
        return (
          <View key={g} style={{ gap: 12 }}>
            <View style={s.groupHead}>
              <IconTile icon={items[0].icon} bg={tone.bg} color={tone.fg} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={s.groupTitle}>{g} <Text style={s.count}>· {items.length}</Text></Text>
                <Muted style={{ fontSize: 13 }}>{GROUP_TEXT[g]}</Muted>
              </View>
            </View>
            <View style={s.grid}>
              {items.map((a, i) => (
                // A lone card left over in the last row spans the full width, instead of leaving half of it empty.
                <ActivityCard key={a.title} a={a} meta={metaFor(a.kind)} full={i === items.length - 1 && items.length % 2 === 1} />
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

function StatTile({ icon: I, bg, fg, label, value, onPress }: { icon: LucideIcon; bg: string; fg: string; label: string; value: string | number; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${label}: ${value}`} disabled={!onPress} onPress={onPress} style={s.stat}>
      <View style={[s.statIcon, { backgroundColor: bg }]}><I size={16} color={fg} /></View>
      <Text style={s.statValue}>{value}</Text>
      <Muted style={{ fontSize: 12 }} numberOfLines={1}>{label}</Muted>
    </Pressable>
  );
}

const s = themed(() => StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  stat: { flex: 1, backgroundColor: C.surface, borderRadius: 18, padding: 12, gap: 4 },
  statIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statValue: { fontFamily: F.extrabold, fontSize: 20, color: C.ink },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  groupTitle: { fontFamily: F.bold, fontSize: 17, color: C.ink },
  count: { fontFamily: F.regular, fontSize: 14, color: C.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
}));
