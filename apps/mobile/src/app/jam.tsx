import { router } from "expo-router";
import { Square } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FixThese } from "@/components/Speaking";
import { Body, Button, Card, CloseButton, Em, ErrorText, Label, Muted, Ring, Stat, Title, XpChip } from "@/components/ui";
import { api, errorText, postAudio, type Mistake } from "@/lib/api";
import { useMic } from "@/lib/audio";
import { useSession } from "@/lib/session";
import { C, F } from "@/lib/theme";

type Topic = { topic: string; think_seconds: number; speak_seconds: number };
type Result = {
  topic: string; transcript: string; score: number; feedback: string; mistakes: Mistake[]; xp: number; penalty: number;
  scores: { fluency: number; vocabulary: number; grammar: number; relevance: number };
  metrics: { word_count: number; words_per_minute: number; fillers: Record<string, number>; filler_count: number; repetitions: number; long_pauses: number };
};

export default function Jam() {
  const { refresh } = useSession();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [phase, setPhase] = useState<"ready" | "think" | "speak" | "scoring" | "done">("ready");
  const [think, setThink] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const max = topic?.speak_seconds ?? 60;
  const mic = useMic({ maxSeconds: max, onWav: send, onError: (m) => { setError(m); setPhase("ready"); } });

  useEffect(() => {
    api<Topic>("/v1/jam/topic").then(setTopic).catch((e) => setError(errorText(e)));
  }, []);

  const speak = () => {
    setPhase("speak");
    mic.start();
  };
  // Thinking time, then the minute starts by itself.
  useEffect(() => {
    if (phase !== "think") return;
    const t = setTimeout(() => (think <= 1 ? speak() : setThink(think - 1)), 1000);
    return () => clearTimeout(t);
  }, [phase, think]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(uri: string) {
    setPhase("scoring");
    try {
      setResult(await postAudio<Result>("/v1/jam", uri));
      setPhase("done");
      refresh();
    } catch (e) {
      setError(errorText(e));
      setPhase("ready");
    }
  }

  const begin = () => {
    setError("");
    setResult(null);
    setThink(topic?.think_seconds ?? 10);
    setPhase("think");
  };

  if (phase === "done" && result) return <JamResult r={result} onAgain={begin} />;

  const left = phase === "speak" ? Math.max(0, Math.ceil(max - mic.seconds)) : phase === "think" ? think : max;
  const progress = phase === "speak" ? left / max : phase === "think" ? think / (topic?.think_seconds ?? 10) : 1;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.night }} edges={["top", "bottom"]}>
      <View style={{ flex: 1, padding: 20, gap: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <CloseButton dark onPress={() => { mic.cancel(); router.back(); }} />
          <Label style={{ flex: 1, textAlign: "center", marginRight: 48, color: C.onDarkMuted }}>JAM · Just a minute</Label>
        </View>
        <View style={s.topic}>
          <Muted style={{ color: C.onDarkMuted, fontFamily: F.semibold }}>Today&apos;s topic</Muted>
          {topic ? <Text style={s.topicText}>{topic.topic}</Text> : <ActivityIndicator color={C.mint} />}
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 28 }}>
          <Ring value={progress} size={270} stroke={20} color={phase === "think" ? C.mint : C.peach} track={C.nightCard}>
            {phase === "scoring" ? <ActivityIndicator size="large" color={C.peach} /> : (
              <>
                <Text style={s.count}>{left}</Text>
                <Muted style={{ color: C.onDarkMuted, fontSize: 18 }}>{phase === "think" ? "seconds to think" : "seconds left"}</Muted>
              </>
            )}
          </Ring>
          <View style={s.pill}>
            <View style={[s.dot, { backgroundColor: phase === "think" ? C.mint : C.peach }]} />
            <Text style={[s.pillText, phase === "think" && { color: C.mint }]}>
              {phase === "speak" ? "Speak now" : phase === "think" ? "Get ready…" : phase === "scoring" ? "Scoring your minute…" : "One minute, one topic"}
            </Text>
          </View>
          <ErrorText>{error}</ErrorText>
        </View>
        {phase === "speak" ? (
          <Button title="Stop early" tone="grey" icon={Square} onPress={mic.send} disabled={mic.seconds < 5} />
        ) : phase === "think" ? (
          <Button title="Start speaking now" tone="grey" onPress={speak} />
        ) : (
          <Button title="Start" tone="peach" onPress={begin} disabled={!topic || phase === "scoring"} />
        )}
      </View>
    </SafeAreaView>
  );
}

