"use client";

import { ActivityAside, WithAside } from "@/components/ActivityAside";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, LoaderCircle, RotateCcw, Timer, Trophy, Volume2, X, Zap } from "lucide-react";
import { RecordButton } from "@/components/RecordButton";
import { Ring, XpBadge } from "@/components/Results";
import { Page, PageHeader, cn } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { errorText, playAudio, postAudio, postJson, useRequireLogin } from "@/lib/api";
import { useRecorder } from "@/lib/useRecorder";

type Word = { word: string; by: "you" | "ai"; points: number };
type Game = {
  id: number;
  words: Word[];
  score: number;
  next_letter: string | null;
  retry_used: boolean;
  finished: boolean;
  turn_seconds: number;
  ai_audio: string | null;
  turn: { heard: string | null; ok: boolean; reason?: string; retry?: boolean; points?: number; won?: boolean } | null;
  xp: number;
};

export default function WordChain() {
  useRequireLogin();
  const [game, setGame] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState(0); // when the learner's turn ends (the server checks it too)
  const [now, setNow] = useState(0); // set when a turn starts, never during render (pages are prerendered)
  const recorder = useRecorder(game?.turn_seconds ?? 15, sendWord, setMessage);
  const live = useRef({ recording: false, busy: false });
  useEffect(() => {
    live.current = { recording: recorder.recording, busy };
  });

  function show(next: Game) {
    const t = Date.now();
    setNow(t);
    setDeadline(t + next.turn_seconds * 1000);
    setGame(next);
    const ai = next.words[next.words.length - 1];
    if (!next.finished && ai?.by === "ai") playAudio(next.ai_audio, ai.word);
  }

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      show(await postJson<Game>("/v1/word-chain", {}));
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendWord(wav: Blob) {
    if (!game) return;
    setBusy(true);
    try {
      show(await postAudio<Game>(`/v1/word-chain/${game.id}/turn`, wav));
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function timeUp(id: number) {
    try {
      const over = await postJson<Game>(`/v1/word-chain/${id}/stop`, {});
      setGame({ ...over, turn: { heard: null, ok: false, reason: "Time's up!" } });
    } catch (e) {
      setMessage(errorText(e));
    }
  }

  async function quit() {
    if (!game) return;
    try {
      setGame(await postJson<Game>(`/v1/word-chain/${game.id}/stop`, {}));
    } catch (e) {
      setMessage(errorText(e));
    }
  }

  // Tick the turn timer; time runs out only while the learner isn't recording or waiting for a result.
  useEffect(() => {
    if (!game || game.finished) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline && !live.current.recording && !live.current.busy) {
        clearInterval(id);
        timeUp(game.id);
      }
    }, 250);
    return () => clearInterval(id);
  }, [game, deadline]);

  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const last = game?.words[game.words.length - 1];
  const yourWords = game?.words.filter((w) => w.by === "you").length ?? 0;

  return (
    <Page>
      <PageHeader
        title="Keep the chain going"
        subtitle="Say a word that starts with the last letter of the AI's word. No repeats, and be quick!"
        actions={game && !game.finished && <Badge variant="secondary" className="h-8 px-3 text-sm"><Zap aria-hidden />{game.score} points</Badge>}
      />
      <WithAside aside={<ActivityAside kind="word_chain" tips={["Think of words ending in common letters like E, S or T.", "Longer words score more points.", "Speak clearly: one retry if we mishear you.", "No repeats: every word must be new."]} />}>

      {!game && (
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>Reach 10 words to beat the AI.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Timer, text: "15 seconds per word" },
                { icon: Zap, text: "Longer words score more" },
                { icon: RotateCcw, text: "One retry if we mishear you" },
              ].map(({ icon: I, text }) => (
                <li key={text} className="flex items-center gap-3 rounded-tile bg-raised p-4 text-sm font-medium">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint text-on-mint"><I size={18} aria-hidden /></span>
                  {text}
                </li>
              ))}
            </ul>
            <Button size="lg" onClick={start} disabled={busy} className="self-center">
              {busy ? <LoaderCircle className="animate-spin" /> : <>Start game <ArrowRight /></>}
            </Button>
          </CardContent>
        </Card>
      )}

      {game && (
        <>
          {!game.finished && last && (
            <Card className="items-center bg-linear-to-br from-hero to-hero-2 text-center text-on-dark">
              <CardContent className="flex w-full flex-col items-center gap-4">
                <p className="text-sm font-medium text-on-dark-2">The AI said</p>
                <div className="flex items-center gap-3">
                  <p className="text-4xl font-bold tracking-[-0.02em] sm:text-5xl">{last.word}</p>
                  <Button variant="glass" size="icon" onClick={() => playAudio(game.ai_audio, last.word)} aria-label="Hear the word again"><Volume2 /></Button>
                </div>
                <p className="text-base">
                  Your word starts with <span className="ml-1 inline-grid size-9 place-items-center rounded-lg bg-coral text-xl font-bold text-on-coral uppercase">{game.next_letter}</span>
                </p>
              </CardContent>
            </Card>
          )}

          {game.turn && (
            <p role="status" className={cn("flex items-center gap-2 rounded-tile px-4 py-3 text-sm font-medium", game.turn.ok ? "bg-mint/20 text-[var(--good)]" : "bg-danger/10 text-[var(--bad)]")}>
              {game.turn.ok ? <Check size={18} aria-hidden /> : <X size={18} aria-hidden />}
              <span>
                {game.turn.heard ? <>We heard “{game.turn.heard}”. </> : null}
                {game.turn.ok ? `+${game.turn.points} points!` : game.turn.reason}
                {game.turn.retry && " You get one retry. Try again!"}
              </span>
            </p>
          )}

          {!game.finished && last && (
            <div className="flex flex-wrap items-center justify-center gap-8">
              {!recorder.recording && !busy && (
                <Ring value={(seconds / game.turn_seconds) * 100} size={96} stroke={8} className={seconds <= 5 ? "text-[var(--bad)]" : "text-mint-hover"}>
                  <span className="text-2xl font-semibold tabular-nums">{seconds}</span>
                  <span className="text-[0.6875rem] text-fg-3">sec</span>
                </Ring>
              )}
              <RecordButton
                recording={recorder.recording}
                busy={busy}
                maxSeconds={game.turn_seconds}
                onStart={() => { setMessage(""); recorder.start(); }}
                onStop={recorder.stop}
                label="Tap and say your word"
                busyLabel="Checking…"
              />
            </div>
          )}

          {game.finished && (
            <Card aria-label="Your Word Chain result">
              <CardContent className="flex flex-wrap items-center gap-6">
                <div className="grid size-24 shrink-0 place-items-center rounded-full bg-mint/25 text-accent-fg">
                  <Trophy size={40} aria-hidden />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <h2 className="text-2xl font-semibold tracking-[-0.02em]">{game.turn?.won ? "You beat the AI!" : "Game over"}</h2>
                  <p className="text-sm text-fg-2">You played {yourWords} {yourWords === 1 ? "word" : "words"} and scored <strong className="text-fg">{game.score} points</strong>.</p>
                  <div><XpBadge xp={game.xp} /></div>
                </div>
                <div className="flex w-full flex-wrap gap-3 sm:w-auto">
                  <Button onClick={start} disabled={busy}><RotateCcw />Play again</Button>
                  <Link href="/practice" className={buttonVariants({ variant: "secondary" })}>More practice</Link>
                </div>
              </CardContent>
            </Card>
          )}

          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-fg-2">The chain so far · {yourWords} {yourWords === 1 ? "word" : "words"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div aria-label="The chain so far" className="flex flex-wrap gap-2">
                {game.words.map((w, i) => (
                  <span key={i} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium", w.by === "you" ? "bg-mint text-on-mint" : "bg-raised text-fg-2")}>
                    {w.word}
                    {w.by === "you" && <small className="text-xs font-semibold">+{w.points}</small>}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {!game.finished && (
            <Button variant="ghost" onClick={quit} disabled={busy || recorder.recording} className="self-center">End game</Button>
          )}
        </>
      )}
      <p role="alert" className="min-h-5 text-center text-sm text-danger-fg">{message}</p>
      </WithAside>
    </Page>
  );
}
