import { useFocusEffect } from "expo-router";
import { Check, SlidersHorizontal } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Checkout, type CheckoutResult, type Order } from "@/components/Checkout";
import { Body, Button, Chip, ErrorText, GreenCard, H2, List, Muted, RoundButton, Row, Screen, Stat, Title } from "@/components/ui";
import { api, errorText, postJson } from "@/lib/api";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { C, F } from "@/lib/theme";

type Plan = {
  id: number; name: string; price_inr: number; days: number; interviews: number | null; daily_minutes: number; azure_voice: number;
  on_purchase: "activates_now" | "starts_later" | "blocked"; starts?: string;
};
type Summary = {
  current: { id: number; name: string; expires: string | null; interviews_left: number | null };
  upcoming: { id: number; name: string; starts: string } | null;
};

const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const LEVEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export default function MeScreen() {
  const { me, refresh } = useSession();
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

  function settings() {
    Alert.alert("Account", user.email ?? user.phone ?? undefined, [
      { text: "Delete my account", style: "destructive", onPress: confirmDelete },
      { text: "Cancel", style: "cancel" },
    ]);
  }
  function confirmDelete() {
    Alert.alert("Delete your account?", "Your progress, XP and mistakes are deleted for good. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await api("/v1/me", { method: "DELETE" });
            await supabase?.auth.signOut();
          } catch (e) {
            setError(errorText(e));
          }
        },
      },
    ]);
  }

  return (
    <Screen scroll style={{ paddingBottom: 140, gap: 20 }}>
      <View style={s.top}>
        <View style={s.avatar}><Text style={s.avatarText}>{user.name[0]?.toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{user.name}</Text>
          <Muted>{user.level ? `${LEVEL[user.level] ?? user.level} · ` : ""}{user.plan.name} plan</Muted>
        </View>
        <RoundButton icon={SlidersHorizontal} label="Account settings" onPress={settings} />
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Stat value={user.xp.toLocaleString("en-IN")} label="Total XP" />
        <Stat value={user.streak} label="Day streak" bg={C.peachSoft} />
        <Stat value={me.best.jam ?? "–"} label="Best JAM" />
      </View>

      {message ? <Body style={{ color: C.green2 }}>{message}</Body> : null}
      <ErrorText>{error}</ErrorText>

      <List>
        <Row first title={`Your plan: ${user.plan.name}`}
          subtitle={[
            user.plan.expires ? `Ends ${day(user.plan.expires)}` : "Never expires",
            user.plan.interviews_left === null ? "unlimited interviews" : `${user.plan.interviews_left} interview${user.plan.interviews_left === 1 ? "" : "s"} left`,
            `${Math.round(me.speaking_limit_seconds / 60)} min speaking a day`,
          ].join(" · ")} />
      </List>

      {plans?.upcoming && (
        <List>
          <Row first title={`${plans.upcoming.name} is lined up`} subtitle={`Starts ${day(plans.upcoming.starts)}`}
            right={plans.current.interviews_left === 0
              ? <Button title="Start now" small tone="mint" busy={busy === "activate"} onPress={activateUpcoming} />
              : undefined} />
        </List>
      )}

      <H2>Upgrade your practice</H2>
      {!plans ? <ActivityIndicator color={C.green} /> : plans.plans.length === 0 ? <Muted>No plans to buy right now.</Muted> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
          {plans.plans.map((p, i) => <PlanCard key={p.id} plan={p} featured={i === 0} busy={busy === p.id} onBuy={() => buy(p)} />)}
        </ScrollView>
      )}

      <List>
        <Row first title="Explanations in" right={
          <View style={s.segment}>
            {(["english", "hinglish"] as const).map((l) => (
              <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: user.explain_lang === l }} onPress={() => setLang(l)}
                style={[s.segItem, user.explain_lang === l && { backgroundColor: "#fff" }]}>
                <Text style={[s.segText, user.explain_lang === l && { color: C.ink }]}>{l === "english" ? "English" : "Hinglish"}</Text>
              </Pressable>
            ))}
          </View>
        } />
        <Pressable accessibilityRole="button" onPress={() => supabase?.auth.signOut()} style={s.signOut}>
          <Text style={s.signOutText}>Sign out</Text>
        </Pressable>
      </List>

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
    : <View style={[s.plan, { backgroundColor: "#fff", borderRadius: 28, padding: 22 }]}>{body}</View>;
}

const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: F.bold, fontSize: 32, color: C.mint },
  name: { fontFamily: F.extrabold, fontSize: 32, letterSpacing: -0.8, color: C.ink },
  plan: { width: 320, gap: 12 },
  price: { fontFamily: F.extrabold, fontSize: 36, letterSpacing: -1 },
  segment: { flexDirection: "row", backgroundColor: C.grey, borderRadius: 999, padding: 4 },
  segItem: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  segText: { fontFamily: F.semibold, fontSize: 16, color: C.muted },
  signOut: { paddingHorizontal: 20, paddingVertical: 20, borderTopWidth: 1, borderTopColor: C.line },
  signOutText: { fontFamily: F.semibold, fontSize: 17, color: C.redText },
});
