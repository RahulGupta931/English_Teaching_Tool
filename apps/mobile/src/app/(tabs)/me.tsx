import { router, useFocusEffect } from "expo-router";
import { BookX, Briefcase, Calendar, Check, Flame, GraduationCap, History, LogOut, Mic, Trash2, Zap, type LucideIcon } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Checkout, type CheckoutResult, type Order } from "@/components/Checkout";
import { kindIcon } from "@/components/Activities";
import { Body, Button, Card, Chip, ErrorText, GreenCard, H2, IconTile, MistakeCard, Muted, Screen, Title } from "@/components/ui";
import { ago, KINDS } from "@/lib/activity";
import { api, errorText, postJson } from "@/lib/api";
import { getReminder, REMINDERS_SUPPORTED, setReminder, type ReminderTime } from "@/lib/reminders";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { C, F, setTheme, themed, useTheme, type ThemeName } from "@/lib/theme";

type Plan = {
  id: number; name: string; price_inr: number; days: number; interviews: number | null; daily_minutes: number; azure_voice: number;
  on_purchase: "activates_now" | "starts_later" | "blocked"; starts?: string;
};
type Summary = {
  current: { id: number; name: string; expires: string | null; interviews_left: number | null };
  upcoming: { id: number; name: string; starts: string } | null;
};

const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const REMINDER_TIMES: ReminderTime[] = [{ hour: 8, minute: 0 }, { hour: 13, minute: 0 }, { hour: 19, minute: 0 }, { hour: 21, minute: 0 }];
const timeLabel = ({ hour, minute }: ReminderTime) =>
  `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour < 12 ? "AM" : "PM"}`;
const LEVEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export default function MeScreen() {
  const { me, refresh } = useSession();
  const theme = useTheme();
  const [reminder, setReminderState] = useState<ReminderTime | null>(null);
  const [plans, setPlans] = useState<({ plans: Plan[] } & Summary) | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState<number | "lang" | "activate" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadPlans = useCallback(() => {
    api<{ plans: Plan[] } & Summary>("/v1/plans").then(setPlans).catch((e) => setError(errorText(e)));
  }, []);
  useFocusEffect(useCallback(() => {
    refresh();
    loadPlans();
    getReminder().then(setReminderState);
  }, [refresh, loadPlans]));
  if (!me) return null;
  const { user } = me;

  async function setLang(explain_lang: "english" | "hinglish") {
    if (explain_lang === user.explain_lang) return;
    setBusy("lang");
    try {
      await api("/v1/me", { method: "PATCH", body: JSON.stringify({ explain_lang }) });
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function chooseReminder(time: ReminderTime | null) {
    setError("");
    try {
      if (await setReminder(time)) setReminderState(time);
      else setError("Notifications are off for English Coach. Turn them on in your phone's Settings, then try again.");
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function buy(plan: Plan) {
    setBusy(plan.id);
    setMessage("");
    setError("");
    try {
      setOrder(await postJson<Order>("/v1/payments/order", { plan_id: plan.id }));
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  }

  async function paid(result: CheckoutResult) {
    setOrder(null);
    try {
      const r = await postJson<{ outcome: string } & Summary>("/v1/payments/verify", result);
      setMessage(r.outcome === "queued" && r.upcoming
        ? `Payment received. ${r.upcoming.name} starts on ${day(r.upcoming.starts)}, after your current plan.`
        : `Payment received. You're on ${r.current.name}${r.current.expires ? ` until ${day(r.current.expires)}` : ""}.`);
      refresh();
      loadPlans();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function activateUpcoming() {
    setBusy("activate");
    setError("");
    try {
      const r = await postJson<Summary>("/v1/plans/activate-upcoming", {});
      setMessage(`${r.current.name} has started.`);
      refresh();
      loadPlans();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    try {
      await api("/v1/me", { method: "DELETE" });
      await supabase?.auth.signOut();
    } catch (e) {
      setError(errorText(e));
    }
  }
  function confirmDelete() {
    const text = "Your progress, XP and mistakes are deleted for good. This can't be undone.";
    // Alert buttons do nothing on react-native-web, so the web build asks with the browser's confirm.
    if (Platform.OS === "web") {
      if (window.confirm(`Delete your account? ${text}`)) void deleteAccount();
      return;
    }
    Alert.alert("Delete your account?", text, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteAccount() },
    ]);
  }

  const mistakeCount = new Set(me.mistakes.map((m) => m.original.toLowerCase())).size;
  const best = Object.entries(me.best).sort((a, b) => b[1] - a[1]);

  return (
    <Screen scroll style={{ paddingBottom: 120, gap: 18 }} onRefresh={async () => { loadPlans(); await refresh(); }}>
      {/* Profile header, as on web */}
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 }}>
        <View style={s.avatar}><Text style={s.avatarText}>{user.name[0]?.toUpperCase()}</Text></View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={s.name} numberOfLines={2}>{user.name}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {user.level && <Chip text={LEVEL[user.level] ?? user.level} tone="mint" />}
            <Chip text={`${user.plan.name} plan`} tone="grey" />
          </View>
          {(user.email ?? user.phone) && <Muted style={{ fontSize: 12 }} numberOfLines={1}>{user.email ?? user.phone}</Muted>}
        </View>
      </Card>

      <View style={s.statGrid}>
        <StatTile icon={Zap} bg={C.mint} fg={C.onMint} label="Total XP" value={user.xp.toLocaleString("en-IN")} />
        <StatTile icon={Flame} bg={C.peachSoft} fg={C.purple} label="Day streak" value={`${user.streak} ${user.streak === 1 ? "day" : "days"}`} />
        <StatTile icon={History} bg={C.blueSoft} fg={C.blue} label="Sessions" value={me.activities.length} />
        <StatTile icon={BookX} bg={C.redSoft} fg={C.redText} label="Mistakes to review" value={mistakeCount}
          onPress={mistakeCount ? () => router.push("/mistakes") : undefined} />
      </View>

      {message ? <Body style={{ color: C.progress }}>{message}</Body> : null}
      <ErrorText>{error}</ErrorText>

      <Card style={{ gap: 12 }}>
        <Text style={s.cardTitle}>Your best scores</Text>
        {best.length === 0 ? <Muted>Complete an activity to see your best scores here.</Muted> : best.map(([k, v]) => (
          <View key={k} style={s.rowItem}>
            <IconTile icon={kindIcon(k)} bg={C.bg} color={C.ink} size={34} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={s.between}>
                <Text style={s.rowLabel}>{KINDS[k] ?? k}</Text>
                <Text style={s.rowLabel}>{Math.round(v)}<Text style={{ fontFamily: F.regular, color: C.muted }}> / 100</Text></Text>
              </View>
              <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, v)}%` }]} /></View>
            </View>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 12 }}>
        <Text style={s.cardTitle}>Recent activity</Text>
        {me.activities.length === 0 ? <Muted>Your practice history will appear here.</Muted> : me.activities.slice(0, 6).map((a, i) => (
          <View key={i} style={s.rowItem}>
            <IconTile icon={kindIcon(a.kind)} bg={C.bg} color={C.ink} size={34} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{KINDS[a.kind] ?? a.kind}{a.score !== null ? <Text style={{ color: C.muted }}> · {Math.round(a.score)}</Text> : null}</Text>
              <Muted style={{ fontSize: 12 }}>{ago(a.created_at)}</Muted>
            </View>
            <Chip text={`+${a.xp} XP`} tone="peach" />
          </View>
        ))}
      </Card>

      {mistakeCount > 0 && (
        <Card style={{ gap: 12 }}>
          <View style={s.between}>
            <Text style={s.cardTitle}>Mistakes to review</Text>
            <Text style={s.link} onPress={() => router.push("/mistakes")} accessibilityRole="link">See all {mistakeCount}</Text>
          </View>
          {me.mistakes.slice(0, 2).map((m, i) => <MistakeCard key={i} m={m} />)}
          <Button title="Fix them with Mistake Coach" icon={GraduationCap} tone="grey" small style={{ alignSelf: "flex-start" }} onPress={() => router.push("/coach")} />
        </Card>
      )}

      {/* Your plan: three facts, like the web plan card */}
      <GreenCard style={{ gap: 14 }}>
        <View style={s.between}>
          <Text style={[s.cardTitle, { color: C.onDark }]}>Your plan</Text>
          <Chip text={user.plan.name} tone="glass" />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <PlanFact icon={Briefcase} label="Interviews left" value={user.plan.interviews_left === null ? "∞" : user.plan.interviews_left} />
          <PlanFact icon={Mic} label="Min / day" value={Math.round(me.speaking_limit_seconds / 60)} />
          <PlanFact icon={Calendar} label="Ends" value={user.plan.expires ? new Date(user.plan.expires + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Never"} />
        </View>
        {plans?.upcoming && (
          <View style={{ gap: 8 }}>
            <Text style={s.onDarkSmall}>{plans.upcoming.name} is lined up next, from {day(plans.upcoming.starts)}.</Text>
            {plans.current.interviews_left === 0 && <Button title="Start it now" small tone="mint" busy={busy === "activate"} onPress={activateUpcoming} style={{ alignSelf: "flex-start" }} />}
          </View>
        )}
      </GreenCard>

      <H2>Upgrade your practice</H2>
      {!plans ? <ActivityIndicator color={C.green} /> : plans.plans.length === 0 ? <Muted>No plans to buy right now.</Muted> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
          {plans.plans.map((p, i) => <PlanCard key={p.id} plan={p} featured={i === 0} busy={busy === p.id} onBuy={() => buy(p)} />)}
        </ScrollView>
      )}

      <Card style={{ gap: 14 }}>
        <Text style={s.cardTitle}>Settings</Text>
        <View style={{ gap: 10 }}>
          <View>
            <Title style={{ fontSize: 15 }}>Explanations in</Title>
            <Muted style={{ fontSize: 12 }}>Language for tips and corrections</Muted>
          </View>
          <View style={s.segment}>
            {(["english", "hinglish"] as const).map((l) => (
              <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: user.explain_lang === l }} onPress={() => setLang(l)}
                style={[s.segItem, user.explain_lang === l && { backgroundColor: C.bg }]}>
                <Text style={[s.segText, user.explain_lang === l && { color: C.ink }]}>{l === "english" ? "English" : "Hinglish"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={[{ gap: 10 }, s.rowLine]}>
          <View>
            <Title style={{ fontSize: 15 }}>Appearance</Title>
            <Muted style={{ fontSize: 12 }}>Day or night colours</Muted>
          </View>
          <View style={s.segment}>
            {(["day", "night"] as ThemeName[]).map((t) => (
              <Pressable key={t} accessibilityRole="button" accessibilityState={{ selected: theme === t }} onPress={() => setTheme(t)}
                style={[s.segItem, theme === t && { backgroundColor: C.bg }]}>
                <Text style={[s.segText, theme === t && { color: C.ink }]}>{t === "day" ? "Day" : "Night"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {REMINDERS_SUPPORTED && (
          <View style={[{ gap: 10 }, s.rowLine]}>
            <View>
              <Title style={{ fontSize: 15 }}>Daily reminder</Title>
              <Muted style={{ fontSize: 12 }}>{reminder ? `Every day at ${timeLabel(reminder)}` : "A nudge to keep your streak going"}</Muted>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[null, ...REMINDER_TIMES].map((t) => {
                const on = t === null ? !reminder : reminder?.hour === t.hour && reminder.minute === t.minute;
                return <Chip key={t ? timeLabel(t) : "off"} text={t ? timeLabel(t) : "Off"} tone={on ? "mint" : "grey"} onPress={() => chooseReminder(t)} />;
              })}
            </View>
          </View>
        )}
      </Card>

      <Card style={{ gap: 12 }}>
        <Text style={s.cardTitle}>Account</Text>
        <Muted style={{ fontSize: 13 }}>Deleting your account removes your XP, scores and saved mistakes for good.</Muted>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Button title="Sign out" icon={LogOut} tone="grey" small onPress={() => supabase?.auth.signOut()} />
          <Pressable accessibilityRole="button" onPress={confirmDelete} style={s.danger}>
            <Trash2 size={16} color={C.redText} />
            <Text style={s.dangerText}>Delete account</Text>
          </Pressable>
        </View>
      </Card>

      {order && (
        <Checkout order={order} onPaid={paid}
          onFailed={(m) => { setOrder(null); setBusy(null); setError(m); }}
          onClose={() => { setOrder(null); setBusy(null); }} />
      )}
    </Screen>
  );
}

function StatTile({ icon: I, bg, fg, label, value, onPress }: { icon: LucideIcon; bg: string; fg: string; label: string; value: string | number; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${label}: ${value}`} disabled={!onPress} onPress={onPress} style={s.stat}>
      <View style={[s.statIcon, { backgroundColor: bg }]}><I size={16} color={fg} /></View>
      <Muted style={{ fontSize: 12 }} numberOfLines={1}>{label}</Muted>
      <Text style={s.statValue} numberOfLines={1}>{value}</Text>
    </Pressable>
  );
}

function PlanFact({ icon: I, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <View style={s.fact}>
      <I size={15} color={C.mint} />
      <Text style={s.factValue} numberOfLines={1}>{value}</Text>
      <Text style={s.onDarkSmall} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function PlanCard({ plan, featured, busy, onBuy }: { plan: Plan; featured: boolean; busy: boolean; onBuy: () => void }) {
  const fg = featured ? C.onDark : C.ink;
  const perks = [
    plan.interviews === null ? "Unlimited resume interviews" : `${plan.interviews} resume interview${plan.interviews === 1 ? "" : "s"}`,
    `${plan.daily_minutes} min speaking a day`,
    plan.azure_voice ? "Natural AI voice" : "Device voice",
  ];
  const body = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Title style={{ color: fg }}>{plan.name.toUpperCase()}</Title>
        {featured && <Chip text="Popular" tone="mint" />}
      </View>
      <Text style={{ color: fg }}>
        <Text style={s.price}>₹{plan.price_inr}</Text>
        <Text style={{ fontFamily: F.regular, fontSize: 16, color: featured ? C.onDarkMuted : C.muted }}>  / {plan.days} days</Text>
      </Text>
      {perks.map((p) => (
        <View key={p} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Check size={20} color={featured ? C.mint : C.ink} />
          <Body style={{ color: fg }}>{p}</Body>
        </View>
      ))}
      {plan.on_purchase === "starts_later" && plan.starts && <Muted style={featured ? { color: C.onDarkMuted } : undefined}>Starts {day(plan.starts)}, after your current plan.</Muted>}
      <Button title={plan.on_purchase === "blocked" ? "Buy after your next plan starts" : "Buy with UPI or card"} tone={featured ? "mint" : "dark"}
        disabled={plan.on_purchase === "blocked"} busy={busy} onPress={onBuy} style={{ marginTop: 8 }} />
    </>
  );
  return featured
    ? <GreenCard style={s.plan}>{body}</GreenCard>
    : <View style={[s.plan, { backgroundColor: C.surface, borderRadius: 22, padding: 22 }]}>{body}</View>;
}

const s = themed(() => StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontFamily: F.bold, fontSize: 17, color: C.ink },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "48%", flexGrow: 1, backgroundColor: C.surface, borderRadius: 18, padding: 12, gap: 4 },
  statIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statValue: { fontFamily: F.extrabold, fontSize: 20, color: C.ink },
  rowItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowLabel: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  track: { height: 7, borderRadius: 4, backgroundColor: C.grey, overflow: "hidden" },
  fill: { height: 7, borderRadius: 4, backgroundColor: C.progress },
  link: { fontFamily: F.bold, fontSize: 14, color: C.blue },
  fact: { flex: 1, alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14, paddingVertical: 10 },
  factValue: { fontFamily: F.bold, fontSize: 16, color: C.onDark },
  onDarkSmall: { fontFamily: F.medium, fontSize: 11, color: C.onDarkMuted },
  danger: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, minHeight: 40, borderRadius: 999, backgroundColor: C.redSoft },
  dangerText: { fontFamily: F.bold, fontSize: 14, color: C.redText },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: F.bold, fontSize: 26, color: C.mint },
  name: { fontFamily: F.extrabold, fontSize: 23, lineHeight: 26, letterSpacing: -0.8, color: C.ink },
  plan: { width: 320, gap: 12 },
  price: { fontFamily: F.extrabold, fontSize: 30, letterSpacing: -1 },
  rowLine: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  segment: { alignSelf: "flex-start", flexDirection: "row", backgroundColor: C.grey, borderRadius: 999, padding: 4 },
  segItem: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  segText: { fontFamily: F.semibold, fontSize: 14, color: C.muted },
}));
