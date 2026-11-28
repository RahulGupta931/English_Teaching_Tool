import { router, useFocusEffect } from "expo-router";
import { Check, GraduationCap, LogOut } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Checkout, type CheckoutResult, type Order } from "@/components/Checkout";
import { Body, Button, Card, Chip, ErrorText, GreenCard, H2, Header, MistakeCard, Muted, Screen, Title } from "@/components/ui";
import { api, errorText, postJson } from "@/lib/api";
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

/** Moved here from Me: recent mistakes, upgrade plan, explanation language, appearance and sign out. */
export default function Settings() {
  const { me, refresh } = useSession();
  const theme = useTheme();
  const [plans, setPlans] = useState<({ plans: Plan[] } & Summary) | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState<number | "lang" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadPlans = useCallback(() => {
    api<{ plans: Plan[] } & Summary>("/v1/plans").then(setPlans).catch((e) => setError(errorText(e)));
  }, []);
  useFocusEffect(useCallback(() => {
    refresh();
    loadPlans();
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

  const mistakeCount = new Set(me.mistakes.map((m) => m.original.toLowerCase())).size;

  return (
    <Screen scroll style={{ paddingBottom: 40, gap: 18 }} onRefresh={async () => { loadPlans(); await refresh(); }}>
      <Header title="Settings" />

      {message ? <Body style={{ color: C.progress }}>{message}</Body> : null}
      <ErrorText>{error}</ErrorText>

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

      <H2>Upgrade your practice</H2>
      {!plans ? <ActivityIndicator color={C.green} /> : plans.plans.length === 0 ? <Muted>No plans to buy right now.</Muted> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
          {plans.plans.map((p, i) => <PlanCard key={p.id} plan={p} featured={i === 0} busy={busy === p.id} onBuy={() => buy(p)} />)}
        </ScrollView>
      )}

      <Card style={{ gap: 14 }}>
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
      </Card>

      <Button title="Sign out" icon={LogOut} tone="grey" small style={{ alignSelf: "flex-start" }} onPress={() => supabase?.auth.signOut()} />

      {order && (
        <Checkout order={order} onPaid={paid}
          onFailed={(m) => { setOrder(null); setBusy(null); setError(m); }}
          onClose={() => { setOrder(null); setBusy(null); }} />
      )}
    </Screen>
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
  link: { fontFamily: F.bold, fontSize: 14, color: C.blue },
  plan: { width: 320, gap: 12 },
  price: { fontFamily: F.extrabold, fontSize: 30, letterSpacing: -1 },
  rowLine: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  segment: { alignSelf: "flex-start", flexDirection: "row", backgroundColor: C.grey, borderRadius: 999, padding: 4 },
  segItem: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  segText: { fontFamily: F.semibold, fontSize: 14, color: C.muted },
}));
