"use client";

import { ActivityAside, WithAside } from "@/components/ActivityAside";
import { useEffect, useState } from "react";
import { ArrowRight, Check, RotateCcw, Shuffle, Volume2, X } from "lucide-react";
import { RecordButton } from "@/components/RecordButton";
import { ScoreRing, XpBadge } from "@/components/Results";
import { Page, PageHeader, cn } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorText, playAudio, postAudio, useRequireLogin } from "@/lib/api";
import { useRecorder } from "@/lib/useRecorder";

type Level = { level: number; levels: number; id: number; text: string; pool_size: number; target_seconds: number; audio: string | null };
type Result = {
  accuracy: number;
  speed: number;
  score: number;
  words: { word: string; hit: boolean }[];
  passed: boolean;
  transcript: string;
  seconds: number;
  xp: number;
  next_level: number | null;
};

const MAX_SECONDS = 20;
const LEVEL_KEY = "twister-level";

export default function TongueTwister() {
  useRequireLogin();
  // Remember the level between visits, like the mobile app does.
  const [level, setLevel] = useState(() => {
    try { return Number(localStorage.getItem(LEVEL_KEY)) || 1; } catch { return 1; }
  });
  const [round, setRound] = useState(0); // bump to draw another twister at the same level
  const [twister, setTwister] = useState<Level | null>(null);
  const [listened, setListened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const recorder = useRecorder(MAX_SECONDS, send, setMessage);

  useEffect(() => {
    api<Level>(`/v1/tongue-twister/${level}`).then(setTwister).catch((e) => setMessage(errorText(e)));
  }, [level, round]);

  function changeLevel(next: number) {
    setTwister(null);
    setResult(null);
    setListened(false);
    setLevel(next);
    try { localStorage.setItem(LEVEL_KEY, String(next)); } catch {}
    setRound((r) => r + 1);
  }

  function listen() {
    if (!twister) return;
    playAudio(twister.audio, twister.text);
    setListened(true); // it plays once, like the real challenge
  }

  async function send(wav: Blob) {
    setBusy(true);
    try {
      setResult(await postAudio<Result>(`/v1/tongue-twister/${level}`, wav, { twister_id: String(twister?.id) }));
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (!twister) {
    return (
      <Page className="max-w-3xl">
        {message ? <p role="alert" className="text-sm text-danger-fg">{message}</p> : <p role="status" className="sr-only">Loading…</p>}
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 rounded-card" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Say it clearly, then say it fast"
        subtitle={`${twister.pool_size} twisters and growing. Listen once, then say it. Get 80% of the words right to unlock the next level.`}
      />
      <WithAside aside={<ActivityAside kind="tongue_twister" tips={["Listen once, then say it slowly and clearly first.", "Speed comes after accuracy: aim for 80% of words.", "Open your mouth wide on the vowels.", "Pass a level to unlock the next one."]} />}>

      <nav aria-label="Levels" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {Array.from({ length: twister.levels }, (_, i) => {
          const n = i + 1;
          return (
            <button key={n} type="button" onClick={() => changeLevel(n)} disabled={busy || recorder.recording} aria-current={n === level ? "step" : undefined}
              aria-label={`Level ${n}`}
              className={cn("grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                n === level ? "bg-linear-to-br from-hero to-hero-2 text-mint shadow-card" : "bg-surface text-fg-2 ring-1 ring-line hover:bg-hover")}>
              {n}
            </button>
          );
        })}
      </nav>

      <Card className="bg-linear-to-br from-hero to-hero-2 text-on-dark">
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-on-dark-2">
            <Badge className="h-7 bg-white/10 px-3 text-on-dark">Level {twister.level} of {twister.levels}</Badge>
            <span>Aim for {twister.target_seconds} s</span>
          </div>
          <p className="text-2xl leading-snug font-semibold tracking-[-0.01em] sm:text-3xl">{twister.text}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={listen} disabled={listened}><Volume2 />{listened ? "Played" : "Listen once"}</Button>
            <Button variant="glass" onClick={() => changeLevel(level)} disabled={busy || recorder.recording}><Shuffle />New twister</Button>
          </div>
        </CardContent>
      </Card>

      {!result && (
        <div className="flex flex-col items-center gap-2">
          <RecordButton
            recording={recorder.recording}
            busy={busy}
            maxSeconds={MAX_SECONDS}
            onStart={() => { setMessage(""); setResult(null); recorder.start(); }}
            onStop={recorder.stop}
            label="Tap and say the twister"
          />
          <p role="status" aria-live="polite" className="min-h-5 text-sm text-danger-fg">{busy ? "" : message}</p>
        </div>
      )}

      {result && (
        <Card aria-label="Your tongue twister result">
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-6">
              <ScoreRing score={result.score} size={120} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h2 className="text-2xl font-semibold tracking-[-0.02em]">{result.passed ? "Nicely done!" : "Almost! Try again"}</h2>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="secondary">Accuracy {result.accuracy}%</Badge>
                  <Badge variant="secondary">Speed {result.speed}%</Badge>
                  <Badge variant="secondary">{result.seconds} s</Badge>
                </div>
                <div><XpBadge xp={result.xp} /></div>
              </div>
            </div>
            <div aria-label="Words you got right and missed" className="flex flex-wrap gap-2">
              {result.words.map((w, i) => (
                <span key={i} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium", w.hit ? "bg-mint/25 text-[var(--good)]" : "bg-danger/10 text-[var(--bad)]")}>
                  {w.hit ? <Check size={14} aria-label="Said" /> : <X size={14} aria-label="Missed" />}{w.word}
                </span>
              ))}
            </div>
            <p className="rounded-tile bg-raised px-4 py-3 text-sm text-fg-2">We heard: “{result.transcript}”</p>
            <div className="flex flex-wrap gap-3">
              {result.next_level && <Button onClick={() => changeLevel(result.next_level!)}>Next level <ArrowRight /></Button>}
              <Button variant="secondary" onClick={() => setResult(null)}><RotateCcw />Try again</Button>
            </div>
          </CardContent>
        </Card>
      )}
      </WithAside>
    </Page>
  );
}
