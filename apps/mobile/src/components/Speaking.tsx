import { router } from "expo-router";
import { Bot, Check, Mic, Square, Trash2, Volume1 } from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { errorText, postAudio, postJson, type Mistake } from "@/lib/api";
import { playAudio, stopAudio, useMic } from "@/lib/audio";
import { C, F, themed } from "@/lib/theme";
import { Body, Button, Card, Chip, CloseButton, Em, ErrorText, GreenCard, H2, Header, Label, MistakeCard, Muted, Ring, Title, XpChip } from "./ui";

export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** Live bars from the microphone level. */
export function Waveform({ levels, color = C.red }: { levels: number[]; color?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, height: 48 }}>
      {levels.map((b, i) => <View key={i} style={{ width: 5, borderRadius: 3, height: 8 + b * 40, backgroundColor: color }} />)}
    </View>
  );
}

/** Red stop button with soft halo (pages 9, 22). */
export function StopButton({ onPress, size = 100 }: { onPress: () => void; size?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Stop and send" onPress={onPress}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.redSoft, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size * 0.78, height: size * 0.78, borderRadius: size, backgroundColor: C.red, alignItems: "center", justifyContent: "center" }}>
        <Square size={size * 0.2} color="#fff" fill="#fff" />
      </View>
    </Pressable>
  );
}

/** Dark green mic button with grey ring (pages 16, 17). */
export function MicButton({ onPress, disabled, label = "Start speaking" }: { onPress: () => void; disabled?: boolean; label?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled}
      style={[s.micRing, disabled && { opacity: 0.5 }]}>
      <View style={s.mic}><Mic size={28} color={C.mint} strokeWidth={2} /></View>
    </Pressable>
  );
}

/** The partner's avatar with halo, and what it's doing ("Interviewer is listening…"). */
export function Avatar({ status, icon = "bot", onPress }: { status: string; icon?: "bot" | "mic"; onPress?: () => void }) {
  const I = icon === "bot" ? Bot : Mic;
  return (
    <View style={{ alignItems: "center", gap: 14 }}>
      <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={onPress ? "Send now" : undefined} onPress={onPress} disabled={!onPress} style={s.halo1}>
        <View style={s.halo2}><View style={s.avatar}><I size={28} color={C.mint} strokeWidth={2} /></View></View>
      </Pressable>
      <Text style={s.status}>{status}</Text>
    </View>
  );
}

export type Line = { role: "ai" | "you"; text: string; audio?: string | null };

export function Bubbles({ lines, scrollRef }: { lines: Line[]; scrollRef: React.RefObject<ScrollViewInstance | null> }) {
  return (
    <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingVertical: 12, flexGrow: 1, justifyContent: "flex-end" }}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
      {lines.map((l, i) => l.role === "ai" ? (
        <View key={i} style={{ alignItems: "flex-start", gap: 8, maxWidth: "85%" }}>
          <View style={[s.bubble, s.aiBubble]}><Body>{l.text}</Body></View>
          {/* 44px tall: the spec's minimum touch target */}
          <Chip text="Replay" icon={Volume1} tone="grey" onPress={() => playAudio(l.audio, l.text)} style={{ minHeight: 44, paddingHorizontal: 16 }} />
        </View>
      ) : (
        <View key={i} style={[s.bubble, s.youBubble]}><Body style={{ color: C.onMint }}>{l.text}</Body></View>
      ))}
    </ScrollView>
  );
}

/** White bottom panel: waveform + timer while recording, stop to send, bin to discard (page 9). */
export function RecordPanel({ mic, max, busy, onFinish, finishLabel = "Finish", canFinish, canSpeak = true, hint }: {
  mic: ReturnType<typeof useMic>; max: number; busy: boolean; onFinish: () => void; finishLabel?: string; canFinish: boolean; canSpeak?: boolean; hint?: string;
}) {
  return (
    <View style={s.panel}>
      {mic.recording ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Waveform levels={mic.levels} />
          <Text style={s.timer}>{clock(mic.seconds)} / {clock(max)}</Text>
        </View>
      ) : busy ? <ActivityIndicator color={C.green} style={{ height: 48 }} /> : null}
      <View style={s.panelRow}>
        <Button title={finishLabel} tone="grey" small onPress={onFinish} disabled={!canFinish || mic.recording || busy} style={{ paddingHorizontal: 22 }} />
        {mic.recording ? <StopButton onPress={mic.send} size={103} /> : <MicButton onPress={mic.start} disabled={busy || !canSpeak} />}
        <Pressable accessibilityRole="button" accessibilityLabel="Discard recording" onPress={mic.cancel} disabled={!mic.recording}
          style={[s.bin, !mic.recording && { opacity: 0 }]}>
          <Trash2 size={22} color={C.ink} />
        </Pressable>
      </View>
      <Muted style={{ fontSize: 14 }}>{mic.recording ? "Tap to send" : busy ? "Listening to your answer…" : hint ?? "Tap the mic and speak"}</Muted>
    </View>
  );
}

