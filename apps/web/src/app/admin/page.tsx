"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Check, LoaderCircle, LogOut, Search } from "lucide-react";
import { Page, PageHeader, Tabs } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, errorText } from "@/lib/api";

type Plan = {
  id: number;
  name: string;
  price_inr: number;
  days: number | null;
  interviews: number | null;
  daily_minutes: number;
  azure_voice: number;
  listed: number;
  users: number;
};
type AdminUser = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  level: string | null;
  xp: number;
  last_active: string | null;
  created_at: string;
  is_minor: boolean;
  plan_id: number;
  plan_name: string;
  plan_expires: string | null;
  interviews_used: number;
  interviews_left: number | null;
};

type Payment = {
  id: number;
  created_at: string;
  paid_at: string | null;
  status: string;
  outcome: string | null;
  amount_paise: number;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  plan_name: string;
  user_name: string | null;
  email: string | null;
  phone: string | null;
};

const TOKEN_KEY = "adminToken";
const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
let memoryToken: string | null = null; // fallback when storage is blocked
const listeners = new Set<() => void>();
const saveToken = (token: string | null) => {
  memoryToken = token;
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the admin stays signed in for this page only.
  }
  listeners.forEach((l) => l());
};
/** undefined while rendering on the server, null when signed out. */
function useAdminToken(): string | null | undefined {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => readToken() ?? memoryToken,
    () => undefined,
  );
}

const EMPTY_PLAN = { name: "", price_inr: "", days: "", interviews: "", daily_minutes: "15", azure_voice: true };

