import { router } from "expo-router";
import { Delete, Share2, Volume1 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { RecordPanel } from "@/components/Speaking";
import { Body, Card, Chip, ErrorText, Header, Loading, Muted, Screen, Title, XpChip } from "@/components/ui";
import { api, errorText, postAudio, postJson } from "@/lib/api";
import { playAudio, useMic } from "@/lib/audio";
import { useSession } from "@/lib/session";
import { C, F, themed } from "@/lib/theme";

type Mark = "correct" | "present" | "absent";
type State = {
  guesses: { word: string; result: Mark[] }[];
  max_guesses: number;
  finished: boolean;
  solved: boolean;
  bonus_done: boolean;
  reveal: { word: string; meaning: string; example: string; phonetic: string; audio: string | null } | null;
};
type Sentence = { transcript: string; correct: boolean; feedback: string; xp: number };

const TILE: Record<Mark, string> = themed(() => ({ correct: C.mint, present: C.peach, absent: C.absent }));
const EMOJI: Record<Mark, string> = { correct: "🟩", present: "🟨", absent: "⬜" };
const RANK: Record<Mark, number> = { absent: 1, present: 2, correct: 3 };
const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export default function DailyWord() {
  const { refresh } = useSession();
  const [state, setState] = useState<State | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bonus, setBonus] = useState<Sentence | null>(null);
  const mic = useMic({ maxSeconds: 15, onWav: sendSentence, onError: setError });

  const load = () => {
    api<State>("/v1/daily-word").then((st) => { setState(st); setError(""); }).catch((e) => setError(errorText(e)));
  };
  useEffect(load, []);

  async function submit() {
    if (typed.length !== 5 || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await postJson<State>("/v1/daily-word/guess", { word: typed });
      setState(next);
      setTyped("");
      if (next.finished) refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendSentence(uri: string) {
    setBusy(true);
    setError("");
    try {
      const r = await postAudio<Sentence>("/v1/daily-word/sentence", uri);
      setBonus(r);
      if (r.correct) {
        setState((st) => (st ? { ...st, bonus_done: true } : st));
        refresh();
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function press(key: string) {
    setError("");
    if (key === "enter") submit();
    else if (key === "back") setTyped((t) => t.slice(0, -1));
    else if (typed.length < 5) setTyped((t) => t + key);
  }

  // Same text as the web app's WhatsApp share; the phone's share sheet includes WhatsApp.
  function share() {
    if (!state) return;
    const grid = state.guesses.map((g) => g.result.map((m) => EMOJI[m]).join("")).join("\n");
    Share.share({ message: `Daily Word ${state.solved ? state.guesses.length : "X"}/${state.max_guesses}\n${grid}` }).catch(() => {});
  }

  if (!state) return <Loading error={error} onRetry={load} />;
  const letters: Record<string, Mark> = {};
  state.guesses.forEach((g) => [...g.word].forEach((ch, i) => {
    if (!letters[ch] || RANK[g.result[i]] > RANK[letters[ch]]) letters[ch] = g.result[i];
  }));
  const rows = [...Array(state.max_guesses)].map((_, i) => state.guesses[i] ?? (i === state.guesses.length && !state.finished ? { word: typed, result: null } : { word: "", result: null }));
  const left = state.max_guesses - state.guesses.length;

  return (
    <Screen scroll>
      <Header title="Daily Word" subtitle="Same word for everyone today" right={<Chip text={state.finished ? (state.solved ? "Solved!" : "Finished") : `${left} tr${left === 1 ? "y" : "ies"} left`} />} />
      {/* Same intro as the web page */}
      {!state.finished && (
        <View style={{ gap: 4 }}>
          <Text style={s.title}>Guess today&apos;s word</Text>
          <Muted style={{ fontSize: 13 }}>Find the five-letter word in {state.max_guesses} tries. Everyone gets the same word today.</Muted>
        </View>
      )}
      <View style={{ gap: 10, paddingHorizontal: 8 }}>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: "row", gap: 10 }}>
            {[...Array(5)].map((_, i) => {
              const ch = row.word[i];
              const mark = row.result?.[i];
              return (
                <View key={i} style={[s.tile, mark ? { backgroundColor: TILE[mark], borderColor: TILE[mark] } : ch ? { borderColor: C.ink, borderWidth: 2 } : null]}>
                  <Text style={[s.tileText, onBright(mark) && { color: C.onMint }]}>{ch?.toUpperCase()}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View style={s.legend}>
        {(["correct", "present", "absent"] as Mark[]).map((m) => (
          <View key={m} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: TILE[m] }} />
            <Muted>{m === "correct" ? "Right spot" : m === "present" ? "Wrong spot" : "Not in word"}</Muted>
          </View>
        ))}
      </View>
      <ErrorText>{error}</ErrorText>

      {state.finished && state.reveal ? (
        <>
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Title style={{ fontSize: 23, flex: 1 }}>{state.reveal.word.toUpperCase()}</Title>
              <Chip text="Listen" icon={Volume1} tone="grey" onPress={() => playAudio(state.reveal!.audio, state.reveal!.word)} />
            </View>
            {!!state.reveal.phonetic && <Muted>{state.reveal.phonetic}</Muted>}
            {!!state.reveal.meaning && <Body>{state.reveal.meaning}</Body>}
            {!!state.reveal.example && <Muted>“{state.reveal.example}”</Muted>}
            <Chip text="Share result" icon={Share2} tone="mint" onPress={share} style={{ alignSelf: "flex-start", marginTop: 6 }} />
          </Card>
          {state.bonus_done ? (
            <Card style={{ gap: 8 }}>
              <Title>Bonus done</Title>
              {bonus && <Body>{bonus.feedback}</Body>}
              {bonus && <Muted>We heard: &quot;{bonus.transcript}&quot;</Muted>}
              {bonus?.xp ? <XpChip xp={bonus.xp} /> : <Muted>Come back tomorrow for a new word.</Muted>}
            </Card>
          ) : (
            <>
              <Card style={{ gap: 6 }}>
                <Title>Bonus: say a sentence</Title>
                <Muted>Use &quot;{state.reveal.word}&quot; in a sentence out loud for +20 XP.</Muted>
                {bonus && !bonus.correct && <Body style={{ color: C.redText }}>{bonus.feedback}</Body>}
                {bonus && !bonus.correct && <Muted>We heard: &quot;{bonus.transcript}&quot;</Muted>}
              </Card>
              <RecordPanel mic={mic} max={15} busy={busy} onFinish={() => router.back()} finishLabel="Skip" canFinish />
            </>
          )}
        </>
      ) : (
        <View style={{ gap: 8, marginTop: 8 }}>
          {KEYS.map((row, r) => (
            <View key={r} style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
              {r === 2 && <Key label="Enter" wide dark onPress={() => press("enter")} busy={busy} />}
              {[...row].map((k) => <Key key={k} label={k.toUpperCase()} mark={letters[k]} onPress={() => press(k)} />)}
              {r === 2 && <Key label="back" wide onPress={() => press("back")} />}
            </View>
          ))}
        </View>
      )}

      {!state.finished && (
        <Card style={{ gap: 10 }}>
          <Title style={{ fontSize: 16 }}>How to play</Title>
          {[
            "Type any five-letter word and press Enter.",
            "Green means the letter is in the right place; purple means it's in the word but somewhere else.",
            "Grey letters aren't in the word. Use the keyboard colours to plan your next guess.",
            "After the game, say a sentence with the word for bonus XP.",
          ].map((t, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10 }}>
              <View style={s.step}><Text style={s.stepText}>{i + 1}</Text></View>
              <Muted style={{ flex: 1, fontSize: 13 }}>{t}</Muted>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

// Mint and peach stay bright in Night, so their letters stay dark.
const onBright = (m?: Mark) => m === "correct" || m === "present";

function Key({ label, onPress, mark, wide, dark, busy }: { label: string; onPress: () => void; mark?: Mark; wide?: boolean; dark?: boolean; busy?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label === "back" ? "Delete letter" : label} onPress={onPress}
      style={({ pressed }) => [s.key, wide && { flex: 1.6 }, { backgroundColor: dark ? C.ink : mark ? TILE[mark] : C.surface }, pressed && { opacity: 0.7 }]}>
      {busy ? <ActivityIndicator color={C.onInk} /> : label === "back" ? <Delete size={22} color={C.ink} /> :
        <Text style={[s.keyText, onBright(mark) && { color: C.onMint }, dark && { color: C.onInk, fontSize: 16 }]}>{label}</Text>}
    </Pressable>
  );
}

const s = themed(() => StyleSheet.create({
  title: { fontFamily: F.extrabold, fontSize: 24, letterSpacing: -0.5, color: C.ink },
  step: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.mint, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: F.bold, fontSize: 12, color: C.onMint },
  tile: { flex: 1, aspectRatio: 1, borderRadius: 18, borderWidth: 2, borderColor: C.grey, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  tileText: { fontFamily: F.extrabold, fontSize: 25, color: C.ink },
  legend: { flexDirection: "row", justifyContent: "center", gap: 16, flexWrap: "wrap" },
  key: { flex: 1, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  keyText: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
}));