export type Opening = { session_id: number; reply: string; audio: string | null; turns_left: number };
type Turn = { transcript: string; reply: string; audio: string | null; turns_left: number };

/** Spoken back-and-forth with the AI (role-play and interview share the API shape). */
export function Conversation<R>({ base, opening, title, subtitle, partner, onFinished }: {
  base: "/v1/roleplay"; opening: Opening; title: string; subtitle: string; partner: string; onFinished: (r: R) => void;
}) {
  const [lines, setLines] = useState<Line[]>([{ role: "ai", text: opening.reply, audio: opening.audio }]);
  const [turnsLeft, setTurnsLeft] = useState(opening.turns_left);
  const [speaking, setSpeaking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollViewInstance>(null);
  const mic = useMic({ maxSeconds: 30, onWav: send, onError: setError });

  useEffect(() => {
    playAudio(opening.audio, opening.reply, () => setSpeaking(false));
    return stopAudio;
  }, [opening]);

  async function send(uri: string) {
    setBusy(true);
    setError("");
    try {
      const t = await postAudio<Turn>(`${base}/${opening.session_id}/turn`, uri);
      setLines((l) => [...l, { role: "you", text: t.transcript }, { role: "ai", text: t.reply, audio: t.audio }]);
      setTurnsLeft(t.turns_left);
      setSpeaking(true);
      playAudio(t.audio, t.reply, () => setSpeaking(false));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    stopAudio();
    setBusy(true);
    setError("");
    try {
      onFinished(await postJson<R>(`${base}/${opening.session_id}/finish`, {}));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  const status = mic.recording ? `${partner} is listening…` : busy ? "Thinking…" : speaking ? `${partner} is speaking…` : "Your turn";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 16, flex: 1 }}>
        <Header title={title} subtitle={subtitle} right={<Chip text={`${turnsLeft} turn${turnsLeft === 1 ? "" : "s"} left`} />} />
        <Avatar status={status} />
        <Bubbles lines={lines} scrollRef={scrollRef} />
        <ErrorText>{error}</ErrorText>
      </View>
      <RecordPanel mic={mic} max={30} busy={busy} onFinish={finish} canFinish={lines.length > 1} canSpeak={turnsLeft > 0}
        hint={turnsLeft > 0 ? undefined : "That's all the turns. Tap Finish for your feedback."} />
    </SafeAreaView>
  );
}

export type Debrief = {
  score: number; summary: string; mistakes: Mistake[]; better_phrases: { original: string; natural: string }[]; xp: number;
  interview: { readiness: number; verdict: string; strengths: string[]; weaknesses: { area: string; detail: string; improve: string }[] } | null;
};

/** Dark green score header + light sheet with "Fix these" (page 7). */
export function Results({ score, headline, summary, xp, children, onAgain, onDone, againLabel = "Practise again", doneLabel = "Done" }: {
  score: number; headline: ReactNode; summary: string; xp: number; children?: ReactNode; onAgain: () => void; onDone?: () => void; againLabel?: string; doneLabel?: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.green }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <SafeAreaView edges={["top"]} style={{ alignItems: "center", paddingHorizontal: 24, paddingBottom: 30, gap: 14 }}>
          <View style={{ alignSelf: "flex-end" }}><CloseButton dark onPress={onDone} /></View>
          <Ring value={score / 100} size={170}>
            <Text style={s.bigScore}>{score}</Text>
            <Muted style={{ color: C.onDarkMuted }}>out of 100</Muted>
          </Ring>
          <Text style={s.headline}>{headline}</Text>
          {!!summary && <Body style={{ color: C.onDarkMuted, textAlign: "center" }}>{summary}</Body>}
          <View style={{ alignSelf: "center" }}><XpChip xp={xp} /></View>
        </SafeAreaView>
        <View style={s.sheet}>
          <View style={s.grabber} />
          {children}
        </View>
      </ScrollView>
      <SafeAreaView edges={["bottom"]} style={s.footer}>
        <Button title={againLabel} tone="dark" onPress={onAgain} style={{ flex: 1 }} />
        <Button title={doneLabel} tone="mint" onPress={onDone ?? (() => router.back())} style={{ flex: 1 }} />
      </SafeAreaView>
    </View>
  );
}

export function FixThese({ mistakes, phrases = [] }: { mistakes: Mistake[]; phrases?: { original: string; natural: string }[] }) {
  if (!mistakes.length && !phrases.length) return <Muted style={{ textAlign: "center" }}>No mistakes this time. Well done!</Muted>;
  return (
    <>
      <H2 style={{ fontSize: 18 }}>Fix these</H2>
      {mistakes.map((m, i) => <MistakeCard key={i} m={m} />)}
      {phrases.map((p, i) => (
        <Card key={`p${i}`} style={{ gap: 6 }}>
          <Chip text="Sound more natural" tone="mintSoft" style={{ alignSelf: "flex-start", marginBottom: 4 }} />
          <Muted style={{ fontSize: 16 }}>{p.original}</Muted>
          <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.green2 }}>{p.natural}</Text>
        </Card>
      ))}
    </>
  );
}