export default function Admin() {
  const token = useAdminToken();
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<"users" | "plans" | "payments">("users");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(EMPTY_PLAN);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0); // bump to reload users and plans

  const call = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      try {
        return await api<T>(path, { ...init, headers: { "X-Admin-Token": token ?? "" } });
      } catch (e) {
        if (errorText(e) === "Admin sign-in required.") saveToken(null);
        throw e;
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) return;
    Promise.all([
      call<AdminUser[]>(`/v1/admin/users?q=${encodeURIComponent(query)}`),
      call<Plan[]>("/v1/admin/plans"),
      call<Payment[]>("/v1/admin/payments"),
    ])
      .then(([u, p, pay]) => {
        setUsers(u);
        setPlans(p);
        setPayments(pay);
      })
      .catch((e) => setMessage(errorText(e)));
  }, [call, query, token, version]);

  async function act(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(done);
      setVersion((v) => v + 1);
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const r = await api<{ token: string }>("/v1/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      saveToken(r.token);
      setPassword("");
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const switchPlan = (user: AdminUser, planId: number) =>
    act(
      () => call(`/v1/admin/users/${user.id}/plan`, { method: "POST", body: JSON.stringify({ plan_id: planId }) }),
      `${user.name} is now on ${plans.find((p) => p.id === planId)?.name}.`,
    );

  const setListed = (plan: Plan, listed: boolean) =>
    act(
      () => call(`/v1/admin/plans/${plan.id}/listed`, { method: "POST", body: JSON.stringify({ listed }) }),
      `${plan.name} ${listed ? "relisted" : "unlisted"}.`,
    );

  function createPlan(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name,
      price_inr: Number(form.price_inr),
      days: Number(form.days),
      interviews: form.interviews === "" ? null : Number(form.interviews),
      daily_minutes: Number(form.daily_minutes),
      azure_voice: form.azure_voice,
    };
    act(async () => {
      await call("/v1/admin/plans", { method: "POST", body: JSON.stringify(body) });
      setForm(EMPTY_PLAN);
    }, `Plan "${form.name}" created.`);
  }

  if (token === undefined) return <Page />;
  if (!token) {
    return (
      <Page className="max-w-md">
        <Card>
          <form onSubmit={signIn} className="flex flex-col gap-(--card-spacing)">
            <CardHeader>
              <span className="text-xs font-semibold tracking-wider text-accent-fg uppercase">Admin</span>
              <CardTitle className="text-2xl">Sign in</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="admin-password">Admin password</Label>
                <Input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <Button type="submit" size="lg" disabled={busy}>{busy ? <><LoaderCircle className="animate-spin" />Signing in…</> : "Sign in"}</Button>
              <p role="alert" className="text-sm text-danger-fg empty:hidden">{message}</p>
            </CardContent>
          </form>
        </Card>
      </Page>
    );
  }

  const listedPlans = plans.filter((p) => p.listed);
  const interviews = (n: number | null) => (n === null ? "Unlimited" : String(n));
  const status = (ok: boolean, yes: string, no: string) => <Badge variant={ok ? "default" : "secondary"}>{ok ? yes : no}</Badge>;

  return (
    <Page>
      <PageHeader
        title={tab === "users" ? "Users" : tab === "plans" ? "Plans" : "Payments"}
        subtitle="Admin"
        actions={<Button variant="secondary" onClick={() => saveToken(null)}><LogOut />Sign out</Button>}
      />
      <Tabs label="Admin sections" value={tab} onChange={setTab}
        tabs={[{ value: "users", label: `Users (${users.length})` }, { value: "plans", label: `Plans (${plans.length})` }, { value: "payments", label: `Payments (${payments.length})` }]} />
      <p role="status" aria-live="polite" className="text-sm font-medium text-fg-2 empty:hidden">{message}</p>

      {tab === "users" ? (
        <Card>
          <CardHeader className="gap-3">
            <div className="relative max-w-sm">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-3" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email or mobile" aria-label="Search by name, email or mobile" className="pl-10" />
            </div>
            <CardDescription>Changing a plan starts it today and resets the user&apos;s interview count. Expired plans return to Free automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Mobile</TableHead><TableHead>Plan</TableHead><TableHead>Plan ends</TableHead>
                  <TableHead>Interviews used / left</TableHead><TableHead>Level</TableHead><TableHead>XP</TableHead><TableHead>Last active</TableHead><TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name} {u.is_minor && <Badge variant="secondary" className="ml-1">Under 18</Badge>}</TableCell>
                    <TableCell>{u.email ?? "–"}</TableCell>
                    <TableCell>{u.phone ?? "–"}</TableCell>
                    <TableCell>
                      <select
                        value={u.plan_id}
                        disabled={busy}
                        onChange={(e) => switchPlan(u, Number(e.target.value))}
                        aria-label={`Plan for ${u.name}`}
                        className="h-9 cursor-pointer rounded-input border border-input bg-surface px-2.5 text-sm"
                      >
                        {!listedPlans.some((p) => p.id === u.plan_id) && <option value={u.plan_id}>{u.plan_name} (unlisted)</option>}
                        {listedPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </TableCell>
                    <TableCell>{u.plan_expires ?? "Never"}</TableCell>
                    <TableCell>{u.interviews_used} / {interviews(u.interviews_left)}</TableCell>
                    <TableCell className="capitalize">{u.level ?? "–"}</TableCell>
                    <TableCell className="tabular-nums">{u.xp}</TableCell>
                    <TableCell>{u.last_active ?? "–"}</TableCell>
                    <TableCell>{u.created_at.slice(0, 10)}</TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && <TableRow><TableCell colSpan={10} className="py-8 text-center text-fg-2">No users found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : tab === "plans" ? (
        <>
          <Card>
            <CardHeader>
              <CardDescription>Unlisting stops a plan being given to more users; people already on it keep it until it ends. Plans can&apos;t be edited: create a new one and unlist the old one.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead><TableHead>Price</TableHead><TableHead>Length</TableHead><TableHead>Interviews</TableHead><TableHead>Speaking / day</TableHead>
                    <TableHead>Voice</TableHead><TableHead>Users</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold">{p.name}</TableCell>
                      <TableCell>₹{p.price_inr}</TableCell>
                      <TableCell>{p.days ? `${p.days} days` : "Forever"}</TableCell>
                      <TableCell>{interviews(p.interviews)}</TableCell>
                      <TableCell>{p.daily_minutes} min</TableCell>
                      <TableCell>{p.azure_voice ? "Azure" : "Browser"}</TableCell>
                      <TableCell className="tabular-nums">{p.users}</TableCell>
                      <TableCell>{status(!!p.listed, "Listed", "Unlisted")}</TableCell>
                      <TableCell className="text-right">
                        {p.id !== 1 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setListed(p, !p.listed)}>{p.listed ? "Unlist" : "Relist"}</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <form onSubmit={createPlan} className="flex flex-col gap-(--card-spacing)">
              <CardHeader><CardTitle>Create a plan</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field id="plan-name" label="Name" className="sm:col-span-2">
                  <Input id="plan-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={40} />
                </Field>
                <Field id="plan-price" label="Price (₹)">
                  <Input id="plan-price" type="number" min={0} value={form.price_inr} onChange={(e) => setForm({ ...form, price_inr: e.target.value })} required />
                </Field>
                <Field id="plan-days" label="Length (days)">
                  <Input id="plan-days" type="number" min={1} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} required placeholder="e.g. 90 for 3 months" />
                </Field>
                <Field id="plan-interviews" label="Interviews included" hint="Leave empty for unlimited">
                  <Input id="plan-interviews" type="number" min={0} value={form.interviews} onChange={(e) => setForm({ ...form, interviews: e.target.value })} />
                </Field>
                <Field id="plan-minutes" label="Speaking minutes per day">
                  <Input id="plan-minutes" type="number" min={1} max={240} value={form.daily_minutes} onChange={(e) => setForm({ ...form, daily_minutes: e.target.value })} required />
                </Field>
                <label className="flex items-center gap-3 rounded-tile bg-raised p-4 text-sm sm:col-span-2">
                  <input type="checkbox" checked={form.azure_voice} onChange={(e) => setForm({ ...form, azure_voice: e.target.checked })} className="size-4 accent-[var(--ring)]" />
                  Azure voice (unticked: the browser&apos;s free built-in voice)
                </label>
                <Button type="submit" disabled={busy} className="sm:col-span-2 sm:justify-self-start"><Check />Create plan</Button>
              </CardContent>
            </form>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardDescription>&quot;Not paid&quot; means checkout was opened but not completed. Refunds are made from the Razorpay dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>User</TableHead><TableHead>Plan</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead>
                  <TableHead>Result</TableHead><TableHead>Razorpay payment</TableHead><TableHead>Razorpay order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{(p.paid_at ?? p.created_at).slice(0, 16)}</TableCell>
                    <TableCell>
                      {p.user_name ?? <span className="text-fg-2">Deleted account</span>}
                      {p.email && <div className="text-xs text-fg-2">{p.email}</div>}
                    </TableCell>
                    <TableCell>{p.plan_name}</TableCell>
                    <TableCell className="tabular-nums">₹{p.amount_paise / 100}</TableCell>
                    <TableCell>{status(p.status === "paid", "Paid", "Not paid")}</TableCell>
                    <TableCell>{p.outcome === "queued" ? "Starts after current plan" : p.outcome === "activated" ? "Started" : "–"}</TableCell>
                    <TableCell className="font-mono text-xs">{p.razorpay_payment_id ?? "–"}</TableCell>
                    <TableCell className="font-mono text-xs">{p.razorpay_order_id}</TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-fg-2">No payments yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Page>
  );
}

function Field({ id, label, hint, className, children }: { id: string; label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <span className="text-xs text-fg-2">{hint}</span>}
    </div>
  );
}
