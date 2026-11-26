import { router } from "expo-router";
import { GraduationCap, Mic, Pause, Volume1 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Bubbles, type Line } from "@/components/Speaking";
import { BackButton, Body, Button, Card, Chip, CloseButton, Em, ErrorText, GreenCard, Header, IconTile, Label, MistakeCard, Muted, Screen, Stat, Title, XpChip } from "@/components/ui";
import { errorText, postAudio, postJson, type Mistake } from "@/lib/api";
import { playAudio, stopAudio, useMic } from "@/lib/audio";
import { useSession } from "@/lib/session";
import { C, F } from "@/lib/theme";

type Lang = "english" | "hinglish";
type Start = { session_id: number; reply: string; audio: string | null; turns_left: number; language: Lang; mistakes: number };
type Turn = { transcript: string; reply: string; audio: string | null; turns_left: number };
type Recap = { summary: string; audio: string | null; mistakes: Mistake[]; xp: number };

export default function Coach() {
  const { me, refresh } = useSession();
  const [lang, setLang] = useState<Lang>(me?.user.explain_lang ?? "english");
  const [session, setSession] = useState<Start | null>(null);
  const [recap, setRecap] = useState<(Recap & { turns: number; practised: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      setSession(await postJson<Start>("/v1/coach", { language: lang }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (recap) {
    return <CoachRecap r={recap} onAgain={() => { setRecap(null); setSession(null); }} />;
  }
  if (session) {
    return <Session start={session} onFinished={(r, turns) => { setRecap({ ...r, turns, practised: session.mistakes }); refresh(); }} />;
  }

  // The coach works through the latest mistakes, one per sentence (as the API picks them).
  const seen = new Set<string>();
  const recent = (me?.mistakes ?? []).filter((m) => !seen.has(m.original.toLowerCase()) && seen.add(m.original.toLowerCase()));
  return (
    <Screen scroll footer={
      <View style={{ flex: 1, gap: 10 }}>
        <Button title="Start coaching" tone="dark" icon={Mic} busy={busy} disabled={!recent.length} onPress={start} />
        <Muted style={{ textAlign: "center", fontSize: 14 }}>Your microphone opens only while it&apos;s your turn to speak.</Muted>
      </View>
    }>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <BackButton />
        <View style={s.segment}>
          {(["english", "hinglish"] as const).map((l) => (
            <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: lang === l }} onPress={() => setLang(l)}
              style={[s.segItem, lang === l && { backgroundColor: C.ink }]}>
              <Text style={[s.segText, lang === l && { color: "#fff" }]}>{l === "english" ? "English" : "Hinglish"}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={s.hero}>
        <View style={s.ring} />
        <IconTile icon={GraduationCap} bg={C.ink} color={C.peachSoft} size={72} />
        <Label style={{ marginTop: 12 }}>Mistake coach</Label>
        <Text style={s.heroTitle}>Fix your recent <Em style={{ fontSize: 40 }}>mistakes</Em></Text>
        <Body style={{ color: C.muted, fontSize: 17, lineHeight: 25 }}>Your coach explains each one, you say it the right way, and it checks you. Hands-free: just speak.</Body>
      </View>
      {recent.length ? (
        <>
          <Title style={{ fontSize: 22 }}>You&apos;ll practise these</Title>
          {recent.slice(0, 8).map((m, i) => <MistakeCard key={i} m={{ ...m, explanation: "" }} hideType />)}
        </>
      ) : (
        <Card style={{ gap: 14 }}>
          <Body>You have no saved mistakes yet. Do a role-play, JAM or quiz first, and the coach will help you with what you got wrong.</Body>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Chip text="Role-play" tone="mint" onPress={() => router.push("/roleplay")} />
            <Chip text="JAM" tone="mint" onPress={() => router.push("/jam")} />
            <Chip text="MCQ Quiz" tone="mint" onPress={() => router.push("/quiz")} />
          </View>
        </Card>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

/** Hands-free coaching (page 21): the mic opens after the coach speaks and sends when the learner stops. */
function Session({ start, onFinished }: { start: Start; onFinished: (r: Recap, turns: number) => void }) {
  const [lines, setLines] = useState<Line[]>([{ role: "ai", text: start.reply, audio: start.audio }]);
  const [turnsLeft, setTurnsLeft] = useState(start.turns_left);
  const [paused, setPaused] = useState(false);
  const [speaking, setSpeaking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollViewInstance>(null);
  const pausedRef = useRef(false);
  const mic = useMic({ maxSeconds: 30, handsFree: true, onWav: send, onError: (m) => { setError(m); pause(); }, onSilence: pause });

  const listen = () => {
    setSpeaking(false);
    if (!pausedRef.current) mic.start();
  };
  useEffect(() => {
    playAudio(start.audio, start.reply, listen);
    return stopAudio;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function pause() {
    pausedRef.current = true;
    setPaused(true);
    mic.cancel();
  }
  function resume() {
    pausedRef.current = false;
    setPaused(false);
    setError("");
    stopAudio();
    mic.start();
  }

  async function send(uri: string) {
    setBusy(true);
    setError("");
    try {
      const t = await postAudio<Turn>(`/v1/coach/${start.session_id}/turn`, uri);
      setLines((l) => [...l, { role: "you", text: t.transcript }, { role: "ai", text: t.reply, audio: t.audio }]);
      setTurnsLeft(t.turns_left);
      setSpeaking(true);
      playAudio(t.audio, t.reply, t.turns_left > 0 ? listen : () => setSpeaking(false));
    } catch (e) {
      setError(errorText(e));
      pause();
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    pause();
    stopAudio();
    setBusy(true);
    try {
      onFinished(await postJson<Recap>(`/v1/coach/${start.session_id}/finish`, {}), (lines.length - 1) / 2);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  const status = busy ? "Checking…" : mic.recording ? "Listening… just speak" : speaking ? "Coach is speaking…" : paused ? "Paused" : turnsLeft ? "Your turn" : "All turns used";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 12 }}>
        <Header title="Coaching session" subtitle={`Mistake Coach · ${start.language === "hinglish" ? "Hinglish" : "English"}`}
          right={<Chip text={`${turnsLeft} turn${turnsLeft === 1 ? "" : "s"} left`} />} />
        <Bubbles lines={lines} scrollRef={scrollRef} />
        <ErrorText>{error}</ErrorText>
      </View>
      <View style={s.panel}>
        <Avatar status={status} icon="mic" onPress={mic.recording ? mic.send : undefined} />
        {mic.recording && <Muted style={{ fontSize: 14, marginTop: -6 }}>Done? Tap the mic to send now</Muted>}
        <View style={{ flexDirection: "row", gap: 12, alignSelf: "stretch" }}>
          {paused ? (
            <Button title="Resume" tone="grey" icon={Mic} onPress={resume} disabled={busy || turnsLeft === 0} style={{ flex: 1 }} />
          ) : (
            <Button title="Pause" tone="grey" icon={Pause} onPress={pause} disabled={busy} style={{ flex: 1 }} />
          )}
          <Button title="Finish & recap" tone="dark" onPress={finish} busy={busy && !mic.recording} disabled={lines.length < 3} style={{ flex: 1.3 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Coach recap (page 20). */
function CoachRecap({ r, onAgain }: { r: Recap & { turns: number; practised: number }; onAgain: () => void }) {
  useEffect(() => {
    playAudio(r.audio, r.summary);
    return stopAudio;
  }, [r]);
  return (
    <Screen scroll footer={
      <>
        <Button title="Practise again" tone="dark" onPress={onAgain} style={{ flex: 1 }} />
        <Button title="Home" tone="mint" onPress={() => router.dismissTo("/")} style={{ flex: 1 }} />
      </>
    }>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Label>Coach recap</Label>
        <CloseButton />
      </View>
      <GreenCard style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <XpChip xp={r.xp} />
          <Pressable accessibilityRole="button" accessibilityLabel="Hear the recap again" onPress={() => playAudio(r.audio, r.summary)} style={s.speaker}>
            <Volume1 size={24} color={C.mint} />
          </Pressable>
        </View>
        <Text style={s.recapTitle}>You practised <Em style={{ color: C.mint, fontSize: 38 }}>{r.practised}</Em> mistake{r.practised === 1 ? "" : "s"}</Text>
        <Body style={{ color: C.onDarkMuted }}>{r.summary}</Body>
      </GreenCard>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Stat value={r.practised} label="Practised" bg={C.mint} />
        <Stat value={r.mistakes.length} label="New to fix" bg={C.peachSoft} />
        <Stat value={r.turns} label="Turns" />
      </View>
      {r.mistakes.length > 0 && <Title style={{ fontSize: 22 }}>New things to work on</Title>}
      {r.mistakes.map((m, i) => <MistakeCard key={i} m={m} />)}
    </Screen>
  );
}

const s = StyleSheet.create({
  segment: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 999, padding: 5 },
  segItem: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  segText: { fontFamily: F.semibold, fontSize: 17, color: C.muted },
  hero: { backgroundColor: C.peachSoft, borderRadius: 32, padding: 28, gap: 8, overflow: "hidden" },
  ring: { position: "absolute", right: -50, top: -30, width: 220, height: 220, borderRadius: 110, borderWidth: 40, borderColor: "#F6C3A8" },
  heroTitle: { fontFamily: F.extrabold, fontSize: 36, lineHeight: 42, letterSpacing: -1, color: C.ink },
  panel: { backgroundColor: "#fff", borderRadius: 36, marginHorizontal: 12, marginBottom: 4, padding: 20, alignItems: "center", gap: 14,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 16, elevation: 6 },
  speaker: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  recapTitle: { fontFamily: F.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8, color: C.onDark },
});
