import { router } from "expo-router";
import { ArrowRight, Check, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Headline, Results } from "@/components/Speaking";
import { Button, Card, Chip, CloseButton, Loading, Muted, Screen } from "@/components/ui";
import { errorText, postJson, type Mistake } from "@/lib/api";
import { useSession } from "@/lib/session";
import { C, F } from "@/lib/theme";

type Question = { source: string; question: string; options: string[] };
type Quiz = { id: number; questions: Question[] };
type Graded = {
  correct: number; total: number; score: number; xp: number; mistakes: Mistake[];
  results: { chosen: number | null; answer: number; correct: boolean; explanation: string }[];
};

export default function QuizScreen() {
  const { refresh } = useSession();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [i, setI] = useState(0);
  const [graded, setGraded] = useState<Graded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    postJson<Quiz>("/v1/quiz", {}).then((q) => {
      setQuiz(q);
      setAnswers(q.questions.map(() => null));
      setI(0);
      setError("");
    }).catch((e) => setError(errorText(e)));
  };
  useEffect(load, []);
  const start = () => {
    setQuiz(null);
    setGraded(null);
    load();
  };

  async function submit() {
    if (!quiz) return;
    setBusy(true);
    setError("");
    try {
      setGraded(await postJson<Graded>(`/v1/quiz/${quiz.id}`, { answers }));
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (!quiz) return <Loading error={error} onRetry={start} />;

  if (graded) {
    return (
      <Results score={graded.score} xp={graded.xp} onAgain={start}
        summary={`You got ${graded.correct} of ${graded.total} right.`}
        headline={<Headline before={graded.score >= 70 ? "Great" : "Good"} em="effort" after="!" />}>
        {quiz.questions.map((q, n) => {
          const r = graded.results[n];
          return (
            <Card key={n} style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                {r.correct ? <Check size={22} color={C.progress} /> : <X size={22} color={C.redText} />}
                <Text style={[s.q, { fontSize: 17, flex: 1 }]}>{q.question}</Text>
              </View>
              {!r.correct && r.chosen !== null && <Text style={s.strike}>{q.options[r.chosen]}</Text>}
              <Text style={s.right}>{q.options[r.answer]}</Text>
              {!r.correct && !!r.explanation && <Muted>{r.explanation}</Muted>}
            </Card>
          );
        })}
      </Results>
    );
  }

  const q = quiz.questions[i];
  const total = quiz.questions.length;
  const answered = answers.filter((a) => a !== null).length;
  const last = i === total - 1;
  return (
    <Screen scroll footer={
      <>
        <Button title="Back" tone="white" onPress={() => setI(i - 1)} disabled={i === 0} style={{ paddingHorizontal: 34 }} />
        <Button title={last ? "Submit" : "Next"} icon={last ? undefined : ArrowRight} tone="mint" busy={busy}
          onPress={last ? submit : () => setI(i + 1)} disabled={answers[i] === null} style={{ flex: 1, flexDirection: "row-reverse" }} />
      </>
    }>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <CloseButton onPress={() => router.back()} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Muted style={{ fontFamily: F.semibold }}>Question {i + 1} of {total}</Muted>
            <Muted style={{ fontFamily: F.semibold }}>{answered} answered</Muted>
          </View>
          <View style={s.track}><View style={[s.fill, { width: `${((i + 1) / total) * 100}%` }]} /></View>
        </View>
      </View>
      <Card style={{ gap: 14, paddingVertical: 28 }}>
        <Chip text={q.source[0].toUpperCase() + q.source.slice(1)} tone="peach" style={{ alignSelf: "flex-start" }} />
        <Text style={s.q}>{q.question}</Text>
      </Card>
      {q.options.map((opt, n) => {
        const picked = answers[i] === n;
        return (
          <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: picked }}
            onPress={() => setAnswers((a) => a.map((x, k) => (k === i ? n : x)))}
            style={[s.option, picked && { borderColor: C.ink }]}>
            <View style={[s.letter, picked && { backgroundColor: C.ink }]}>
              <Text style={[s.letterText, picked && { color: "#fff" }]}>{"ABCD"[n]}</Text>
            </View>
            <Text style={s.optText}>{opt}</Text>
            {picked && <Check size={24} color={C.ink} />}
          </Pressable>
        );
      })}
      {!!error && <Muted style={{ color: C.redText, textAlign: "center" }}>{error}</Muted>}
    </Screen>
  );
}

const s = StyleSheet.create({
  track: { height: 10, borderRadius: 5, backgroundColor: C.absent, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5, backgroundColor: C.progress },
  q: { fontFamily: F.bold, fontSize: 26, lineHeight: 34, color: C.ink },
  option: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: "#fff", borderRadius: 28, padding: 18, borderWidth: 2, borderColor: "#fff" },
  letter: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.grey, alignItems: "center", justifyContent: "center" },
  letterText: { fontFamily: F.bold, fontSize: 16, color: C.ink },
  optText: { flex: 1, fontFamily: F.semibold, fontSize: 19, color: C.ink },
  strike: { fontFamily: F.regular, fontSize: 15, color: C.muted, textDecorationLine: "line-through" },
  right: { fontFamily: F.bold, fontSize: 17, color: C.green2 },
});
