"use client";

import { ActivityAside, WithAside } from "@/components/ActivityAside";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, LoaderCircle, Mic, RotateCcw, Square, Timer, X } from "lucide-react";
import { MistakeList, Ring, ScoreGrid, ScoreRing, XpBadge } from "@/components/Results";
import { Page, PageHeader, cn } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorText, postAudio, useRequireLogin, type Mistake } from "@/lib/api";
import { useRecorder } from "@/lib/useRecorder";

type Topic = { topic: string; think_seconds: number; speak_seconds: number };
type Result = {
  topic: string;
  transcript: string;
  metrics: { word_count: number; words_per_minute: number; fillers: Record<string, number>; filler_count: number; repetitions: number; long_pauses: number };
  scores: Record<string, number>;
  penalty: number;
  score: number;
  feedback: string;
  mistakes: Mistake[];
  xp: number;
};

export default function Jam() {
  useRequireLogin();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [phase, setPhase] = useState<"ready" | "think" | "speak" | "scoring" | "done">("ready");
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorder = useRecorder(topic?.speak_seconds ?? 60, submit, (m) => { setMessage(m); setPhase("ready"); });

  useEffect(() => {
    api<Topic>("/v1/jam/topic").then(setTopic).catch((e) => setMessage(errorText(e)));
    return () => { if (tick.current) clearInterval(tick.current); };
  }, []);

  function countdown(from: number, then: () => void) {
    if (tick.current) clearInterval(tick.current);
    setSeconds(from);
    let left = from;
    tick.current = setInterval(() => {
      left -= 1;
      setSeconds(left);
      if (left <= 0) {
        clearInterval(tick.current!);
        then();
      }
    }, 1000);
  }

  function begin() {
    if (!topic) return;
    setMessage("");
    setResult(null);
    setPhase("think");
    countdown(topic.think_seconds, async () => {
      await recorder.start();
      setPhase("speak");
      countdown(topic.speak_seconds, () => {});
    });
  }

  async function submit(wav: Blob) {
    if (tick.current) clearInterval(tick.current);
    setPhase("scoring");
    try {
      setResult(await postAudio<Result>("/v1/jam", wav));
      setPhase("done");
    } catch (e) {
      setMessage(errorText(e));
      setPhase("ready");
    }
  }

  if (!topic) {
    return (
      <Page className="max-w-3xl">
        {message ? <p role="alert" className="text-sm text-danger-fg">{message}</p> : <p role="status" className="sr-only">Loading…</p>}
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-40 rounded-card" />
      </Page>
    );
  }

  const total = phase === "think" ? topic.think_seconds : topic.speak_seconds;
  const live = phase === "think" || phase === "speak";

  return (
    <Page>
      <PageHeader title="JAM: Just a Minute" subtitle="Everyone gets the same topic today, so you can compare scores with friends." />
      <WithAside aside={<ActivityAside kind="jam" tips={["Use the thinking time to pick three points to talk about.", "Keep going: a short pause is better than umm.", "Vary your words instead of repeating the same ones.", "Everyone gets the same topic today: compare with friends."]} />}>

      <Card className="bg-linear-to-br from-hero to-hero-2 text-on-dark">
        <CardContent className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wider text-mint uppercase">Today&apos;s topic</span>
          <p className="text-2xl leading-snug font-semibold tracking-[-0.01em] sm:text-3xl">{topic.topic}</p>
        </CardContent>
      </Card>

      {phase === "ready" && (
        <Card>
          <CardContent className="flex flex-col gap-5">
            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Timer, text: `${topic.think_seconds} seconds to think`, cls: "bg-mint text-on-mint" },
                { icon: Mic, text: `${topic.speak_seconds} seconds to speak`, cls: "bg-hero text-mint" },
                { icon: X, text: "Avoid “umm” and “basically”", cls: "bg-peach text-on-mint" },
              ].map(({ icon: I, text, cls }) => (
                <li key={text} className="flex items-center gap-3 rounded-tile bg-raised p-4 text-sm font-medium">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", cls)}><I size={18} aria-hidden /></span>{text}
                </li>
              ))}
            </ul>
            <Button size="lg" onClick={begin} className="self-center">Start <ArrowRight /></Button>
          </CardContent>
        </Card>
      )}

      {phase === "ready" && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card size="sm">
            <CardHeader><CardTitle>Plan your minute</CardTitle></CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3">
                {[
                  { time: "0–10 s", title: "Open", text: "Say what the topic means to you in one sentence." },
                  { time: "10–50 s", title: "Two or three points", text: "Give a reason or a short example for each." },
                  { time: "50–60 s", title: "Close", text: "Sum up, or say how you feel about it now." },
                ].map((x) => (
                  <li key={x.title} className="flex gap-3">
                    <Badge variant="secondary" className="h-6 w-16 shrink-0 justify-center tabular-nums">{x.time}</Badge>
                    <span className="flex flex-col text-sm">
                      <strong className="font-semibold">{x.title}</strong>
                      <span className="text-fg-2">{x.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader><CardTitle>How you&apos;re scored</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="text-fg-2">Your score is the average of four parts, out of 100:</p>
              <div className="flex flex-wrap gap-1.5">
                {["Fluency", "Vocabulary", "Grammar", "Relevance to the topic"].map((p) => <Badge key={p} variant="outline">{p}</Badge>)}
              </div>
              <p className="text-fg-2">Then points come off:</p>
              <ul className="flex flex-col gap-1.5">
                <li className="flex justify-between gap-2"><span>Each filler word (umm, like, basically…)</span><strong className="shrink-0 text-danger-fg">−2, up to −20</strong></li>
                <li className="flex justify-between gap-2"><span>Each long pause</span><strong className="shrink-0 text-danger-fg">−2, up to −10</strong></li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {live && (
        <div className="flex flex-col items-center gap-4 py-4">
          <Ring value={(seconds / total) * 100} size={200} stroke={14} className={phase === "think" ? "text-[var(--ok)]" : "text-danger"}>
            <span className="text-6xl font-semibold tracking-[-0.03em] tabular-nums">{seconds}</span>
            <span className="text-sm text-fg-2">seconds</span>
          </Ring>
          <p aria-live="assertive" className={cn("flex items-center gap-2 text-lg font-semibold", phase === "speak" && "text-danger-fg")}>
            {phase === "think" ? "Think about what you'll say…" : <><span className="size-2.5 animate-pulse rounded-full bg-danger" /><Mic size={18} aria-hidden />Speak now!</>}
          </p>
          {phase === "speak" && <Button variant="secondary" onClick={recorder.stop}><Square className="size-4" fill="currentColor" />Stop early</Button>}
        </div>
      )}

      {phase === "scoring" && (
        <div className="flex flex-col items-center gap-3 py-10 text-fg-2">
          <LoaderCircle size={40} className="animate-spin text-accent-fg" aria-hidden />
        </div>
      )}
      <p role="status" aria-live="polite" className="min-h-5 text-center text-sm text-fg-2">{phase === "scoring" ? "Scoring your minute…" : message}</p>

      {result && (
        <section aria-label="Your JAM result" className="flex flex-col gap-5">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-6">
              <ScoreRing score={result.score} size={120} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h2 className="text-2xl font-semibold tracking-[-0.02em]">Your minute</h2>
                <p className="text-sm text-fg-2">{result.feedback}</p>
                <div><XpBadge xp={result.xp} /></div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Words per minute" value={result.metrics.words_per_minute} />
            <Stat label="Filler words" value={result.metrics.filler_count}
              note={result.metrics.filler_count > 0 ? Object.entries(result.metrics.fillers).map(([w, n]) => `${w} ×${n}`).join(", ") : undefined} />
            <Stat label="Long pauses" value={result.metrics.long_pauses} />
            <Stat label="Repeated words" value={result.metrics.repetitions} />
          </div>
          {result.penalty > 0 && (
            <p className="flex items-center gap-2 rounded-tile bg-danger/10 px-4 py-3 text-sm font-medium text-[var(--bad)]">
              <AlertTriangle size={18} aria-hidden />−{result.penalty} points for fillers and pauses
            </p>
          )}

          <Card>
            <CardHeader><CardTitle>Score breakdown</CardTitle></CardHeader>
            <CardContent><ScoreGrid scores={result.scores} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Mistakes</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <MistakeList mistakes={result.mistakes} />
              <p className="rounded-tile bg-raised px-4 py-3 text-sm text-fg-2">We heard: “{result.transcript}”</p>
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-3">
            <Button onClick={begin}><RotateCcw />Try again</Button>
            <Link href="/" className={buttonVariants({ variant: "secondary" })}>Home</Link>
          </div>
        </section>
      )}
      </WithAside>
    </Page>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs font-medium text-fg-2">{label}</span>
        <span className="text-3xl font-semibold tracking-[-0.02em] tabular-nums">{value}</span>
        {note && <span className="text-xs text-fg-3">{note}</span>}
      </CardContent>
    </Card>
  );
}
