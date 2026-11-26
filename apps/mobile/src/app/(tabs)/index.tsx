import { useFocusEffect, router, type Href } from "expo-router";
import { Briefcase, Check, Flame, GraduationCap, Target } from "lucide-react-native";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Chip, GreenCard, H1, H2, Label, List, MistakeCard, Muted, Row, Screen, Title } from "@/components/ui";
import { useSession } from "@/lib/session";
import { C, F } from "@/lib/theme";

// The API stores activity times in UTC as "YYYY-MM-DD HH:MM:SS".
const when = (utc: string) => new Date(utc.replace(" ", "T") + "Z");
const localDay = (utc: string) => when(utc).toDateString();
function ago(utc: string) {
  const min = Math.round((Date.now() - when(utc).getTime()) / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.round(min / 60)} h ago`;
  return when(utc).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Activity kinds the API records (db.award).
const KINDS: Record<string, string> = {
  roleplay: "Role-play", coach: "Mistake Coach", jam: "JAM", daily_word: "Daily Word", daily_word_bonus: "Daily Word bonus",
  word_chain: "Word Chain", tongue_twister: "Tongue Twister", quiz: "MCQ Quiz", placement: "Placement Test",
};

const PLAN: { kind: string; title: string; text: string; time: string; href: Href; tone: "green" | "peach" | "white" }[] = [
  { kind: "daily_word", title: "Daily Word", text: "Guess today's five-letter word in six tries.", time: "2 min", href: "/daily-word", tone: "green" },
  { kind: "jam", title: "JAM", text: "Speak for one minute on today's topic.", time: "1 min", href: "/jam", tone: "peach" },
  { kind: "roleplay", title: "Role-play", text: "Talk with an AI partner about your day.", time: "5 min", href: "/roleplay", tone: "white" },
];

export default function Home() {
  const { me, refresh } = useSession();
  useFocusEffect(useCallback(() => void refresh(), [refresh])); // XP and streak change after every activity
  if (!me) return null;
  const { user } = me;

  const today = new Date();
  const doneDays = new Set(me.activities.map((a) => localDay(a.created_at)));
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const week = [...Array(7)].map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { letter: "MTWTFSS"[i], done: doneDays.has(d.toDateString()), isToday: d.toDateString() === today.toDateString(), future: d > today };
  });
  const doneToday = new Set(me.activities.filter((a) => localDay(a.created_at) === today.toDateString()).map((a) => a.kind));
  const mistakes = new Set(me.mistakes.map((m) => m.original.toLowerCase())).size;
  const limitMinutes = Math.round(me.speaking_limit_seconds / 60);
  const minutesLeft = Math.max(0, Math.round((me.speaking_limit_seconds - me.speaking_seconds_today) / 60));
  const usedPct = me.speaking_limit_seconds ? Math.min(100, (me.speaking_seconds_today / me.speaking_limit_seconds) * 100) : 0;
  const best = Object.entries(me.best);

  return (
    <Screen scroll style={{ paddingBottom: 140, gap: 22 }}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Label>{today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</Label>
          <H1 style={{ fontSize: 40 }}>Hi {user.name.split(" ")[0]}</H1>
        </View>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{user.name[0]?.toUpperCase()}</Text>
          <View style={s.streak}>
            <Flame size={14} color={C.ink} strokeWidth={2.4} />
            <Text style={s.streakText}>{user.streak}</Text>
          </View>
        </View>
      </View>

      <View style={s.week}>
        {week.map((d, i) => (
          <View key={i} style={{ alignItems: "center", gap: 8 }}>
            <Text style={[s.dayLetter, d.isToday && { color: C.ink }]}>{d.letter}</Text>
            {d.done ? (
              <View style={[s.dot, { backgroundColor: C.mint }]}><Check size={20} color={C.ink} strokeWidth={2.4} /></View>
            ) : d.isToday ? (
              <View style={[s.dot, s.today]}><Text style={s.todayText}>Today</Text></View>
            ) : (
              <View style={[s.dot, { backgroundColor: d.future ? "transparent" : C.grey, borderWidth: d.future ? 1.5 : 0, borderColor: C.absent }]} />
            )}
          </View>
        ))}
      </View>

      <View style={s.between}>
        <H2>Today&apos;s plan</H2>
        <Muted>{PLAN.filter((p) => doneToday.has(p.kind)).length} of {PLAN.length} done</Muted>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
        {PLAN.map((p) => {
          const done = doneToday.has(p.kind);
          const dark = p.tone === "green";
          const inner = (
            <>
              <Chip text={done ? "Done today" : p.time} icon={done ? Check : undefined} tone={dark ? "mintSoft" : "white"}
                style={[{ alignSelf: "flex-start" }, dark && { backgroundColor: "rgba(125,232,180,0.18)" }]} />
              <Text style={[s.planTitle, dark && { color: C.onDark }]}>{p.title}</Text>
              <Muted style={dark ? { color: C.onDarkMuted } : undefined}>{p.text}</Muted>
              <Button title={done ? "Play again" : "Play"} tone={dark ? "mint" : "dark"} small style={{ alignSelf: "flex-start", minWidth: 180, marginTop: 6 }}
                onPress={() => router.push(p.href)} />
            </>
          );
          return dark
            ? <GreenCard key={p.kind} style={s.planCard}>{inner}</GreenCard>
            : <View key={p.kind} style={[s.card, s.planCard, { backgroundColor: p.tone === "peach" ? C.peachSoft : "#fff" }]}>{inner}</View>;
        })}
      </ScrollView>

      <H2>Keep practising</H2>
      <List>
        <Row first icon={GraduationCap} iconBg={C.peachSoft} title="Mistake Coach"
          subtitle={mistakes ? `${mistakes} mistake${mistakes === 1 ? "" : "s"} ready to fix` : "Practise first, then fix your mistakes"}
          onPress={() => router.push("/coach")} />
        <Row icon={Briefcase} iconBg={C.mint} title="Interview prep" subtitle="Practise from your resume" onPress={() => router.push("/interview")} />
      </List>
      {!user.level && (
        <List>
          <Row first icon={Target} iconBg={C.grey} title="Find your level" subtitle="A 3-question speaking test" onPress={() => router.push("/placement")} />
        </List>
      )}

      <Card style={{ gap: 10 }}>
        <View style={s.between}>
          <Title>Speaking today</Title>
          <Muted>{minutesLeft} of {limitMinutes} min left</Muted>
        </View>
        <View style={s.track}><View style={[s.fill, { width: `${usedPct}%` }]} /></View>
        <Muted style={{ fontSize: 14 }}>Speaking time resets every day. Upgrade on the Me tab for more.</Muted>
      </Card>

      {best.length > 0 && (
        <>
          <H2>Best scores</H2>
          <Card style={{ gap: 12 }}>
            {best.map(([kind, score]) => (
              <View key={kind} style={{ gap: 6 }}>
                <View style={s.between}>
                  <Body>{KINDS[kind] ?? kind}</Body>
                  <Text style={s.score}>{score}</Text>
                </View>
                <View style={s.track}><View style={[s.fill, { width: `${score}%` }]} /></View>
              </View>
            ))}
          </Card>
        </>
      )}

      {me.mistakes.length > 0 && (
        <>
          <View style={s.between}>
            <H2>Mistakes to review</H2>
            <Text style={s.link} onPress={() => router.push("/coach")}>Fix with coach</Text>
          </View>
          {me.mistakes.slice(0, 3).map((m, i) => <MistakeCard key={i} m={m} />)}
        </>
      )}

      <H2>Recent activity</H2>
      {me.activities.length === 0 ? (
        <Muted>Nothing yet. Play today&apos;s Daily Word to start your streak.</Muted>
      ) : (
        <List>
          {me.activities.slice(0, 6).map((a, i) => (
            <Row key={i} first={i === 0} title={KINDS[a.kind] ?? a.kind} subtitle={ago(a.created_at)}
              right={<View style={{ alignItems: "flex-end" }}>
                {a.score !== null && <Text style={s.score}>{a.score}</Text>}
                <Muted style={{ fontSize: 14 }}>+{a.xp} XP</Muted>
              </View>} />
          ))}
        </List>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: F.bold, fontSize: 32, color: C.mint },
  streak: { position: "absolute", right: -10, bottom: -4, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.peach, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 3, borderColor: C.bg },
  streakText: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  week: { flexDirection: "row", justifyContent: "space-between" },
  dayLetter: { fontFamily: F.semibold, fontSize: 15, color: C.muted },
  dot: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  today: { borderWidth: 2, borderStyle: "dashed", borderColor: C.green },
  todayText: { fontFamily: F.semibold, fontSize: 10, color: C.ink },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  card: { borderRadius: 28, padding: 22 },
  planCard: { width: 300, gap: 8 },
  track: { height: 10, borderRadius: 5, backgroundColor: C.grey, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5, backgroundColor: C.progress },
  score: { fontFamily: F.bold, fontSize: 17, color: C.ink },
  link: { fontFamily: F.bold, fontSize: 15, color: C.green2 },
  planTitle: { fontFamily: F.extrabold, fontSize: 30, letterSpacing: -0.8, color: C.ink },
});