/** JAM result (page 15). */
function JamResult({ r, onAgain }: { r: Result; onAgain: () => void }) {
  const fillers = Object.entries(r.metrics.fillers).map(([w, n]) => `${w} ×${n}`).join(", ");
  const scores: [string, number][] = [["Fluency", r.scores.fluency], ["Grammar", r.scores.grammar], ["Vocabulary", r.scores.vocabulary], ["Relevance", r.scores.relevance]];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <SafeAreaView edges={["top"]} style={s.head}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Label style={{ color: C.onDarkMuted }}>JAM result</Label>
            <CloseButton dark />
          </View>
          <View style={{ flexDirection: "row", gap: 18, alignItems: "center" }}>
            <Ring value={r.score / 100} size={150} stroke={14} color={C.peach} track={C.nightCard}>
              <Text style={[s.count, { fontSize: 50 }]}>{r.score}</Text>
              <Muted style={{ color: C.onDarkMuted, fontSize: 14 }}>out of 100</Muted>
            </Ring>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={s.headline}>{r.score >= 70 ? "What a " : "Nice "}<Em style={{ color: C.peach, fontSize: 32 }}>minute</Em>!</Text>
              <Body style={{ color: C.onDarkMuted }}>{r.feedback}</Body>
              <XpChip xp={r.xp} tone="mint" />
            </View>
          </View>
        </SafeAreaView>
        <View style={{ padding: 20, gap: 14 }}>
          <View style={s.grid}>
            <Stat align="left" value={r.metrics.words_per_minute} label="Words per minute" />
            <Stat align="left" value={r.metrics.filler_count} label={fillers ? `Filler words · ${fillers}` : "Filler words"} bg={r.metrics.filler_count ? C.peachSoft : "#fff"} />
          </View>
          <View style={s.grid}>
            <Stat align="left" value={r.metrics.long_pauses} label="Long pauses" />
            <Stat align="left" value={r.metrics.repetitions} label="Repeated words" />
          </View>
          <Card style={{ gap: 12 }}>
            <Title>Score breakdown</Title>
            {scores.map(([k, v]) => (
              <View key={k} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Body style={{ fontSize: 17 }}>{k}</Body><Text style={{ fontFamily: F.bold, fontSize: 17, color: C.ink }}>{v}</Text>
                </View>
                <View style={s.track}><View style={[s.fill, { width: `${v}%` }]} /></View>
              </View>
            ))}
            {r.penalty > 0 && <Muted style={{ fontSize: 14 }}>−{r.penalty} for filler words and long pauses.</Muted>}
          </Card>
          <View style={s.heard}>
            <Body><Text style={{ fontFamily: F.bold }}>We heard: </Text>&quot;{r.transcript}&quot;</Body>
          </View>
          {r.mistakes.length > 0 && <FixThese mistakes={r.mistakes} />}
        </View>
      </ScrollView>
      <SafeAreaView edges={["bottom"]} style={{ flexDirection: "row", gap: 14, paddingHorizontal: 20, paddingTop: 8 }}>
        <Button title="Try again" tone="dark" onPress={onAgain} style={{ flex: 1 }} />
        <Button title="Done" tone="mint" onPress={() => router.back()} style={{ flex: 1 }} />
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  topic: { backgroundColor: C.nightCard, borderRadius: 28, padding: 24, gap: 8, borderWidth: 1, borderColor: "#26302C" },
  topicText: { fontFamily: F.bold, fontSize: 26, lineHeight: 33, color: C.onDark },
  count: { fontFamily: F.extrabold, fontSize: 110, color: C.onDark, letterSpacing: -3 },
  pill: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#33291F", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  pillText: { fontFamily: F.bold, fontSize: 18, color: C.peach },
  head: { backgroundColor: C.night, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, padding: 20, gap: 14 },
  headline: { fontFamily: F.extrabold, fontSize: 30, color: C.onDark, letterSpacing: -0.6 },
  grid: { flexDirection: "row", gap: 14 },
  track: { height: 10, borderRadius: 5, backgroundColor: C.grey, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5, backgroundColor: C.progress },
  heard: { backgroundColor: C.grey, borderRadius: 24, padding: 20 },
});
