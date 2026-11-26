import { router } from "expo-router";
import { Briefcase, Coffee, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Conversation, FixThese, Headline, Results, type Debrief, type Opening } from "@/components/Speaking";
import { Button, Chip, CloseButton, Em, ErrorText, GreenCard, H1, IconTile, Label, Muted, Screen } from "@/components/ui";
import { errorText, postJson } from "@/lib/api";
import { useSession } from "@/lib/session";
import { C, F } from "@/lib/theme";

type Scenario = "interview" | "everyday";
const SCENARIOS: Record<Scenario, { title: string; text: string; subtitle: string; partner: string; icon: LucideIcon; word: string }> = {
  interview: { title: "Job Interview", text: "HR round: tell me about yourself, strengths, challenges.", subtitle: "HR round", partner: "Interviewer", icon: Briefcase, word: "interview" },
  everyday: { title: "Everyday Conversation", text: "Order food at a cafe and make small talk.", subtitle: "At the cafe", partner: "Ravi", icon: Coffee, word: "chat" },
};

export default function RolePlay() {
  const { me, refresh } = useSession();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [result, setResult] = useState<Debrief | null>(null);
  const [busy, setBusy] = useState<Scenario | null>(null);
  const [error, setError] = useState("");

  async function start(id: Scenario) {
    setBusy(id);
    setError("");
    try {
      setOpening(await postJson<Opening>("/v1/roleplay", { scenario: id }));
      setScenario(id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const reset = () => {
    setOpening(null);
    setResult(null);
    setScenario(null);
  };

  if (result && scenario) {
    const sc = SCENARIOS[scenario];
    return (
      <Results score={result.score} xp={result.xp} summary={result.summary} onAgain={reset} onDone={() => { refresh(); router.back(); }}
        headline={<Headline before={result.score >= 60 ? "Great" : "Good"} em={sc.word} after={`, ${me?.user.name.split(" ")[0] ?? ""}`} />}>
        <FixThese mistakes={result.mistakes} phrases={result.better_phrases} />
      </Results>
    );
  }
  if (opening && scenario) {
    const sc = SCENARIOS[scenario];
    return <Conversation base="/v1/roleplay" opening={opening} title={sc.title} subtitle={sc.subtitle} partner={sc.partner} onFinished={setResult} />;
  }

  const left = me ? Math.max(0, Math.round((me.speaking_limit_seconds - me.speaking_seconds_today) / 60)) : null;
  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <CloseButton />
        {left !== null && <Chip text={`${left} min speaking left`} />}
      </View>
      <Label>AI Role-play</Label>
      <H1>Who do you want to <Em style={{ fontSize: 42 }}>talk</Em> to?</H1>
      {(Object.keys(SCENARIOS) as Scenario[]).map((id, i) => {
        const sc = SCENARIOS[id];
        const dark = i === 0;
        const body = (
          <>
            <View style={[s.ring, { borderColor: dark ? C.mint : C.peach }]} />
            <IconTile icon={sc.icon} bg={dark ? C.mint : C.ink} color={dark ? C.ink : C.peachSoft} size={72} />
            <Text style={[s.title, dark && { color: C.onDark }]}>{sc.title}</Text>
            <Muted style={dark ? { color: C.onDarkMuted, fontSize: 17 } : { fontSize: 17 }}>{sc.text}</Muted>
            <Button title="Start talking" tone={dark ? "mint" : "dark"} small busy={busy === id} disabled={!!busy || left === 0}
              onPress={() => start(id)} style={{ alignSelf: "flex-start", minWidth: 200, marginTop: 8 }} />
          </>
        );
        return dark
          ? <GreenCard key={id} style={s.card}>{body}</GreenCard>
          : <View key={id} style={[s.card, { backgroundColor: C.peachSoft }]}>{body}</View>;
      })}
      <ErrorText>{error || (left === 0 ? "You've used today's speaking time. Upgrade on the Me tab, or come back tomorrow." : "")}</ErrorText>
      <Muted style={{ textAlign: "center" }}>Speak your replies. You get a score, your mistakes and better phrases at the end.</Muted>
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 32, padding: 28, gap: 10, overflow: "hidden" },
  ring: { position: "absolute", right: -60, top: -20, width: 220, height: 220, borderRadius: 110, borderWidth: 40 },
  title: { fontFamily: F.extrabold, fontSize: 32, letterSpacing: -0.8, color: C.ink, marginTop: 14 },
});
