import AsyncStorage from "@react-native-async-storage/async-storage";
import { Check, Lock, RotateCcw, Volume1 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TWISTER_LEVEL_KEY } from "@/components/PracticeList";
import { MicButton, StopButton, clock } from "@/components/Speaking";
import { Body, Button, Card, Chip, ErrorText, GreenCard, Header, Muted, Screen, Title } from "@/components/ui";
import { api, errorText, postAudio } from "@/lib/api";
import { playAudio, useMic } from "@/lib/audio";
import { useSession } from "@/lib/session";
import { C, F } from "@/lib/theme";

type Twister = { level: number; levels: number; id: number; text: string; pool_size: number; target_seconds: number; audio: string | null };
type Result = {
  accuracy: number; speed: number; score: number; words: { word: string; hit: boolean }[]; passed: boolean;
  transcript: string; seconds: number; xp: number; next_level: number | null;
};

export default function TongueTwister() {
  const { refresh } = useSession();
  const [unlocked, setUnlocked] = useState(1); // highest level reached, kept on this phone
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(0);
  const [twister, setTwister] = useState<Twister | null>(null);
  const [listened, setListened] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mic = useMic({ maxSeconds: 20, onWav: send, onError: setError });

  useEffect(() => {
    AsyncStorage.getItem(TWISTER_LEVEL_KEY).then((v) => {
      const n = Number(v) || 1;
      setUnlocked(n);
      setLevel(n);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api<Twister>(`/v1/tongue-twister/${level}`).then((t) => { setTwister(t); setError(""); }).catch((e) => setError(errorText(e)));
  }, [level, round]);

  function go(next: number) {
    setTwister(null);
    setResult(null);
    setListened(false);
    setLevel(next);
    setRound((r) => r + 1);
  }

  async function send(uri: string) {
    if (!twister) return;
    setBusy(true);
    setError("");
    try {
      const r = await postAudio<Result>(`/v1/tongue-twister/${level}`, uri, { twister_id: String(twister.id) });
      setResult(r);
      refresh();
      if (r.next_level && r.next_level > unlocked) {
        setUnlocked(r.next_level);
        AsyncStorage.setItem(TWISTER_LEVEL_KEY, String(r.next_level)).catch(() => {});
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const levels = twister?.levels ?? 15;
  return (
    <Screen scroll footer={
      <View style={s.bottom}>
        <Button title="Try again" tone="white" small onPress={() => setResult(null)} disabled={!result || mic.recording} />
        {mic.recording ? <StopButton onPress={mic.send} size={112} /> : <MicButton onPress={() => { setResult(null); mic.start(); }} disabled={!twister || busy} />}
        <Button title="Next level" tone="mint" small onPress={() => go(level + 1)} disabled={!result?.next_level || mic.recording} />
      </View>
    }>
      <Header title="Tongue Twister" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {[...Array(levels)].map((_, i) => {
          const n = i + 1;
          const open = n <= unlocked;
          return (
            <Pressable key={n} accessibilityRole="button" accessibilityLabel={open ? `Level ${n}` : `Level ${n}, locked`} disabled={!open || mic.recording}
              onPress={() => go(n)} style={[s.level, { backgroundColor: n === level ? C.ink : open ? C.mint : "#fff" }]}>
              {open ? <Text style={[s.levelText, n === level && { color: "#fff" }]}>{n}</Text> : <Lock size={20} color={C.muted} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <GreenCard style={{ gap: 18 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Muted style={{ color: C.onDarkMuted }}>Level {level} of {levels}</Muted>
          {twister && <Muted style={{ color: C.onDarkMuted }}>Aim for {twister.target_seconds} s</Muted>}
        </View>
        {twister ? <Text style={s.twister}>{twister.text}</Text> : <ActivityIndicator color={C.mint} />}
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Chip text="Listen once" icon={Volume1} tone="mint" style={s.cardChip}
            onPress={listened || !twister ? undefined : () => { playAudio(twister.audio, twister.text); setListened(true); }} />
          <Chip text="New twister" icon={RotateCcw} style={[s.cardChip, { backgroundColor: "rgba(255,255,255,0.12)" }]}
            onPress={() => go(level)} />
        </View>
      </GreenCard>
      <ErrorText>{error}</ErrorText>

      {mic.recording && <Muted style={{ textAlign: "center", fontSize: 18 }}>Recording… {clock(mic.seconds)}</Muted>}
      {busy && <ActivityIndicator color={C.green} />}
      {result && (
        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <View style={[s.badge, !result.passed && { backgroundColor: C.peachSoft }]}>
              {result.passed ? <Check size={28} color={C.ink} /> : <RotateCcw size={24} color={C.ink} />}
            </View>
            <View style={{ flex: 1 }}>
              <Title style={{ fontSize: 22 }}>{result.passed ? "Nicely done!" : "Almost there"}</Title>
              <Muted>{result.next_level ? `Level ${result.next_level} unlocked · ` : result.passed ? "" : "Get 80% of words right to unlock the next level · "}+{result.xp} XP</Muted>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={s.stat}><Text style={s.statValue}>{result.accuracy}%</Text><Muted>Words right</Muted></View>
            <View style={s.stat}><Text style={s.statValue}>{result.seconds} s</Text><Muted>Your time</Muted></View>
          </View>
          <Body><Text style={{ fontFamily: F.bold }}>We heard: </Text>&quot;{result.transcript}&quot;</Body>
        </Card>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  level: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  levelText: { fontFamily: F.bold, fontSize: 20, color: C.ink },
  twister: { fontFamily: F.bold, fontSize: 30, lineHeight: 38, color: C.onDark },
  cardChip: { paddingHorizontal: 18, paddingVertical: 12 },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.mint, alignItems: "center", justifyContent: "center" },
  stat: { flex: 1, backgroundColor: C.grey, borderRadius: 20, padding: 16 },
  statValue: { fontFamily: F.extrabold, fontSize: 30, color: C.ink },
  bottom: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
