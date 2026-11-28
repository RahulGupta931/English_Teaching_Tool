import { useFocusEffect, router, type Href } from "expo-router";
import { Check, ChevronRight, Flame, GraduationCap, History, LayoutGrid, MessagesSquare, Settings, Sparkles, Target, Timer, Trophy, Zap, type LucideIcon } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ACTIVITIES, ActivityCard, kindIcon } from "@/components/Activities";
import { Button, Card, Chip, Em, GreenCard, H1, H2, IconTile, Label, MistakeCard, Muted, RoundButton, Screen } from "@/components/ui";
import { ago, doneToday as doneTodayOf, KINDS, localDay, when } from "@/lib/activity";
import type { Me } from "@/lib/api";
import { useSession } from "@/lib/session";
import { C, F, themed } from "@/lib/theme";

const PLAN: { kind: string; title: string; text: string; time: string; href: Href; icon: LucideIcon }[] = [
  { kind: "daily_word", title: "Daily Word", text: "Guess today's word", time: "2 min", href: "/daily-word", icon: LayoutGrid },
  { kind: "jam", title: "JAM", text: "Speak for one minute", time: "1 min", href: "/jam", icon: Timer },
  { kind: "roleplay", title: "Role-play", text: "Chat with an AI partner", time: "5 min", href: "/roleplay", icon: MessagesSquare },
];
const WEEK_GOAL = 5; // practice days a week, same as web
const activity = (href: string) => ACTIVITIES.find((a) => a.href === href)!;

