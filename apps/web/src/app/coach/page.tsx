"use client";

import { ActivityAside, WithAside } from "@/components/ActivityAside";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, GraduationCap, LoaderCircle, Mic, RotateCcw, ShieldCheck, Sparkles, Volume2 } from "lucide-react";
import { ChatBubble, TypingBubble } from "@/components/Chat";
import { RecordButton } from "@/components/RecordButton";
import { MistakeList, XpBadge } from "@/components/Results";
import { Page, PageHeader, Segmented } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api, errorText, playAudio, postAudio, postJson, useRequireLogin, type Mistake, type User, getMe } from "@/lib/api";
import { useHandsFree } from "@/lib/useHandsFree";

type Lang = "english" | "hinglish";
type Reply = { reply: string; audio: string | null; turns_left: number; transcript?: string; session_id?: number };
type Recap = { summary: string; audio: string | null; mistakes: Mistake[]; xp: number };
type Line = { mine: boolean; text: string; audio?: string | null };

const LANGS: { value: Lang; label: string }[] = [{ value: "english", label: "English" }, { value: "hinglish", label: "Hinglish" }];

/** Hands-free spoken coaching on the learner's recent mistakes: the mic opens after the coach speaks and sends when they stop. */
export default function Coach() {
  useRequireLogin();
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null);
  const [lang, setLang] = useState<Lang>("english");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [turnsLeft, setTurnsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [handsFree, setHandsFree] = useState(true);
  const [message, setMessage] = useState("");
  const [recap, setRecap] = useState<Recap | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const playId = useRef(0); // only the latest playback may open the mic
  const live = useRef({ handsFree, turnsLeft });
  useEffect(() => {
    live.current = { handsFree, turnsLeft };
  });

  const listener = useHandsFree(30, sendTurn, () => {
    setHandsFree(false);
    setMessage("I didn't hear anything. Tap the mic when you're ready.");
  }, (m) => { setHandsFree(false); setMessage(m); });

  useEffect(() => {
    const plays = playId;
    getMe<{ user: User; mistakes: Mistake[] }>().then((r) => {
      setMistakes(r.mistakes);
      setLang(r.user.explain_lang === "hinglish" ? "hinglish" : "english");
    }).catch((e) => setMessage(errorText(e)));
    return () => { plays.current++; }; // a reply finishing after leaving the page must not open the mic
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines, busy]);

  /** Speak a coach line; afterwards listen again if hands-free is on. */
  function say(audio: string | null | undefined, text: string, listenAfter = true) {
    const id = ++playId.current;
    setSpeaking(true);
    playAudio(audio, text, () => {
      if (id !== playId.current) return;
      setSpeaking(false);
      if (listenAfter && live.current.handsFree && live.current.turnsLeft > 0) listener.start();
    });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setHandsFree(false); // wait for a tap instead of reopening the mic straight after an error
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const start = () =>
    run(async () => {
      setHandsFree(true);
      const r = await postJson<Reply>("/v1/coach", { language: lang });
      setSessionId(r.session_id!);
      setLines([{ mine: false, text: r.reply, audio: r.audio }]);
      setTurnsLeft(r.turns_left);
      live.current.turnsLeft = r.turns_left;
      say(r.audio, r.reply);
    });

  function sendTurn(wav: Blob) {
    run(async () => {
      const r = await postAudio<Reply>(`/v1/coach/${sessionId}/turn`, wav);
      setLines((l) => [...l, { mine: true, text: r.transcript ?? "" }, { mine: false, text: r.reply, audio: r.audio }]);
      setTurnsLeft(r.turns_left);
      live.current.turnsLeft = r.turns_left;
      say(r.audio, r.reply);
    });
  }

  function listenNow() {
    setMessage("");
    setHandsFree(true);
    listener.start();
  }

  function pause() {
    setHandsFree(false);
    listener.cancel();
  }

  const finish = () => {
    pause();
    playId.current++;
    setSpeaking(false);
    run(async () => {
      const r = await api<Recap>(`/v1/coach/${sessionId}/finish`, { method: "POST" });
      setRecap(r);
      say(r.audio, r.summary, false);
    });
  };

  function reset() {
    playId.current++;
    setRecap(null);
    setSessionId(null);
    setLines([]);
    setSpeaking(false);
    getMe<{ mistakes: Mistake[] }>().then((r) => setMistakes(r.mistakes)).catch(() => {});
  }

  if (recap) {
    return (
      <Page className="max-w-3xl">
        <PageHeader title="Mistake Coach recap" subtitle="Here's what you worked on in this session." />
        <Card aria-label="Your recap">
          <CardContent className="flex flex-col gap-4">
            <p className="text-base leading-relaxed">{recap.summary}</p>
            <div className="flex items-center gap-3">
              <XpBadge xp={recap.xp} />
              <Button variant="secondary" size="sm" onClick={() => say(recap.audio, recap.summary, false)} aria-label="Play recap again"><Volume2 />Play recap</Button>
            </div>
          </CardContent>
        </Card>
        {recap.mistakes.length > 0 && (
          <Card aria-labelledby="new-heading">
            <CardHeader><CardTitle id="new-heading">New things to work on</CardTitle></CardHeader>
            <CardContent><MistakeList mistakes={recap.mistakes} /></CardContent>
          </Card>
        )}
        <div className="flex flex-wrap gap-3">
          <Button onClick={reset}><RotateCcw />Practise again</Button>
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>Home</Link>
        </div>
      </Page>
    );
  }

  if (sessionId === null) {
    const none = mistakes !== null && mistakes.length === 0;
    return (
      <Page>
        <PageHeader
          title="Fix your recent mistakes"
          subtitle="Your coach explains each mistake, you say it the right way, and it checks you. Hands-free: it listens when the coach stops talking."
        />
      <WithAside aside={<ActivityAside kind="coach" speaking={true} tips={["Say each corrected sentence out loud, slowly at first.", "Ask the coach to explain again if anything is unclear.", "Switch to Hinglish explanations anytime.", "Finish to get a recap of what you fixed."]} />}>
        <Card className="bg-linear-to-br from-hero to-hero-2 text-on-dark">
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl bg-peach text-on-mint"><GraduationCap size={24} aria-hidden /></span>
              <div>
                <p className="font-semibold">Explanations in</p>
                <p className="text-sm text-on-dark-2">Pick the language your coach explains in</p>
              </div>
            </div>
            <Segmented label="Explanation language" value={lang} options={LANGS} onChange={setLang} />
          </CardContent>
        </Card>

        {none ? (
          <Card>
            <CardContent className="flex items-start gap-3 text-sm">
              <Sparkles size={20} className="shrink-0 text-coral" aria-hidden />
              <p>No saved mistakes yet. Do a <Link href="/roleplay" className="font-semibold text-link underline">role-play</Link>, <Link href="/jam" className="font-semibold text-link underline">JAM</Link> or <Link href="/quiz" className="font-semibold text-link underline">quiz</Link> first, then come back.</p>
            </CardContent>
          </Card>
        ) : mistakes && (
          <Card aria-labelledby="recent-heading">
            <CardHeader>
              <CardTitle id="recent-heading">You&apos;ll practise mistakes like these</CardTitle>
              <CardDescription>{mistakes.length} saved from your practice</CardDescription>
            </CardHeader>
            <CardContent><MistakeList mistakes={mistakes.slice(0, 3)} /></CardContent>
            <CardFooter className="flex-col items-start gap-3 border-t border-line pt-(--card-spacing)">
              <Button size="lg" onClick={start} disabled={busy || !mistakes || none}>
                {busy ? <LoaderCircle className="animate-spin" /> : <Mic />}Start coaching
              </Button>
              <p className="flex items-center gap-2 text-xs text-fg-2"><ShieldCheck size={16} aria-hidden />Your microphone opens only while it&apos;s your turn to speak.</p>
            </CardFooter>
          </Card>
        )}
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-fg-2">{busy ? "Starting your session…" : message}</p>
      </WithAside>
      </Page>
    );
  }

  const label = turnsLeft === 0 ? "No turns left" : speaking ? "Coach is speaking…" : "Tap to speak";
  return (
    <Page className="max-w-3xl">
      <PageHeader
        title="Your coaching session"
        subtitle={`Explaining in ${lang === "hinglish" ? "Hinglish" : "English"}`}
        actions={<Badge variant="secondary" className="h-8 px-3 text-sm">{turnsLeft} {turnsLeft === 1 ? "turn" : "turns"} left</Badge>}
      />

      <Card className="min-h-[50dvh]">
        <CardContent aria-live="polite" aria-label="Conversation" className="flex flex-col gap-4">
          {lines.map((l, i) => (
            <ChatBubble key={i} mine={l.mine} who="Coach" replayDisabled={listener.listening}
              onReplay={l.mine ? undefined : () => { pause(); say(l.audio, l.text, false); }}>
              {l.text}
            </ChatBubble>
          ))}
          {busy && <TypingBubble who="Coach" />}
          <div ref={endRef} />
        </CardContent>
      </Card>

      <div className="sticky bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] z-10 flex flex-col items-center gap-3 rounded-card bg-surface/90 p-4 shadow-pop ring-1 ring-line backdrop-blur-xl lg:bottom-4">
        <RecordButton
          recording={listener.listening}
          busy={busy}
          disabled={speaking || turnsLeft === 0}
          maxSeconds={30}
          onStart={listenNow}
          onStop={listener.send}
          label={label}
          stopLabel="Listening… tap to send now"
          busyLabel="Thinking…"
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          {handsFree && turnsLeft > 0 ? (
            <Button variant="ghost" size="sm" onClick={pause} disabled={busy}>Pause hands-free</Button>
          ) : (
            <span className="text-xs text-fg-2">{turnsLeft > 0 ? "Hands-free is paused. Tap the mic to carry on." : "That's all the turns for this session."}</span>
          )}
          <Button variant="secondary" size="sm" onClick={finish} disabled={busy || lines.length < 2}>Finish &amp; get recap <ArrowRight /></Button>
        </div>
        <p role="status" aria-live="polite" className="text-sm text-danger-fg empty:hidden">{message}</p>
      </div>
    </Page>
  );
}
