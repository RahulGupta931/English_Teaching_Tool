import { router } from "expo-router";
import { Briefcase, Check, Coffee, MessagesSquare, Mic, Trophy, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Conversation, FixThese, Headline, Results, type Debrief, type Opening } from "@/components/Speaking";
import { ActivityInfo } from "@/components/ActivityInfo";
import { Button, Card, Chip, CloseButton, Em, ErrorText, GreenCard, H1, IconTile, Label, Muted, Screen } from "@/components/ui";
import { errorText, postJson } from "@/lib/api";
import { useSession } from "@/lib/session";
import { C, F, themed } from "@/lib/theme";

type Scenario = "interview" | "everyday";
const SCENARIOS: Record<Scenario, { title: string; text: string; subtitle: string; partner: string; icon: LucideIcon; word: string; level: string; practise: string[] }> = {
  interview: { title: "Job Interview", text: "HR round: tell me about yourself, strengths, challenges.", subtitle: "HR round", partner: "Interviewer", icon: Briefcase, word: "interview",
    level: "Formal", practise: ["Introducing yourself", "Talking about strengths", "Answering follow-up questions"] },
  everyday: { title: "Everyday Conversation", text: "Order food at a cafe and make small talk.", subtitle: "At the cafe", partner: "Ravi", icon: Coffee, word: "chat",
    level: "Casual", practise: ["Ordering politely", "Asking questions", "Keeping small talk going"] },
};
const HOW = [
  { icon: MessagesSquare, title: "Pick a situation", text: "Your AI partner starts the conversation." },
  { icon: Mic, title: "Speak your reply", text: "Tap the mic, answer out loud, tap to send." },
  { icon: Trophy, title: "Get your debrief", text: "A score, your mistakes and better phrases." },
];

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
      <H1>Who do you want to <Em style={{ fontSize: 34 }}>talk</Em> to?</H1>
      {(Object.keys(SCENARIOS) as Scenario[]).map((id, i) => {
        const sc = SCENARIOS[id];
        const dark = i === 0;
        const body = (
          <>
            <View style={[s.ring, { borderColor: dark ? C.mint : C.peach }]} />
            <IconTile icon={sc.icon} bg={dark ? C.mint : C.ink} color={dark ? C.ink : C.peachSoft} size={56} />
            <Text style={[s.title, dark && { color: C.onDark }]}>{sc.title}</Text>
            <Muted style={dark ? { color: C.onDarkMuted, fontSize: 17 } : { fontSize: 17 }}>{sc.text}</Muted>
            {/* Same details as the web scenario cards */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {[sc.level, "About 5 min", "Up to 10 turns"].map((t) => <Chip key={t} text={t} tone={dark ? "glass" : "white"} />)}
            </View>
            <View style={[s.practise, dark && { borderTopColor: "rgba(255,255,255,0.15)" }]}>
              <Text style={[s.practiseLabel, dark && { color: C.onDarkMuted }]}>YOU&apos;LL PRACTISE</Text>
              {sc.practise.map((p) => (
                <View key={p} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Check size={14} color={dark ? C.mint : C.purple} strokeWidth={2.6} />
                  <Text style={[s.practiseText, dark && { color: C.onDark }]}>{p}</Text>
                </View>
              ))}
            </View>
            <Button title="Start talking" tone={dark ? "mint" : "dark"} small busy={busy === id} disabled={!!busy || left === 0}
              onPress={() => start(id)} style={{ alignSelf: "flex-start", minWidth: 200, marginTop: 8 }} />
          </>
        );
        return dark
          ? <GreenCard key={id} style={s.card}>{body}</GreenCard>
          : <View key={id} style={[s.card, { backgroundColor: C.peachSoft }]}>{body}</View>;
      })}
      <ErrorText>{error || (left === 0 ? "You've used today's speaking time. Upgrade on the Me tab, or come back tomorrow." : "")}</ErrorText>
      <Card style={{ gap: 12 }}>
        <Text style={s.howTitle}>How it works</Text>
        {HOW.map(({ icon: I, title, text }, n) => (
          <View key={title} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <IconTile icon={I} bg={C.mint} color={C.onMint} size={34} />
            <View style={{ flex: 1 }}>
              <Text style={s.howStep}>{n + 1}. {title}</Text>
              <Muted style={{ fontSize: 13 }}>{text}</Muted>
            </View>
          </View>
        ))}
      </Card>
      <ActivityInfo kind="roleplay" tips={["Answer in full sentences, not single words.", "It's fine to pause and think before you speak.", "Tap Replay on any reply to hear it again.", "Finish after a few turns to get your score and mistakes."]} />
    </Screen>
  );
}

const s = themed(() => StyleSheet.create({
  card: { borderRadius: 22, padding: 20, gap: 8, overflow: "hidden" },
  ring: { position: "absolute", right: -70, top: -50, width: 170, height: 170, borderRadius: 85, borderWidth: 30, opacity: 0.9 },
  title: { fontFamily: F.extrabold, fontSize: 26, letterSpacing: -0.8, color: C.ink, marginTop: 14 },
  practise: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, marginTop: 4, gap: 6 },
  practiseLabel: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.8, color: C.muted },
  practiseText: { fontFamily: F.medium, fontSize: 14, color: C.ink },
  howTitle: { fontFamily: F.bold, fontSize: 17, color: C.ink },
  howStep: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
}));
