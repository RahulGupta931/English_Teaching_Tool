import { router } from "expo-router";
import { GraduationCap, PartyPopper } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Card, Chip, Header, IconTile, MistakeCard, Muted, Screen, Title } from "@/components/ui";
import { useSession } from "@/lib/session";
import { C } from "@/lib/theme";

const TYPES = [
  { value: "all", label: "All" },
  { value: "grammar", label: "Grammar" },
  { value: "vocabulary", label: "Vocabulary" },
  { value: "phrasing", label: "Phrasing" },
] as const;

/** Every saved mistake, newest first, with a filter by type and a shortcut to fix them with the coach. */
export default function Mistakes() {
  const { me, refresh } = useSession();
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("all");
  if (!me) return null;

  // The same sentence can be saved more than once; show it once.
  const seen = new Set<string>();
  const all = me.mistakes.filter((m) => {
    const k = m.original.toLowerCase();
    return seen.has(k) ? false : (seen.add(k), true);
  });
  const shown = type === "all" ? all : all.filter((m) => m.type === type);
  const count = (t: string) => (t === "all" ? all.length : all.filter((m) => m.type === t).length);

  return (
    <Screen scroll onRefresh={refresh} style={{ gap: 16 }}
      footer={all.length > 0 ? <Button title="Fix with coach" icon={GraduationCap} tone="mint" onPress={() => router.push("/coach")} style={{ flex: 1 }} /> : undefined}>
      <Header title="Mistakes to review" subtitle={`${all.length} saved from your practice`} />

      {all.length === 0 ? (
        <Card style={{ alignItems: "center", gap: 10, paddingVertical: 32 }}>
          <IconTile icon={PartyPopper} bg={C.mintTile} size={44} />
          <Title>No mistakes yet</Title>
          <Muted style={{ textAlign: "center" }}>Do a role-play, JAM or quiz. Anything you get wrong shows up here to review.</Muted>
        </Card>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {TYPES.filter((t) => count(t.value) > 0).map((t) => (
              <Chip key={t.value} text={`${t.label} ${count(t.value)}`} tone={type === t.value ? "mint" : "white"} onPress={() => setType(t.value)}
                style={{ paddingHorizontal: 16, paddingVertical: 9 }} />
            ))}
          </ScrollView>
          <View style={{ gap: 12 }}>
            {shown.map((m, i) => <MistakeCard key={i} m={m} hideType={type !== "all"} />)}
          </View>
        </>
      )}
    </Screen>
  );
}
