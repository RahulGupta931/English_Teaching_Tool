import { router } from "expo-router";
import { Check, RotateCcw } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Headline, MicButton, Results, StopButton, clock } from "@/components/Speaking";
import { Button, Card, CloseButton, Em, ErrorText, GreenCard, H1, Label, Loading, Muted, Screen, Title } from "@/components/ui";
import { api, errorText, postFiles, wavPart } from "@/lib/api";
import { useMic } from "@/lib/audio";
import { useSession } from "@/lib/session";
import { C, F } from "@/lib/theme";

type Content = { questions: string[]; max_seconds: number };
type Graded = { level: string; score: number; scores: { grammar: number; vocabulary: number; fluency: number }; feedback: string; xp: number; transcripts: string[] };

export default function Placement() {
  const { refresh } = useSession();
  const [content, setContent] = useState<Content | null>(null);
  const [recordings, setRecordings] = useState<string[]>([]);
  const [result, setResult] = useState<Graded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const max = content?.max_seconds ?? 45;
  const mic = useMic({ maxSeconds: max, onWav: recorded, onError: setError });

  const load = () => {
    api<Content>("/v1/placement").then((c) => { setContent(c); setError(""); }).catch((e) => setError(errorText(e)));
  };
  useEffect(load, []);

  // All answers go up together once the last one is recorded.
  async function recorded(uri: string) {
    const all = [...recordings, uri];
    setRecordings(all);
    if (!content || all.length < content.questions.length) return;
    setBusy(true);
    setError("");
    try {
      setResult(await postFiles<Graded>("/v1/placement", Object.fromEntries(all.map((u, i) => [`answer_${i}`, wavPart(u)]))));
      refresh();
    } catch (e) {
      setError(errorText(e));
      setRecordings(all.slice(0, -1)); // let them re-record the last answer and send again
    } finally {
      setBusy(false);
    }
  }

  if (!content) return <Loading error={error} onRetry={load} />;
  if (result) {
    return (
      <Results score={result.score} xp={result.xp} summary={result.feedback} onAgain={() => { setResult(null); setRecordings([]); }}
        againLabel="Retake" headline={<Headline before="You're" em={result.level} after="" />}>
        <Card style={{ gap: 10 }}>
          <Title>Your scores</Title>
          {Object.entries(result.scores).map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={s.scoreName}>{k[0].toUpperCase() + k.slice(1)}</Text><Text style={s.scoreVal}>{v}</Text>
            </View>
          ))}
        </Card>
        <Card style={{ gap: 10 }}>
          <Title>What we heard</Title>
          {result.transcripts.map((t, i) => (
            <View key={i} style={{ gap: 2 }}>
              <Muted style={{ fontSize: 14 }}>Question {i + 1}</Muted>
              <Text style={s.scoreName}>&quot;{t}&quot;</Text>
            </View>
          ))}
        </Card>
        <Button title="Practise a conversation" tone="white" onPress={() => router.replace("/roleplay")} />
      </Results>
    );
  }

  const step = Math.min(recordings.length, content.questions.length - 1);
  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <CloseButton onPress={() => { mic.cancel(); router.back(); }} />
        <Label style={{ flex: 1, textAlign: "center", marginRight: 48 }}>Placement test</Label>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {content.questions.map((_, i) => (
          <View key={i} style={{ flex: 1, gap: 6 }}>
            <View style={[s.bar, { backgroundColor: i < recordings.length ? C.progress : i === step ? C.ink : C.absent }]} />
            <Text style={[s.stepText, { color: i < recordings.length ? C.green2 : i === step ? C.ink : C.muted }]}>
              Question {i + 1}{i < recordings.length ? " " : ""}{i < recordings.length && <Check size={14} color={C.green2} />}
            </Text>
          </View>
        ))}
      </View>
      <H1>Answer this <Em style={{ fontSize: 42 }}>out loud</Em></H1>
      <Muted style={{ fontSize: 17 }}>Speak in a few sentences. You have up to {max} seconds.</Muted>
      <GreenCard style={{ gap: 10 }}>
        <Muted style={{ color: C.onDarkMuted }}>Question {step + 1}</Muted>
        <Text style={s.question}>{content.questions[step]}</Text>
      </GreenCard>
      <View style={{ alignItems: "center", gap: 14, marginTop: 20 }}>
        {busy ? (
          <>
            <ActivityIndicator size="large" color={C.green} />
            <Muted>Scoring your answers…</Muted>
          </>
        ) : mic.recording ? (
          <>
            <StopButton onPress={mic.send} size={180} />
            <Text style={s.timer}><Text style={{ color: C.redText }}>{clock(mic.seconds)}</Text> / {clock(max)}</Text>
            <Muted>Tap to stop when you&apos;re done</Muted>
          </>
        ) : (
          <>
            <MicButton onPress={mic.start} />
            <Muted>Tap the mic and answer</Muted>
          </>
        )}
        <ErrorText>{error}</ErrorText>
        {recordings.length > 0 && !mic.recording && !busy && (
          <Button title="Redo last step" icon={RotateCcw} tone="white" small onPress={() => setRecordings((r) => r.slice(0, -1))} />
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  bar: { height: 8, borderRadius: 4 },
  stepText: { fontFamily: F.bold, fontSize: 15 },
  question: { fontFamily: F.bold, fontSize: 28, lineHeight: 36, color: C.onDark },
  timer: { fontFamily: F.bold, fontSize: 30, color: C.muted },
  scoreName: { fontFamily: F.regular, fontSize: 17, color: C.ink },
  scoreVal: { fontFamily: F.bold, fontSize: 17, color: C.ink },
});