/** Home, laid out like the web Home: Today, Your progress, Keep practising, mistakes, activity, this week. */
export default function Home() {
  const { me, refresh } = useSession();
  const [tab, setTab] = useState<"recent" | "best">("recent");
  useFocusEffect(useCallback(() => void refresh(), [refresh])); // XP and streak change after every activity
  if (!me) return null;
  const { user } = me;

  const doneToday = doneTodayOf(me.activities);
  const planDone = PLAN.filter((p) => doneToday.has(p.kind)).length;
  const next = PLAN.find((p) => !doneToday.has(p.kind));
  const seen = new Set<string>();
  const mistakes = me.mistakes.filter((m) => {
    const k = m.original.toLowerCase();
    return seen.has(k) ? false : (seen.add(k), true);
  });
  const minutesLeft = Math.max(0, Math.round((me.speaking_limit_seconds - me.speaking_seconds_today) / 60));
  const limit = Math.round(me.speaking_limit_seconds / 60);
  const leftPct = me.speaking_limit_seconds ? Math.max(0, 100 - (me.speaking_seconds_today / me.speaking_limit_seconds) * 100) : 0;
  const best = Object.entries(me.best).sort((a, b) => b[1] - a[1]);
  const suggestion = suggest(user.level, me.best);

  return (
    <Screen scroll style={{ paddingBottom: 120, gap: 20 }} onRefresh={refresh}>
      <View style={[s.between, { marginTop: 8 }]}>
        <View>
          <Label>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</Label>
          <H1 style={{ fontSize: 30 }}>Hi {user.name.split(" ")[0]}!</H1>
        </View>
        <RoundButton icon={Settings} label="Settings" onPress={() => router.push("/settings")} />
      </View>

      {/* Your progress: streak, week, XP, level, speaking time */}
      <Card style={{ gap: 14 }}>
        <Text style={s.cardTitle}>Your progress</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={s.flame}><Flame size={20} color={C.purple} strokeWidth={2.4} /></View>
          <View>
            <Text style={s.big}>{user.streak} {user.streak === 1 ? "day" : "days"}</Text>
            <Muted style={{ fontSize: 12 }}>{user.streak ? "Current streak" : "Practise today to start a streak"}</Muted>
          </View>
        </View>
        <WeekDots activities={me.activities} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <MiniStat icon={Zap} label="Total XP" value={user.xp.toLocaleString("en-IN")} />
          <MiniStat icon={Target} label="Level" value={user.level ? user.level[0].toUpperCase() + user.level.slice(1) : "Find out"}
            onPress={user.level ? undefined : () => router.push("/placement")} />
        </View>
        <View style={{ gap: 6 }}>
          <View style={s.between}>
            <Text style={s.rowLabel}>Speaking left today</Text>
            <Muted style={{ fontSize: 13 }}>{minutesLeft} of {limit} min</Muted>
          </View>
          <Bar pct={leftPct} />
        </View>
      </Card>

      {/* Today: today's plan and one button for the next thing to do */}
      <GreenCard style={{ gap: 14 }}>
        <Text style={s.todayTitle}>
          {planDone === PLAN.length ? <>All done for <Em style={{ color: C.peach }}>today</Em></> : <>Your English sounds <Em style={{ color: C.peach }}>better</Em> every day</>}
        </Text>
        <Text style={s.onDarkSmall}>{planDone} of {PLAN.length} done today</Text>
        <View style={s.heroTrack}><View style={[s.heroFill, { width: `${(planDone / PLAN.length) * 100}%` }]} /></View>
        <View style={{ gap: 8 }}>
          {PLAN.map((p) => {
            const done = doneToday.has(p.kind);
            return (
              <Pressable key={p.kind} accessibilityRole="button" accessibilityLabel={`${p.title}${done ? ", done today" : ""}`} onPress={() => router.push(p.href)} style={s.task}>
                <View style={[s.taskIcon, done && { backgroundColor: C.mint }]}>
                  {done ? <Check size={16} color={C.onMint} strokeWidth={2.8} /> : <p.icon size={16} color={C.mint} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.taskTitle, done && { textDecorationLine: "line-through", color: C.onDarkMuted }]}>{p.title}</Text>
                  <Text style={s.onDarkSmall} numberOfLines={1}>{done ? "Done today · play again" : `${p.time} · ${p.text}`}</Text>
                </View>
                <ChevronRight size={18} color={C.onDarkMuted} />
              </Pressable>
            );
          })}
        </View>
        {user.level
          ? <Button title={next ? `Continue: ${next.title}` : "Practise something new"} icon={next ? next.icon : Sparkles} tone="peach" small
            style={{ alignSelf: "flex-start" }} onPress={() => router.push(next ? next.href : "/practice")} />
          : <Button title="Find your level" icon={Target} tone="peach" small style={{ alignSelf: "flex-start" }} onPress={() => router.push("/placement")} />}
      </GreenCard>

      <View style={{ gap: 12 }}>
        <View style={s.between}>
          <H2>Keep practising</H2>
          <Text style={s.link} onPress={() => router.push("/practice")} accessibilityRole="link">See all</Text>
        </View>
        <View style={s.grid}>
          <ActivityCard a={{ ...activity("/coach"), text: mistakes.length ? `${mistakes.length} mistake${mistakes.length === 1 ? "" : "s"} to fix` : "Practise first, then fix mistakes" }} />
          <ActivityCard a={activity("/interview")} />
          <ActivityCard full a={{ ...activity(suggestion.href), title: `Suggested: ${activity(suggestion.href).title}`, text: suggestion.why }} />
        </View>
      </View>

      <Card style={{ gap: 12 }}>
        <View style={s.between}>
          <Text style={s.cardTitle}>Mistakes to review</Text>
          {mistakes.length > 0 && <Text style={s.link} onPress={() => router.push("/mistakes")} accessibilityRole="link">See all {mistakes.length}</Text>}
        </View>
        {mistakes.length === 0 ? (
          <Muted>Anything you get wrong in a role-play, JAM or quiz shows up here to review.</Muted>
        ) : (
          <>
            {mistakes.slice(0, 2).map((m, i) => <MistakeCard key={i} m={m} />)}
            <Button title="Fix them with Mistake Coach" icon={GraduationCap} tone="grey" small style={{ alignSelf: "flex-start" }} onPress={() => router.push("/coach")} />
          </>
        )}
      </Card>

      {/* Your activity: Recent or Best scores, like the web tabs */}
      <Card style={{ gap: 12 }}>
        <View style={s.between}>
          <Text style={s.cardTitle}>Your activity</Text>
          <View style={s.segment}>
            {([["recent", "Recent"], ["best", "Best scores"]] as const).map(([v, label]) => (
              <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: tab === v }} onPress={() => setTab(v)}
                style={[s.segItem, tab === v && { backgroundColor: C.bg }]}>
                <Text style={[s.segText, tab === v && { color: C.ink }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {tab === "recent" ? (
          me.activities.length === 0 ? <Muted>Your practice history will appear here.</Muted> : (
            me.activities.slice(0, 5).map((a, i) => (
              <View key={i} style={s.histRow}>
                <IconTile icon={kindIcon(a.kind)} bg={C.bg} color={C.ink} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{KINDS[a.kind] ?? a.kind}{a.score !== null ? <Text style={{ color: C.muted }}> · {Math.round(a.score)}</Text> : null}</Text>
                  <Muted style={{ fontSize: 12 }}>{ago(a.created_at)}</Muted>
                </View>
                <Chip text={`+${a.xp} XP`} tone="peach" />
              </View>
            ))
          )
        ) : best.length === 0 ? <Muted>Complete an activity to see your best scores here.</Muted> : (
          best.map(([k, v]) => (
            <View key={k} style={s.histRow}>
              <IconTile icon={kindIcon(k)} bg={C.bg} color={C.ink} size={34} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={s.between}>
                  <Text style={s.rowLabel}>{KINDS[k] ?? k}</Text>
                  <Text style={s.score}>{Math.round(v)}<Text style={{ fontFamily: F.regular, color: C.muted }}> / 100</Text></Text>
                </View>
                <Bar pct={v} />
              </View>
            </View>
          ))
        )}
      </Card>

      <WeekSummary activities={me.activities} />
    </Screen>
  );
}

/** Placement test without a level, else the activity with the lowest best score (same rule as web). */
function suggest(level: string | null, best: Record<string, number>): { href: string; why: string } {
  if (!level) return { href: "/placement", why: "Answer three questions out loud to find your level." };
  const scored = Object.entries(best).filter(([k]) => k !== "placement" && ACTIVITIES.some((a) => a.kind === k));
  if (scored.length === 0) return { href: "/quiz", why: "Ten quick questions to see where you stand." };
  const [k, score] = scored.sort((a, b) => a[1] - b[1])[0];
  return { href: ACTIVITIES.find((a) => a.kind === k)!.href as string, why: `Your lowest best score is ${Math.round(score)}. Try to beat it.` };
}

/** This week (Monday to today): days practised against a 5-day goal, XP, sessions, average score. */
function WeekSummary({ activities }: { activities: Me["activities"] }) {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const week = activities.filter((a) => when(a.created_at) >= monday);
  const days = new Set(week.map((a) => localDay(a.created_at))).size;
  const xp = week.reduce((n, a) => n + a.xp, 0);
  const scored = week.filter((a) => a.score !== null);
  const avg = scored.length ? Math.round(scored.reduce((n, a) => n + (a.score ?? 0), 0) / scored.length) : null;
  return (
    <Card style={{ gap: 12 }}>
      <View style={s.between}>
        <Text style={s.cardTitle}>This week</Text>
        <Chip text={days >= WEEK_GOAL ? "Goal met" : `${WEEK_GOAL - days} ${WEEK_GOAL - days === 1 ? "day" : "days"} to goal`} tone={days >= WEEK_GOAL ? "mint" : "white"} />
      </View>
      <Muted style={{ fontSize: 13 }}>Practise on {WEEK_GOAL} days a week to keep improving.</Muted>
      <View style={{ gap: 6 }}>
        <View style={s.between}>
          <Text style={s.rowLabel}>Days practised</Text>
          <Muted style={{ fontSize: 13 }}>{Math.min(days, 7)} of {WEEK_GOAL}</Muted>
        </View>
        <Bar pct={Math.min(100, (days / WEEK_GOAL) * 100)} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <MiniStat icon={Zap} label="XP earned" value={xp.toLocaleString("en-IN")} center />
        <MiniStat icon={History} label="Sessions" value={week.length} center />
        <MiniStat icon={Trophy} label="Avg. score" value={avg ?? "–"} center />
      </View>
    </Card>
  );
}

function WeekDots({ activities }: { activities: { created_at: string }[] }) {
  const today = new Date();
  const done = new Set(activities.map((a) => localDay(a.created_at)));
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return (
    <View style={s.between}>
      {[...Array(7)].map((_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const isDone = done.has(d.toDateString());
        const isToday = d.toDateString() === today.toDateString();
        return (
          <View key={i} style={{ alignItems: "center", gap: 5 }}>
            <Text style={[s.dayLetter, isToday && { color: C.ink }]}>{"MTWTFSS"[i]}</Text>
            <View style={[s.dot, isDone ? { backgroundColor: C.mint } : isToday ? s.todayDot : d > today ? s.futureDot : { backgroundColor: C.bg }]}>
              {isDone && <Check size={14} color={C.onMint} strokeWidth={2.8} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function MiniStat({ icon: I, label, value, onPress, center }: { icon: LucideIcon; label: string; value: string | number; onPress?: () => void; center?: boolean }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? "button" : undefined}
      style={[s.mini, center && { alignItems: "center" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <I size={13} color={C.progress} />
        <Muted style={{ fontSize: 11 }}>{label}</Muted>
      </View>
      <Text style={[s.miniValue, onPress && { color: C.blue }]} numberOfLines={1}>{value}</Text>
    </Pressable>
  );
}

const Bar = ({ pct }: { pct: number }) => <View style={s.track}><View style={[s.fill, { width: `${Math.max(0, Math.min(100, pct))}%` }]} /></View>;

const s = themed(() => StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  todayTitle: { fontFamily: F.extrabold, fontSize: 22, lineHeight: 27, letterSpacing: -0.5, color: C.onDark },
  onDarkSmall: { fontFamily: F.medium, fontSize: 12, color: C.onDarkMuted },
  heroTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" },
  heroFill: { height: 6, borderRadius: 3, backgroundColor: C.mint },
  task: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 9 },
  taskIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  taskTitle: { fontFamily: F.semibold, fontSize: 14, color: C.onDark },
  cardTitle: { fontFamily: F.bold, fontSize: 17, color: C.ink },
  big: { fontFamily: F.extrabold, fontSize: 20, color: C.ink },
  flame: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.peachSoft, alignItems: "center", justifyContent: "center" },
  dayLetter: { fontFamily: F.semibold, fontSize: 11, color: C.muted },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  todayDot: { borderWidth: 2, borderStyle: "dashed", borderColor: C.progress },
  futureDot: { borderWidth: 1, borderColor: C.line },
  mini: { flex: 1, backgroundColor: C.bg, borderRadius: 14, padding: 10, gap: 2 },
  miniValue: { fontFamily: F.bold, fontSize: 16, color: C.ink },
  rowLabel: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  track: { height: 7, borderRadius: 4, backgroundColor: C.grey, overflow: "hidden" },
  fill: { height: 7, borderRadius: 4, backgroundColor: C.progress },
  link: { fontFamily: F.bold, fontSize: 14, color: C.blue },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  segment: { flexDirection: "row", backgroundColor: C.grey, borderRadius: 999, padding: 3 },
  segItem: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  segText: { fontFamily: F.semibold, fontSize: 12, color: C.muted },
  histRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  score: { fontFamily: F.bold, fontSize: 14, color: C.ink },
}));
