"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Check, ChevronRight, Flame, GraduationCap, History, LayoutGrid, MessagesSquare, Sparkles, Target, Timer, Trophy, Zap,
} from "lucide-react";
import { ACTIVITIES, ActivityCard, KINDS, kind } from "@/components/Activities";
import { MistakeList } from "@/components/Results";
import { ProfileForm, NewPassword } from "@/components/Auth";
import { Landing } from "@/components/landing/Landing";
import {
  ButtonLink, Card, CardTitle, EmptyState, Flourish, IconTile, ListRow, Page, Pill, Skeleton, Tabs, cn,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Card as UiCard, CardContent, CardDescription, CardHeader, CardTitle as UiCardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ApiError, errorText, getMe, usePasswordRecovery, useToken, type Mistake, type User } from "@/lib/api";

type Me = {
  user: User;
  activities: { kind: string; score: number | null; xp: number; created_at: string }[];
  mistakes: Mistake[];
  best: Record<string, number>;
  speaking_seconds_today: number;
  speaking_limit_seconds: number;
};


// Same three as the mobile Home "Today's plan".
const PLAN = [
  { kind: "daily_word", title: "Daily Word", text: "Guess today's five-letter word", time: "2 min", href: "/daily-word", icon: LayoutGrid },
  { kind: "jam", title: "JAM", text: "Speak for one minute on today's topic", time: "1 min", href: "/jam", icon: Timer },
  { kind: "roleplay", title: "Role-play", text: "Talk with an AI partner about your day", time: "5 min", href: "/roleplay", icon: MessagesSquare },
];

// The API stores activity times in UTC as "YYYY-MM-DD HH:MM:SS".
const when = (utc: string) => new Date(utc.replace(" ", "T") + "Z");
const localDay = (utc: string) => when(utc).toDateString();

export default function Home() {
  const token = useToken();
  const recovering = usePasswordRecovery();
  if (token === undefined) return <Page />;
  if (token && recovering) return <NewPassword />;
  return token ? <Dashboard /> : <Landing />;
}

