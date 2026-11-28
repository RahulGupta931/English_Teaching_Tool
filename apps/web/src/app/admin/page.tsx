"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Activity, Check, ExternalLink, IndianRupee, LoaderCircle, LogOut, Search, ShoppingCart, Users, type LucideIcon } from "lucide-react";
import { ButtonLink, IconTile, Page, PageHeader, Segmented, Tabs } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { API_URL, api, errorText } from "@/lib/api";

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
  const [tab, setTab] = useState<"users" | "plans" | "payments" | "system">("users");
  const [payFilter, setPayFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [loaded, setLoaded] = useState(false);
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
        if (errorText(e) !== "Admin sign-in required.") throw e;
        saveToken(null);
        throw new Error("Your admin session ended. Sign in again."); // shown on the sign-in form, not mistaken for a failed login
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
        setLoaded(true);
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
  const shownPayments = payFilter === "all" ? payments : payments.filter((p) => (p.status === "paid") === (payFilter === "paid"));

  return (
    <Page>
      <PageHeader
        title="Admin"
        subtitle="Manage learners, plans and payments."
        actions={<>
          <ButtonLink href="/" variant="ghost" icon={ExternalLink}>View site</ButtonLink>
          <Button variant="secondary" onClick={() => saveToken(null)}><LogOut />Sign out</Button>
        </>}
      />

      {/* Totals come from the plans list (users per plan) and every payment, so search doesn't change them. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} tone="mint" label="Learners" value={plans.reduce((n, p) => n + p.users, 0)} />
        <Stat icon={Check} tone="mint" label="On a paid plan" value={plans.filter((p) => p.price_inr > 0).reduce((n, p) => n + p.users, 0)} />
        <Stat icon={IndianRupee} tone="link" label="Revenue" value={`₹${(payments.filter((p) => p.status === "paid").reduce((n, p) => n + p.amount_paise, 0) / 100).toLocaleString("en-IN")}`} />
        <Stat icon={ShoppingCart} tone="coral" label="Checkouts not finished" value={payments.filter((p) => p.status !== "paid").length} />
      </div>

      <Tabs label="Admin sections" value={tab} onChange={setTab}
        tabs={[{ value: "users", label: `Users (${users.length})` }, { value: "plans", label: `Plans (${plans.length})` }, { value: "payments", label: `Payments (${payments.length})` }, { value: "system", label: "System" }]} />
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
      ) : tab === "system" ? (
        <SystemStatus databaseOk={loaded} />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardDescription>&quot;Not paid&quot; means checkout was opened but not completed. Refunds are made from the Razorpay dashboard.</CardDescription>
              <Segmented label="Show payments" value={payFilter} onChange={setPayFilter}
                options={[{ value: "all", label: "All" }, { value: "paid", label: "Paid" }, { value: "unpaid", label: "Not paid" }]} />
            </div>
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
                {shownPayments.map((p) => (
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
                {shownPayments.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-fg-2">{payments.length ? "No payments match this filter." : "No payments yet."}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Page>
  );
}

function Stat({ icon, tone, label, value }: { icon: LucideIcon; tone: "mint" | "coral" | "link"; label: string; value: React.ReactNode }) {
  return (
    <Card className="flex-row items-center gap-3 p-4 sm:p-4">
      <IconTile icon={icon} tone={tone} size={40} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs text-fg-2">{label}</span>
        <span className="text-xl font-bold tabular-nums">{value}</span>
      </div>
    </Card>
  );
}

/** Which API this web build talks to, and whether it answers. Addresses are fixed at build time, so they're changed in deploy settings, not here. */
function SystemStatus({ databaseOk }: { databaseOk: boolean }) {
  const [health, setHealth] = useState<{ ok: boolean; ms: number } | null>(null);
  const [run, setRun] = useState(0); // bump to check again
  useEffect(() => {
    let live = true;
    const t = performance.now();
    fetch(`${API_URL}/v1/health`).then((r) => r.ok, () => false)
      .then((ok) => live && setHealth({ ok, ms: Math.round(performance.now() - t) }));
    return () => { live = false; };
  }, [run]);

  const rows: [string, React.ReactNode][] = [
    ["API address (this web build)", <code key="a" className="break-all">{API_URL}</code>],
    ["API health", health === null ? "Checking…" : <Badge key="h" variant={health.ok ? "default" : "destructive"}>{health.ok ? `Up · ${health.ms} ms` : "Not reachable"}</Badge>],
    ["Database", <Badge key="d" variant={databaseOk ? "default" : "destructive"}>{databaseOk ? "Connected" : "Not answering"}</Badge>],
  ];
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2"><Activity className="size-5 text-accent-fg" aria-hidden />Status</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { setHealth(null); setRun((n) => n + 1); }}>Check again</Button>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col divide-y divide-line">
            {rows.map(([k, v]) => (
              <div key={k} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <dt className="text-fg-2">{k}</dt><dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Changing settings</CardTitle>
          <CardDescription>For safety these can&apos;t be changed from this page: app addresses are built into each app, and API keys are secrets.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3 text-sm">
            <li><strong>Web app API address:</strong> <code>NEXT_PUBLIC_API_URL</code> in the web project&apos;s Vercel settings (or <code>apps/web/.env.local</code>), then redeploy.</li>
            <li><strong>Mobile API address:</strong> <code>EXPO_PUBLIC_API_URL</code> in <code>apps/mobile/.env</code> for development and <code>apps/mobile/eas.json</code> for APK builds, then rebuild.</li>
            <li><strong>API keys and database:</strong> <code>DATABASE_URL</code>, OpenAI, Azure, Razorpay and Supabase keys in the API project&apos;s Vercel settings, then redeploy.</li>
            <li><strong>Plans and prices:</strong> on the Plans tab, no redeploy needed.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
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