/** Interview readiness report (page 13). */
export function InterviewReport({ d, onAgain }: { d: Debrief; onAgain: () => void }) {
  const iv = d.interview!;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Label>Interview report</Label>
          <CloseButton />
        </View>
        <GreenCard style={{ flexDirection: "row", gap: 18, alignItems: "center" }}>
          <Ring value={iv.readiness / 100} size={110} stroke={14}>
            <Text style={[s.bigScore, { fontSize: 36 }]}>{iv.readiness}</Text>
          </Ring>
          <View style={{ flex: 1, gap: 6 }}>
            <Title style={{ color: C.onDark, fontSize: 20 }}>Interview readiness</Title>
            <Body style={{ color: C.onDarkMuted }}>{iv.verdict}</Body>
          </View>
        </GreenCard>
        {iv.strengths.length > 0 && (
          <Card style={{ gap: 10 }}>
            <Title>Strengths</Title>
            {iv.strengths.map((x) => (
              <View key={x} style={{ flexDirection: "row", gap: 10 }}><Check size={20} color={C.progress} /><Body style={{ flex: 1 }}>{x}</Body></View>
            ))}
          </Card>
        )}
        {iv.weaknesses.length > 0 && <Title>Areas to work on</Title>}
        {iv.weaknesses.map((w) => (
          <Card key={w.area} style={{ gap: 6 }}>
            <Title style={{ fontSize: 15 }}>{w.area}</Title>
            <Body style={{ color: C.muted }}>{w.detail}</Body>
            {!!w.improve && <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.green2 }}>Try: {w.improve}</Text>}
          </Card>
        ))}
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Ring value={d.score / 100} size={54} stroke={7} color={C.progress} track={C.grey}><Text style={{ fontFamily: F.bold, color: C.ink }}>{d.score}</Text></Ring>
          <View style={{ flex: 1 }}>
            <Title style={{ fontSize: 17 }}>Your spoken English</Title>
            <Muted>{d.summary}</Muted>
          </View>
          <XpChip xp={d.xp} tone="mint" />
        </Card>
        <FixThese mistakes={d.mistakes} phrases={d.better_phrases} />
      </ScrollView>
      <View style={s.footer}>
        <Button title="Try again" tone="dark" onPress={onAgain} style={{ flex: 1 }} />
        <Button title="Done" tone="mint" onPress={() => router.back()} style={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  );
}

/** "Great *interview*, Asha" */
export const Headline = ({ before, em, after }: { before: string; em: string; after: string }) => (
  <>{before} <Em style={{ color: C.mint, fontSize: 31 }}>{em}</Em>{after}</>
);

const s = themed(() => StyleSheet.create({
  micRing: { width: 94, height: 94, borderRadius: 47, backgroundColor: C.grey, alignItems: "center", justifyContent: "center" },
  mic: { width: 74, height: 74, borderRadius: 37, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  halo1: { width: 124, height: 124, borderRadius: 62, backgroundColor: C.mintSoft, alignItems: "center", justifyContent: "center" },
  halo2: { width: 104, height: 104, borderRadius: 52, backgroundColor: C.halo, alignItems: "center", justifyContent: "center" },
  avatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  status: { fontFamily: F.bold, fontSize: 17, color: C.green2 },
  // ChatBubble design spec: 20px radius on every bubble, received grey, sent green, no shadows.
  bubble: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 20 },
  aiBubble: { backgroundColor: C.chatReceived },
  youBubble: { backgroundColor: C.chatSent, alignSelf: "flex-end", maxWidth: "85%" },
  panel: { backgroundColor: C.surface, borderRadius: 22, marginHorizontal: 12, marginBottom: 4, padding: 20, alignItems: "center", gap: 10,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 16, elevation: 6 },
  panelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch" },
  timer: { fontFamily: F.bold, fontSize: 16, color: C.redText },
  bin: { width: 64, height: 64, borderRadius: 22, backgroundColor: C.grey, alignItems: "center", justifyContent: "center" },
  bigScore: { fontFamily: F.extrabold, fontSize: 59, color: C.onDark, letterSpacing: -2 },
  headline: { fontFamily: F.extrabold, fontSize: 28, color: C.onDark, textAlign: "center", letterSpacing: -0.8 },
  sheet: { flexGrow: 1, backgroundColor: C.bg, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20, gap: 14 },
  grabber: { width: 64, height: 6, borderRadius: 3, backgroundColor: C.absent, alignSelf: "center", marginBottom: 6 },
  footer: { flexDirection: "row", gap: 14, paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8, backgroundColor: C.bg },
}));