/** Home: today's plan and your progress on the first screen, then what to practise next, then mistakes and history. */
function Dashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [message, setMessage] = useState("");
  const [needsProfile, setNeedsProfile] = useState(false);
  const [version, setVersion] = useState(0); // bump to reload after the profile is saved
  const [historyTab, setHistoryTab] = useState<"recent" | "best">("recent");

  useEffect(() => {
    getMe<Me>()
      .then((m) => {
        setMe(m);
        setNeedsProfile(false);
      })
      .catch((e) => (e instanceof ApiError && e.status === 428 ? setNeedsProfile(true) : setMessage(errorText(e))));
  }, [version]);

  if (needsProfile) return <ProfileForm onDone={() => setVersion((v) => v + 1)} />;
  if (!me) return <DashboardSkeleton message={message} />;

  const { user } = me;
  const minutesLeft = Math.round(Math.max(0, me.speaking_limit_seconds - me.speaking_seconds_today) / 60);
  const limitMinutes = Math.round(me.speaking_limit_seconds / 60);
  const leftPct = me.speaking_limit_seconds ? Math.max(0, 100 - (me.speaking_seconds_today / me.speaking_limit_seconds) * 100) : 0;
  const today = new Date().toDateString();
  const doneToday = new Set(me.activities.filter((a) => localDay(a.created_at) === today).map((a) => a.kind));
  const planDone = PLAN.filter((p) => doneToday.has(p.kind)).length;
  const next = PLAN.find((p) => !doneToday.has(p.kind));

  // One copy of each mistake, newest first.
  const seen = new Set<string>();
  const mistakes = me.mistakes.filter((m) => {
    const k = m.original.toLowerCase();
    return seen.has(k) ? false : (seen.add(k), true);
  });
  const best = Object.entries(me.best).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ kind: k, label: kind(k).label, icon: kind(k).icon, value: Math.round(v) }));
  const suggestion = suggest(user, me.best);

  return (
    <Page>
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-fg-2">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="text-[2rem] font-semibold tracking-[-0.02em] sm:text-[2.5rem]">Hi {user.name.split(" ")[0]}!</h1>
      </header>

      <div className="stagger grid gap-5 lg:grid-cols-12 lg:gap-6">
        {/* Today: the hero and today's plan in one card, with one button for the next thing to do */}
        <Card variant="hero" aria-labelledby="today-heading" className="gap-5 overflow-hidden lg:col-span-8">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-mint/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="today-heading" className="text-2xl leading-tight font-semibold tracking-[-0.02em] sm:text-[1.75rem]">
                {planDone === PLAN.length ? <>All done for <Flourish>today</Flourish></> : <>Your English sounds <Flourish>better</Flourish> every day</>}
              </h2>
              <p className="text-sm text-on-dark-2">{planDone} of {PLAN.length} done today</p>
            </div>
            {user.level ? (
              next
                ? <ButtonLink href={next.href} variant="coral" icon={next.icon}>Continue: {next.title}</ButtonLink>
                : <ButtonLink href="/practice" variant="coral" icon={Sparkles}>Practise something new</ButtonLink>
            ) : (
              <ButtonLink href="/placement" variant="coral" icon={Target}>Find your level</ButtonLink>
            )}
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden>
            <div className="h-full rounded-full bg-mint transition-all duration-500" style={{ width: `${(planDone / PLAN.length) * 100}%` }} />
          </div>
          <ol className="relative flex flex-col gap-2">
            {PLAN.map((p) => {
              const done = doneToday.has(p.kind);
              return (
                <li key={p.kind}>
                  <Link href={p.href} className="group flex items-center gap-3 rounded-tile bg-white/[0.07] px-3 py-2.5 transition hover:bg-white/[0.12]">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", done ? "bg-mint text-on-mint" : "bg-white/10 text-mint")}>
                      {done ? <Check size={18} strokeWidth={2.6} aria-label="Done" /> : <p.icon size={18} aria-hidden />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn("font-semibold", done && "text-on-dark-2 line-through decoration-1")}>{p.title}</span>
                      <span className="truncate text-xs text-on-dark-2">{done ? "Done today · play again" : `${p.time} · ${p.text}`}</span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-on-dark-2 transition group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ol>
        </Card>

        {/* Your progress: streak and week, XP, level and speaking time in one card */}
        <Card aria-labelledby="progress-heading" className="gap-5 lg:col-span-4">
          <CardTitle id="progress-heading">Your progress</CardTitle>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-peach text-on-mint"><Flame size={22} aria-hidden /></span>
            <div>
              <p className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">{user.streak} {user.streak === 1 ? "day" : "days"}</p>
              <p className="text-xs text-fg-2">{user.streak ? "Current streak" : "Practise today to start a streak"}</p>
            </div>
          </div>
          <WeekDots activities={me.activities} />
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-tile bg-raised p-3">
              <dt className="flex items-center gap-1.5 text-xs text-fg-2"><Zap size={14} aria-hidden />Total XP</dt>
              <dd className="text-xl font-semibold tabular-nums">{user.xp.toLocaleString()}</dd>
            </div>
            <div className="rounded-tile bg-raised p-3">
              <dt className="flex items-center gap-1.5 text-xs text-fg-2"><Target size={14} aria-hidden />Level</dt>
              <dd className="text-xl font-semibold capitalize">
                {user.level ?? <Link href="/placement" className="text-base text-link hover:underline">Find out</Link>}
              </dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">Speaking left today</span>
              <span className="text-fg-2 tabular-nums">{minutesLeft} of {limitMinutes} min</span>
            </div>
            <Progress value={leftPct} aria-label="Speaking time left today" />
          </div>
        </Card>
      </div>

      <section aria-labelledby="keep-heading" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="keep-heading" className="text-xl font-semibold tracking-[-0.01em]">Keep practising</h2>
          <Link href="/practice" className="text-sm font-semibold text-link hover:underline">See all practice</Link>
        </div>
        <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          <ActivityCard a={{ ...activity("/coach"), text: mistakes.length ? `${mistakes.length} mistake${mistakes.length === 1 ? "" : "s"} ready to fix` : "Practise first, then fix your mistakes" }} />
          <ActivityCard a={activity("/interview")} />
          <ActivityCard a={{ ...activity(suggestion.href), title: `Suggested: ${activity(suggestion.href).title}`, text: suggestion.why }} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <Card aria-labelledby="mistakes-heading" className="lg:col-span-7">
          <div className="flex items-center justify-between gap-3">
            <CardTitle id="mistakes-heading">Mistakes to review</CardTitle>
            {mistakes.length > 0 && <Link href="/mistakes" className="text-sm font-semibold text-link hover:underline">See all {mistakes.length}</Link>}
          </div>
          {mistakes.length === 0 ? (
            <EmptyState icon={Sparkles} title="No mistakes yet" text="Anything you get wrong in a role-play, JAM or quiz shows up here to review." />
          ) : (
            <>
              <MistakeList mistakes={mistakes.slice(0, 3)} />
              <ButtonLink href="/coach" variant="ghost" icon={GraduationCap} className="self-start">Fix them with Mistake Coach</ButtonLink>
            </>
          )}
        </Card>

        <div className="flex flex-col gap-5 lg:col-span-5 lg:gap-6">
        <Card aria-labelledby="history-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle id="history-heading">Your activity</CardTitle>
            <Tabs label="Activity" value={historyTab} onChange={setHistoryTab}
              tabs={[{ value: "recent", label: "Recent" }, { value: "best", label: "Best scores" }]} />
          </div>
          {historyTab === "recent" ? (
            me.activities.length === 0 ? (
              <EmptyState icon={History} title="Nothing yet" text="Your practice history will appear here." />
            ) : (
              <ul className="-mx-2 flex flex-col">
                {me.activities.slice(0, 5).map((a, i) => (
                  <ListRow
                    key={i}
                    leading={<IconTile icon={kind(a.kind).icon} />}
                    title={<>{kind(a.kind).label}{a.score !== null && <span className="text-fg-2"> · {Math.round(a.score)}</span>}</>}
                    meta={when(a.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    trailing={<Pill tone="coral">+{a.xp} XP</Pill>}
                  />
                ))}
              </ul>
            )
          ) : best.length === 0 ? (
            <EmptyState icon={Trophy} title="No scores yet" text="Complete an activity to see your best scores here." />
          ) : (
            <ul className="flex flex-col gap-3.5">
              {best.map((b) => (
                <li key={b.kind} className="flex items-center gap-3">
                  <IconTile icon={b.icon} size={32} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{b.label}</span>
                      <span className="font-semibold tabular-nums">{b.value}<span className="font-normal text-fg-3"> / 100</span></span>
                    </div>
                    <Progress value={b.value} aria-label={`${b.label} best score`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <WeekSummary activities={me.activities} />
        </div>
      </div>

      <p role="alert" className="text-sm text-danger-fg empty:hidden">{message}</p>
    </Page>
  );
}

const WEEK_GOAL = 5; // practice days a week

/** This week at a glance (Monday to today): days practised against a 5-day goal, XP, sessions and average score. */
function WeekSummary({ activities }: { activities: Me["activities"] }) {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const week = activities.filter((a) => when(a.created_at) >= monday);
  const days = new Set(week.map((a) => localDay(a.created_at))).size;
  const xp = week.reduce((n, a) => n + a.xp, 0);
  const scored = week.filter((a) => a.score !== null);
  const avg = scored.length ? Math.round(scored.reduce((n, a) => n + (a.score ?? 0), 0) / scored.length) : null;
  const goalMet = days >= WEEK_GOAL;
  return (
    <UiCard aria-labelledby="week-summary-heading" className="flex-1">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <UiCardTitle id="week-summary-heading">This week</UiCardTitle>
          <Badge variant={goalMet ? "default" : "secondary"}>{goalMet ? "Goal met" : `${WEEK_GOAL - days} ${WEEK_GOAL - days === 1 ? "day" : "days"} to goal`}</Badge>
        </div>
        <CardDescription>Practise on {WEEK_GOAL} days a week to keep improving.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Days practised</span>
            <span className="tabular-nums text-fg-2">{Math.min(days, 7)} of {WEEK_GOAL}</span>
          </div>
          <Progress value={Math.min(100, (days / WEEK_GOAL) * 100)} aria-label="Practice days this week" />
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "XP earned", value: xp.toLocaleString(), icon: Zap },
            { label: "Sessions", value: week.length, icon: History },
            { label: "Avg. score", value: avg ?? "–", icon: Trophy },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 rounded-tile bg-raised px-2 py-3">
              <s.icon size={16} className="text-accent-fg" aria-hidden />
              <dt className="order-last text-[0.6875rem] text-fg-2">{s.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </UiCard>
  );
}

/** The next thing worth practising: the placement test without a level, else the activity with the lowest best score. */
function suggest(user: User, best: Record<string, number>): { href: string; why: string } {
  if (!user.level) return { href: "/placement", why: "Answer three questions out loud to find your level." };
  const scored = Object.entries(best).filter(([k]) => KINDS[k]?.href && k !== "placement");
  if (scored.length === 0) return { href: "/quiz", why: "Ten quick questions to see where you stand." };
  const [k, score] = scored.sort((a, b) => a[1] - b[1])[0];
  return { href: KINDS[k].href!, why: `Your lowest best score is ${Math.round(score)}. Try to beat it.` };
}

function DashboardSkeleton({ message }: { message: string }) {
  return (
    <Page aria-busy={!message}>
      {message ? <p role="alert" className="text-sm text-danger-fg">{message}</p> : <p role="status" className="sr-only">Loading…</p>}
      <Skeleton className="h-12 w-64 rounded-full" />
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <Skeleton className="h-80 rounded-card lg:col-span-8" />
        <Skeleton className="h-80 rounded-card lg:col-span-4" />
      </div>
      <div className="grid gap-5 sm:grid-cols-3"><Skeleton className="h-36 rounded-card" /><Skeleton className="h-36 rounded-card" /><Skeleton className="h-36 rounded-card" /></div>
    </Page>
  );
}

const activity = (href: string) => ACTIVITIES.find((a) => a.href === href)!;

/** This week, Monday to Sunday: a tick on each day with practice (same as the mobile Home). */
function WeekDots({ activities }: { activities: { created_at: string }[] }) {
  const today = new Date();
  const done = new Set(activities.map((a) => localDay(a.created_at)));
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { name: d.toLocaleDateString(undefined, { weekday: "long" }), letter: "MTWTFSS"[i], done: done.has(d.toDateString()), isToday: d.toDateString() === today.toDateString(), future: d > today };
  });
  return (
    <ol aria-label="This week" className="flex justify-between gap-1">
      {days.map((d) => (
        <li key={d.name} className="flex flex-col items-center gap-1.5">
          <span className={cn("text-[0.6875rem] font-semibold", d.isToday ? "text-fg" : "text-fg-3")} aria-hidden>{d.letter}</span>
          <span className={cn("grid size-8 place-items-center rounded-full",
            d.done ? "bg-mint text-on-mint" : d.isToday ? "border-2 border-dashed border-accent-fg" : d.future ? "border border-line" : "bg-raised")}>
            {d.done && <Check size={15} strokeWidth={2.8} aria-hidden />}
            <span className="sr-only">{d.name}: {d.done ? "practised" : d.future ? "coming up" : d.isToday ? "today, not yet" : "no practice"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

