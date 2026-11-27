"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookX, BriefcaseBusiness, Calendar, Flame, Globe, GraduationCap, History, LogOut, Mail, Mic, Sparkles, Trash2, Trophy, Zap, type LucideIcon } from "lucide-react";
import { kind } from "@/components/Activities";
import { MistakeList } from "@/components/Results";
import { Avatar, ButtonLink, EmptyState, IconTile, ListRow, Page, Pill, Segmented, Skeleton, cn } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { api, ApiError, errorText, getMe, signOut, useRequireLogin, type Mistake, type User } from "@/lib/api";
import { setTheme, useTheme } from "@/lib/theme";

type Me = {
  user: User;
  best: Record<string, number>;
  activities: { kind: string; score: number | null; xp: number; created_at: string }[];
  mistakes: Mistake[];
  speaking_limit_seconds: number;
};

const LEVEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" });
const when = (utc: string) => new Date(utc.replace(" ", "T") + "Z");

/** Profile hub: stats, your scores and history on the left; plan, settings and account on the right. */
export default function MePage() {
  useRequireLogin();
  const router = useRouter();
  const theme = useTheme();
  const [me, setMe] = useState<Me | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getMe<Me>()
      .then(setMe)
      // 428: profile not filled in yet; Home shows the profile form.
      .catch((e) => (e instanceof ApiError && e.status === 428 ? router.replace("/") : setMessage(errorText(e))));
  }, [router]);

  async function changeLanguage(explain_lang: string) {
    try {
      const user = await api<User>("/v1/me", { method: "PATCH", body: JSON.stringify({ explain_lang }) });
      setMe((m) => (m ? { ...m, user } : m));
    } catch (e) {
      setMessage(errorText(e));
    }
  }

  async function deleteAccount() {
    try {
      await api("/v1/me", { method: "DELETE" });
      await signOut();
    } catch (e) {
      setMessage(errorText(e));
    }
  }

  if (!me) {
    return (
      <Page aria-busy={!message}>
        {message ? <p role="alert" className="text-sm text-danger-fg">{message}</p> : <p role="status" className="sr-only">Loading…</p>}
        <Skeleton className="h-24 rounded-card" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-card" />)}</div>
        <div className="grid gap-5 lg:grid-cols-12"><Skeleton className="h-96 rounded-card lg:col-span-7" /><Skeleton className="h-96 rounded-card lg:col-span-5" /></div>
      </Page>
    );
  }

  const { user } = me;
  const plan = user.plan;
  const mistakeCount = new Set(me.mistakes.map((m) => m.original.toLowerCase())).size;
  const best = Object.entries(me.best).sort((a, b) => b[1] - a[1]);

  return (
    <Page>
      {/* Profile header */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 sm:gap-5">
          <Avatar name={user.name} size={72} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h1 className="truncate text-[1.75rem] font-semibold tracking-[-0.02em] sm:text-[2.25rem]">{user.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-fg-2">
              {user.level && <Badge>{LEVEL[user.level] ?? user.level}</Badge>}
              <Badge variant="secondary">{plan.name} plan</Badge>
              {(user.email ?? user.phone) && <span className="flex items-center gap-1.5"><Mail size={14} aria-hidden />{user.email ?? user.phone}</span>}
            </div>
          </div>
          <Button variant="secondary" onClick={() => signOut()}><LogOut />Sign out</Button>
        </CardContent>
      </Card>

      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
        <Stat icon={Zap} label="Total XP" value={user.xp.toLocaleString()} />
        <Stat icon={Flame} label="Day streak" value={`${user.streak} ${user.streak === 1 ? "day" : "days"}`} coral />
        <Stat icon={History} label="Sessions" value={me.activities.length} />
        <Stat icon={BookX} label="Mistakes to review" value={mistakeCount} href="/mistakes" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
        {/* Left: how you're doing */}
        <div className="flex flex-col gap-5 lg:col-span-7 lg:gap-6">
          <Card aria-labelledby="scores-heading">
            <CardHeader>
              <CardTitle id="scores-heading" className="flex items-center gap-2"><Trophy className="size-5 text-accent-fg" aria-hidden />Your best scores</CardTitle>
              <CardDescription>Your highest score in each activity, out of 100.</CardDescription>
            </CardHeader>
            <CardContent>
              {best.length === 0 ? (
                <EmptyState icon={Trophy} title="No scores yet" text="Complete an activity to see your best scores here." action={<ButtonLink href="/practice" size="sm">Start practising</ButtonLink>} />
              ) : (
                <ul className="flex flex-col gap-4">
                  {best.map(([k, v]) => {
                    const K = kind(k);
                    const row = (
                      <>
                        <IconTile icon={K.icon} size={36} />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="truncate font-medium">{K.label}</span>
                            <span className="font-semibold tabular-nums">{Math.round(v)}<span className="font-normal text-fg-3"> / 100</span></span>
                          </div>
                          <Progress value={v} aria-label={`${K.label} best score`} />
                        </div>
                      </>
                    );
                    return (
                      <li key={k}>
                        {"href" in K && K.href
                          ? <Link href={K.href} className="-m-2 flex items-center gap-3 rounded-tile p-2 transition hover:bg-hover">{row}</Link>
                          : <div className="flex items-center gap-3">{row}</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card aria-labelledby="history-heading">
            <CardHeader>
              <CardTitle id="history-heading" className="flex items-center gap-2"><History className="size-5 text-accent-fg" aria-hidden />Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {me.activities.length === 0 ? (
                <EmptyState icon={History} title="Nothing yet" text="Your practice history will appear here." />
              ) : (
                <ul className="-mx-2 flex flex-col">
                  {me.activities.slice(0, 8).map((a, i) => (
                    <ListRow
                      key={i}
                      leading={<IconTile icon={kind(a.kind).icon} />}
                      title={<>{kind(a.kind).label}{a.score !== null && <span className="text-fg-2"> · {Math.round(a.score)}</span>}</>}
                      meta={when(a.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      trailing={<Pill tone="coral">+{a.xp} XP</Pill>}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {mistakeCount > 0 && (
            <Card aria-labelledby="mistakes-heading">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle id="mistakes-heading" className="flex items-center gap-2"><BookX className="size-5 text-accent-fg" aria-hidden />Mistakes to review</CardTitle>
                  <Link href="/mistakes" className="text-sm font-semibold text-link hover:underline">See all {mistakeCount}</Link>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <MistakeList mistakes={me.mistakes.slice(0, 2)} />
                <ButtonLink href="/coach" variant="ghost" icon={GraduationCap} className="self-start">Fix them with Mistake Coach</ButtonLink>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: plan, settings, account */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:col-span-5 lg:gap-6">
          <Card aria-labelledby="plan-heading" className="bg-linear-to-br from-hero to-hero-2 text-on-dark">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle id="plan-heading">Your plan</CardTitle>
                <Badge className="bg-white/15 text-on-dark">{plan.name}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-3 gap-2 text-center">
                <PlanFact icon={BriefcaseBusiness} label="Interviews left" value={plan.interviews_left === null ? "∞" : plan.interviews_left} />
                <PlanFact icon={Mic} label="Min / day" value={Math.round(me.speaking_limit_seconds / 60)} />
                <PlanFact icon={Calendar} label="Ends" value={plan.expires ? day(plan.expires).replace(/,? \d{4}$/, "") : "Never"} />
              </dl>
              {plan.upcoming && <p className="text-xs text-on-dark-2">{plan.upcoming} is lined up next.</p>}
              <ButtonLink href="/plans" variant="coral" icon={Sparkles} className="self-start">Upgrade your practice</ButtonLink>
            </CardContent>
          </Card>

          <Card aria-labelledby="settings-heading">
            <CardHeader><CardTitle id="settings-heading">Settings</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Setting icon={Globe} title="Explanations in" meta="Language for tips and corrections">
                <Segmented label="Explanations in" value={user.explain_lang} onChange={changeLanguage}
                  options={[{ value: "english", label: "English" }, { value: "hinglish", label: "Hinglish" }]} />
              </Setting>
              <Separator />
              <Setting icon={Sparkles} title="Appearance" meta="Day or night colours">
                <Segmented label="Appearance" value={theme} onChange={setTheme}
                  options={[{ value: "day", label: "Day" }, { value: "night", label: "Night" }]} />
              </Setting>
            </CardContent>
          </Card>

          <Card aria-labelledby="account-heading">
            <CardHeader>
              <CardTitle id="account-heading">Account</CardTitle>
              <CardDescription>Deleting your account removes your XP, scores and saved mistakes for good.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => signOut()}><LogOut />Sign out</Button>
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 />Delete account</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>Your account, XP, scores and saved mistakes are removed for good. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Keep my account</DialogClose>
            <Button variant="destructive" disabled={deleting} onClick={async () => { setDeleting(true); await deleteAccount(); setDeleting(false); setConfirmDelete(false); }}>
              <Trash2 />{deleting ? "Deleting…" : "Delete for good"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p role="alert" className="text-sm text-danger-fg empty:hidden">{message}</p>
    </Page>
  );
}

function Stat({ icon: I, label, value, coral, href }: { icon: LucideIcon; label: string; value: React.ReactNode; coral?: boolean; href?: string }) {
  const body = (
    <>
      <span className={cn("grid size-9 place-items-center rounded-full", coral ? "bg-peach text-on-mint" : "bg-raised text-accent-fg")}><I size={18} aria-hidden /></span>
      <span className="text-xs font-medium text-fg-2 sm:text-sm">{label}</span>
      <span className="text-2xl font-semibold tracking-[-0.02em] tabular-nums sm:text-3xl">{value}</span>
    </>
  );
  const cls = "flex flex-col gap-1.5 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5";
  return href
    ? <Link href={href} className={cn(cls, "transition hover:-translate-y-0.5 hover:bg-hover")}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

function PlanFact({ icon: I, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-tile bg-white/10 px-2 py-3">
      <I size={16} className="text-mint" aria-hidden />
      <dt className="order-last text-[0.6875rem] text-on-dark-2">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Setting({ icon, title, meta, children }: { icon: LucideIcon; title: string; meta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <IconTile icon={icon} size={36} />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-fg-3">{meta}</span>
        </div>
      </div>
      <div className="pl-12">{children}</div>
    </div>
  );
}
