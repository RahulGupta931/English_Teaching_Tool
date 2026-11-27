"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, Check, LoaderCircle, Mic, ShieldCheck, Volume2, Zap } from "lucide-react";
import { Page, PageHeader, cn } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorText, postJson, useRequireLogin } from "@/lib/api";

type Plan = {
  id: number;
  name: string;
  price_inr: number;
  days: number;
  interviews: number | null;
  daily_minutes: number;
  azure_voice: number;
  on_purchase: "activates_now" | "starts_later" | "blocked";
  starts?: string;
};
type Summary = {
  current: { id: number; name: string; expires: string | null; interviews_left: number | null };
  upcoming: { id: number; name: string; starts: string } | null;
};
type Order = {
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
  plan_name: string;
  prefill: { name: string; email: string; contact: string };
};
type CheckoutResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayCheckout = {
  open: () => void;
  on: (event: "payment.failed", cb: (r: { error: { description?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: object) => RazorpayCheckout;
  }
}

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

/** Razorpay's official checkout script, loaded only when someone buys. */
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    document.body.appendChild(script);
  });
}

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" });
const length = (days: number) => (days % 30 === 0 ? `${days / 30} ${days === 30 ? "month" : "months"}` : `${days} days`);

export default function Plans() {
  useRequireLogin();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<number | "activate" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0); // bump to reload after a purchase

  useEffect(() => {
    api<{ plans: Plan[] } & Summary>("/v1/plans")
      .then((r) => {
        setPlans(r.plans);
        setSummary({ current: r.current, upcoming: r.upcoming });
      })
      .catch((e) => setError(errorText(e)));
  }, [version]);

  async function buy(plan: Plan) {
    setBusy(plan.id);
    setMessage("");
    setError("");
    try {
      const order = await postJson<Order>("/v1/payments/order", { plan_id: plan.id });
      await loadCheckout();
      const checkout = new window.Razorpay!({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "English Coach",
        description: order.plan_name,
        prefill: order.prefill,
        theme: { color: "#1f5a44" }, // app green
        handler: async (result: CheckoutResult) => {
          try {
            const r = await postJson<{ outcome: string } & Summary>("/v1/payments/verify", result);
            setMessage(
              r.outcome === "queued" && r.upcoming
                ? `Payment received. ${r.upcoming.name} starts on ${day(r.upcoming.starts)}, after your current plan.`
                : `Payment received. You're on ${r.current.name}${r.current.expires ? ` until ${day(r.current.expires)}` : ""}.`,
            );
            setVersion((v) => v + 1);
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(null);
          }
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      checkout.on("payment.failed", (r) => setError(r.error.description || "The payment didn't go through. You haven't been charged."));
      checkout.open();
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  }

  async function activateUpcoming() {
    setBusy("activate");
    setMessage("");
    setError("");
    try {
      const r = await postJson<Summary>("/v1/plans/activate-upcoming", {});
      setMessage(`${r.current.name} has started.`);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  if (!plans || !summary) {
    return (
      <Page>
        {error ? <p role="alert" className="text-sm text-danger-fg">{error}</p> : <p role="status" className="sr-only">Loading…</p>}
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-5 md:grid-cols-3"><Skeleton className="h-80 rounded-card" /><Skeleton className="h-80 rounded-card" /><Skeleton className="h-80 rounded-card" /></div>
      </Page>
    );
  }
  const { current, upcoming } = summary;

  return (
    <Page>
      <PageHeader title="Choose your plan" subtitle="One-time payment. No auto-renewal." />

      <Card aria-labelledby="current-heading" className="bg-linear-to-br from-hero to-hero-2 text-on-dark">
        <CardHeader>
          <CardTitle id="current-heading">Your plan: {current.name}</CardTitle>
          <CardDescription className="text-on-dark-2">
            {current.expires ? `Until ${day(current.expires)}. ` : ""}
            {current.interviews_left === null ? "Unlimited interviews." : `${current.interviews_left} ${current.interviews_left === 1 ? "interview" : "interviews"} left.`}
          </CardDescription>
        </CardHeader>
        {upcoming && (
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm"><strong>Next: {upcoming.name}</strong>, starts {day(upcoming.starts)}.</p>
            {current.interviews_left === 0 ? (
              <Button onClick={activateUpcoming} disabled={busy !== null}><Zap />Start {upcoming.name} now</Button>
            ) : (
              <p className="text-xs text-on-dark-2">You can start it early once this plan&apos;s interviews are used up.</p>
            )}
          </CardContent>
        )}
      </Card>

      {message && <p role="status" aria-live="polite" className="flex items-center gap-2 rounded-tile bg-mint/20 px-4 py-3 text-sm font-medium text-[var(--good)]"><Check size={18} aria-hidden />{message}</p>}
      <p role="alert" className="text-sm text-danger-fg empty:hidden">{error}</p>

      <div className="stagger grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p, i) => {
          const featured = i === 0;
          return (
            <Card key={p.id} aria-labelledby={`plan-${p.id}`} className={cn(featured && "ring-2 ring-mint-hover")}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle id={`plan-${p.id}`}>{p.name}</CardTitle>
                  {featured && <Badge>Popular</Badge>}
                </div>
                <p className="flex items-baseline gap-1.5 pt-2">
                  <span className="text-4xl font-semibold tracking-[-0.03em]">₹{p.price_inr}</span>
                  <span className="text-sm text-fg-2">for {length(p.days)}</span>
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="flex flex-col gap-2.5 text-sm">
                  <li className="flex items-center gap-2.5"><BriefcaseBusiness size={16} className="text-accent-fg" aria-hidden />{p.interviews === null ? "Unlimited" : p.interviews} resume interviews</li>
                  <li className="flex items-center gap-2.5"><Mic size={16} className="text-accent-fg" aria-hidden />{p.daily_minutes} minutes of speaking a day</li>
                  <li className="flex items-center gap-2.5"><Volume2 size={16} className="text-accent-fg" aria-hidden />{p.azure_voice ? "Natural AI voice" : "Device voice"}</li>
                </ul>
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-2">
                {p.on_purchase === "blocked" ? (
                  <>
                    <Button variant="secondary" disabled>Buy</Button>
                    <span className="text-center text-xs text-fg-2">Available once {upcoming?.name} has started.</span>
                  </>
                ) : (
                  <>
                    <Button variant={featured ? "default" : "secondary"} onClick={() => buy(p)} disabled={busy !== null}>
                      {busy === p.id ? <><LoaderCircle className="animate-spin" />Opening payment…</> : <>Buy for ₹{p.price_inr}</>}
                    </Button>
                    <span className="text-center text-xs text-fg-2">
                      {p.on_purchase === "activates_now" ? "Starts today." : `Starts ${day(p.starts!)}, when your current plan ends.`}
                    </span>
                  </>
                )}
              </CardFooter>
            </Card>
          );
        })}
        {plans.length === 0 && <p className="text-sm text-fg-2">No plans are available right now.</p>}
      </div>
      <p className="flex items-center gap-2 text-xs text-fg-2"><ShieldCheck size={16} aria-hidden />Payments are handled securely by Razorpay. We never see your card or UPI details.</p>
    </Page>
  );
}
