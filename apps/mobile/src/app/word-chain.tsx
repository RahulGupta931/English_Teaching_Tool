import { router } from "expo-router";
import { Check, Volume1, X, Zap } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { MicButton, StopButton } from "@/components/Speaking";
import { Body, Button, Card, Chip, ErrorText, Header, Label, Muted, Ring, RoundButton, Screen, Title, XpChip } from "@/components/ui";
import { errorText, postAudio, postJson } from "@/lib/api";
import { playAudio, useMic } from "@/lib/audio";
import { useSession } from "@/lib/session";
import { C, F } from "@/lib/theme";

type Game = {
  id: number;
  words: { word: string; by: "ai" | "you"; points: number }[];
  score: number;
  next_letter: string | null;
  retry_used: boolean;
  finished: boolean;
  turn_seconds: number;
  ai_audio: string | null;
  turn: { heard: string | null; ok: boolean; points?: number; won?: boolean; reason?: string; retry?: boolean } | null;
  xp: number;
};

export default function WordChain() {
  const { refresh } = useSession();
  const [game, setGame] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clockLeft, setClockLeft] = useState(15);
  const mic = useMic({ maxSeconds: 15, onWav: send, onError: setError });

  const lastAi = (g: Game) => [...g.words].reverse().find((w) => w.by === "ai")?.word ?? "";
  const sayAi = (g: Game) => playAudio(g.ai_audio, lastAi(g));

  // Started from the rules screen, so the 15-second clock never runs before the learner is ready.
  async function start() {
    setBusy(true);
    setError("");
    try {
      const g = await postJson<Game>("/v1/word-chain", {});
      setGame(g);
      setClockLeft(g.turn_seconds);
      sayAi(g);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // The turn clock: the API allows turn_seconds (plus a grace period for uploading).
  // Out of time: send what's being said, or end the game as the web app does.
  useEffect(() => {
    if (!game || game.finished || busy) return;
    const t = setTimeout(() => {
      if (clockLeft > 1) return setClockLeft(clockLeft - 1);
      setClockLeft(0);
      if (mic.recording) mic.send();
      else stop();
    }, 1000);
    return () => clearTimeout(t);
  }, [clockLeft, game, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(uri: string) {
    if (!game) return;
    setBusy(true);
    setError("");
    try {
      const g = await postAudio<Game>(`/v1/word-chain/${game.id}/turn`, uri);
      setGame(g);
      setClockLeft(g.turn_seconds);
      if (g.finished) refresh();
      else if (g.turn?.ok) sayAi(g);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!game) return;
    mic.cancel();
    setBusy(true);
    try {
      setGame(await postJson<Game>(`/v1/word-chain/${game.id}/stop`, {}));
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (!game) {
    return (
      <Screen scroll footer={<Button title="Start game" tone="dark" busy={busy} onPress={start} style={{ flex: 1 }} />}>
        <Header title="Word Chain" subtitle="Last letter, next word" />
        <Card style={{ gap: 14 }}>
          <Title style={{ fontSize: 22 }}>How to play</Title>
          {[
            "The AI says a word. Say a word that starts with its last letter.",
            "You have 15 seconds for each word. No repeats.",
            "Longer words score more. Reach 10 words to beat the AI.",
            "If we mishear you, you get one retry per game.",
          ].map((t, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 12 }}>
              <View style={s.num}><Text style={s.numText}>{i + 1}</Text></View>
              <Body style={{ flex: 1 }}>{t}</Body>
            </View>
          ))}
        </Card>
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  const ai = lastAi(game);
  const yours = game.words.filter((w) => w.by === "you").length;
  const turn = game.turn;
  return (
    <Screen scroll style={{ flexGrow: 1 }}>
      <Header title="Word Chain" subtitle="Last letter, next word" right={<Chip icon={Zap} text={`${game.score} pts`} />} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {game.words.map((w, i) => (
          <View key={i} style={[s.word, w.by === "you" && { backgroundColor: C.mint }]}>
            <Text style={[s.wordText, w.by === "you" && { color: C.ink, fontFamily: F.bold }]}>{w.word}</Text>
            {w.by === "you" && <Text style={s.pts}>+{w.points}</Text>}
          </View>
        ))}
      </View>
      {turn && (
        <View style={[s.toast, !turn.ok && { backgroundColor: C.peachSoft }]}>
          {turn.ok ? <Check size={20} color={C.green2} /> : <X size={20} color={C.redText} />}
          <Body style={{ flex: 1, fontFamily: F.semibold, color: turn.ok ? C.green2 : C.redText }}>
            {turn.ok ? `We heard "${turn.heard}". +${turn.points} points!` : `${turn.reason}${turn.retry ? " One more try." : ""}`}
          </Body>
        </View>
      )}

      {game.finished ? (
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 32 }}>
          <Label>Game over</Label>
          <Text style={s.final}>{game.score}</Text>
          <Muted>{turn?.won ? "You beat the AI!" : `${yours} word${yours === 1 ? "" : "s"} in your chain`}</Muted>
          <XpChip xp={game.xp} />
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <Button title="Play again" tone="dark" small onPress={start} busy={busy} />
            <Button title="Done" tone="mint" small onPress={() => router.back()} />
          </View>
        </Card>
      ) : (
        <>
          <Card style={s.stage}>
            <Label>AI said</Label>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={s.aiWord}>{ai.slice(0, -1)}<Text style={{ color: C.peach }}>{ai.slice(-1)}</Text></Text>
              <RoundButton icon={Volume1} label="Hear the word" onPress={() => sayAi(game)} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Title>Your word starts with</Title>
              <View style={s.letter}><Text style={s.letterText}>{game.next_letter?.toUpperCase()}</Text></View>
            </View>
            <Ring value={clockLeft / game.turn_seconds} size={120} stroke={10} color={C.progress} track={C.grey}>
              {busy ? <ActivityIndicator color={C.green} /> : <Text style={s.clock}>{clockLeft}</Text>}
            </Ring>
          </Card>
          <ErrorText>{error}</ErrorText>
          <View style={s.bottom}>
            <Button title="End game" tone="white" small onPress={stop} disabled={busy} />
            {mic.recording ? <StopButton onPress={mic.send} size={112} /> : <MicButton onPress={mic.start} disabled={busy || clockLeft <= 0} />}
            <Muted style={{ textAlign: "right", fontSize: 14, width: 90 }}>Words: {yours}{"\n"}Longer = more points</Muted>
          </View>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  word: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  wordText: { fontFamily: F.semibold, fontSize: 17, color: C.muted },
  pts: { fontFamily: F.bold, fontSize: 13, color: C.ink },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.mintSoft, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14 },
  stage: { alignItems: "center", gap: 18, paddingVertical: 40, borderRadius: 36 },
  aiWord: { fontFamily: F.extrabold, fontSize: 56, letterSpacing: -2, color: C.ink },
  letter: { backgroundColor: C.peach, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  letterText: { fontFamily: F.extrabold, fontSize: 20, color: C.ink },
  clock: { fontFamily: F.extrabold, fontSize: 40, color: C.ink },
  final: { fontFamily: F.extrabold, fontSize: 72, color: C.ink, letterSpacing: -2 },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  num: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  numText: { fontFamily: F.bold, color: "#fff", fontSize: 14 },
});
