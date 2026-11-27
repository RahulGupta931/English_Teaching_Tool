"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Check, ChevronRight, Clock, Coffee, FileUp, ListChecks, LoaderCircle, MessagesSquare, Mic, RotateCcw, ShieldCheck, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import { ActivityAside, WithAside } from "@/components/ActivityAside";
import { ChatBubble, TypingBubble } from "@/components/Chat";
import { RecordButton } from "@/components/RecordButton";
import { MistakeList, ScoreRing, XpBadge } from "@/components/Results";
import { Page, PageHeader, cn } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, errorText, playAudio, postAudio, postJson, useRequireLogin, type Mistake, type User, getMe } from "@/lib/api";
import { useRecorder } from "@/lib/useRecorder";

const SCENARIOS: { id: string; title: string; text: string; icon: LucideIcon; tone: string; level: string; practise: string[] }[] = [
  { id: "interview", title: "Job Interview", text: "HR round: tell me about yourself, strengths, challenges.", icon: BriefcaseBusiness, tone: "from-hero to-hero-2 text-on-dark",
    level: "Formal", practise: ["Introducing yourself", "Talking about strengths", "Answering follow-up questions"] },
  { id: "everyday", title: "Everyday Conversation", text: "Order food at a cafe and make small talk.", icon: Coffee, tone: "from-[#9333ea] to-[#6b21a8] text-white",
    level: "Casual", practise: ["Ordering politely", "Asking questions", "Keeping small talk going"] },
];
const RESUME = { id: "resume", title: "Interview Preparation" };

type Reply = { reply: string; audio: string | null; turns_left: number; transcript?: string; session_id?: number; interviews_left?: number | null };
type InterviewFeedback = {
  readiness: number;
  verdict: string;
  strengths: string[];
  weaknesses: { area: string; detail: string; improve: string }[];
};
type Debrief = {
  score: number;
  summary: string;
  mistakes: Mistake[];
  better_phrases: { original: string; natural: string }[];
  interview: InterviewFeedback | null;
  xp: number;
};
type Line = { mine: boolean; text: string; audio?: string | null };

/** Spoken, turn-by-turn conversation with an AI partner, then a debrief. "interview" mode starts from an uploaded resume. */
export function Conversation({ mode }: { mode: "roleplay" | "interview" }) {
  useRequireLogin();
  const [scenario, setScenario] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [turnsLeft, setTurnsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const recorder = useRecorder(30, sendTurn, setMessage);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<User["plan"] | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines, busy]);

  // Interview mode shows how many interviews the learner's plan has left.
  useEffect(() => {
    if (mode === "interview" && sessionId === null) getMe<{ user: User }>().then((r) => setPlan(r.user.plan)).catch(() => {});
  }, [mode, sessionId]);
  const noInterviewsLeft = plan?.interviews_left === 0;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const begin = (id: string, request: () => Promise<Reply>) =>
    run(async () => {
      setScenario(id);
      const r = await request();
      setSessionId(r.session_id!);
      setLines([{ mine: false, text: r.reply, audio: r.audio }]);
      setTurnsLeft(r.turns_left);
      playAudio(r.audio, r.reply);
    });

  const start = (id: string) => begin(id, () => postJson<Reply>("/v1/roleplay", { scenario: id }));

  function startFromResume(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = ""; // allow picking the same file again after an error
    if (!file) return;
    const form = new FormData();
    form.append("resume", file);
    begin(RESUME.id, () => api<Reply>("/v1/roleplay/resume", { method: "POST", body: form }));
  }

  function sendTurn(wav: Blob) {
    run(async () => {
      const r = await postAudio<Reply>(`/v1/roleplay/${sessionId}/turn`, wav);
      setLines((l) => [...l, { mine: true, text: r.transcript ?? "" }, { mine: false, text: r.reply, audio: r.audio }]);
      setTurnsLeft(r.turns_left);
      playAudio(r.audio, r.reply);
    });
  }

  const finish = () => run(async () => setDebrief(await api<Debrief>(`/v1/roleplay/${sessionId}/finish`, { method: "POST" })));

  function reset() {
    setDebrief(null);
    setSessionId(null);
    setScenario(null);
    setLines([]);
  }

  const current = mode === "interview" ? RESUME : SCENARIOS.find((s) => s.id === scenario);
  const eyebrow = mode === "interview" ? "Interview Preparation" : "AI Role-Play";

  if (debrief) {
    return (
      <Page className="max-w-3xl">
        <PageHeader title={`${current?.title ?? "Role-play"} feedback`} subtitle="How you did, and what to practise next." />
        <Card aria-label="Your feedback">
          <CardContent className="flex flex-wrap items-center gap-6">
            <ScoreRing score={debrief.score} size={120} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-base leading-relaxed">{debrief.summary}</p>
              <div><XpBadge xp={debrief.xp} /></div>
            </div>
          </CardContent>
        </Card>

        {debrief.interview && <InterviewReport feedback={debrief.interview} />}

        <Card aria-labelledby="mistakes-heading">
          <CardHeader><CardTitle id="mistakes-heading">{debrief.interview ? "English mistakes" : "Mistakes"}</CardTitle></CardHeader>
          <CardContent><MistakeList mistakes={debrief.mistakes} /></CardContent>
        </Card>

        {debrief.better_phrases.length > 0 && (
          <Card aria-labelledby="natural-heading">
            <CardHeader><CardTitle id="natural-heading">Sound more natural</CardTitle></CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {debrief.better_phrases.map((p, i) => (
                  <li key={i} className="flex flex-col gap-1 rounded-tile bg-raised p-4 text-sm">
                    <span className="text-fg-2">You said: {p.original}</span>
                    <span className="flex items-start gap-2 font-semibold text-[var(--good)]"><Sparkles size={16} className="mt-0.5 shrink-0" aria-hidden />Try: {p.natural}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        <div className="flex flex-wrap gap-3">
          <Button onClick={reset}><RotateCcw />Practise again</Button>
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>Home</Link>
        </div>
      </Page>
    );
  }

  if (sessionId === null && mode === "interview") {
    const left = plan?.interviews_left;
    return (
      <Page>
        <PageHeader
          title="Practise for your interview"
          subtitle="Upload your resume for in-depth questions on your field, skills and projects, with follow-ups when an answer is vague."
        />
        <WithAside aside={
          <ActivityAside kind="roleplay" stats={false}
            top={plan && (
              <Card size="sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="size-4 text-accent-fg" aria-hidden />Your plan</CardTitle>
                    <Badge variant="secondary">{plan.name}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-3xl font-semibold tracking-[-0.02em] tabular-nums">
                    {left === null ? "Unlimited" : left}
                    <span className="ml-1.5 text-sm font-normal text-fg-2">{left === null ? "interviews" : left === 1 ? "interview left" : "interviews left"}</span>
                  </p>
                  {plan.expires && <p className="text-xs text-fg-2">Plan ends {new Date(`${plan.expires}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>}
                  <Link href="/plans" className={cn(buttonVariants({ variant: noInterviewsLeft ? "default" : "secondary", size: "sm" }), "self-start")}><Sparkles />{noInterviewsLeft ? "Get more interviews" : "See plans"}</Link>
                </CardContent>
              </Card>
            )}
            tips={["Use a PDF that has selectable text, not a scan.", "Answer with real examples from your projects.", "If a question is unclear, ask the interviewer to repeat it.", "Finish to get feedback on your answers and your English."]}
            bottom={
              <Card size="sm">
                <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="size-4 text-accent-fg" aria-hidden />Before you start</CardTitle></CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2.5 text-sm">
                    {["A quiet room", "Your microphone works", "Your resume as a PDF", "About 15 minutes free"].map((t) => (
                      <li key={t} className="flex items-center gap-2.5">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-mint/25 text-accent-fg"><Check size={12} strokeWidth={3} aria-hidden /></span>{t}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            } />
        }>
          <Card>
            <CardContent className="flex flex-col gap-6">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || noInterviewsLeft}
                className="group flex cursor-pointer items-center gap-5 rounded-tile border-2 border-dashed border-track bg-raised/50 p-5 text-left transition hover:border-mint-hover hover:bg-mint/5 disabled:cursor-not-allowed disabled:opacity-60 sm:p-6">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-mint text-on-mint transition group-hover:scale-105">
                  {busy ? <LoaderCircle size={26} className="animate-spin" aria-hidden /> : <FileUp size={26} aria-hidden />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <strong className="text-lg">{noInterviewsLeft ? "No interviews left" : busy ? "Reading your resume…" : "Upload your resume to start"}</strong>
                  <span className="text-sm text-fg-2">{noInterviewsLeft ? "Upgrade your plan to practise more interviews." : "PDF up to 2 MB, first 5 pages read. Scanned resumes aren't supported yet."}</span>
                </span>
                {!noInterviewsLeft && !busy && <span className={cn(buttonVariants(), "hidden shrink-0 sm:inline-flex")}>Choose PDF</span>}
              </button>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => startFromResume(e.target.files?.[0])} />

              <ol className="grid gap-3 sm:grid-cols-3" aria-label="How it works">
                {[
                  { icon: FileUp, title: "Upload", text: "We read your resume once and note your role, skills and projects." },
                  { icon: Mic, title: "Answer out loud", text: "Up to 10 questions, with follow-ups when an answer is vague." },
                  { icon: Trophy, title: "Get feedback", text: "Interview readiness, strengths, what to improve and your English." },
                ].map(({ icon: I, title, text }, n) => (
                  <li key={title} className="flex gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint/20 text-accent-fg"><I size={18} aria-hidden /></span>
                    <span className="flex flex-col gap-0.5 text-sm">
                      <strong className="font-semibold">{n + 1}. {title}</strong>
                      <span className="text-fg-2">{text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Questions you might get</CardTitle>
              <CardDescription>The interviewer covers these four kinds of question, written around your own resume.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 sm:grid-cols-2">
                {[
                  { tag: "Introduction", q: "Walk me through your background and why you're applying for this role." },
                  { tag: "Your projects and skills", q: "On the project in your resume, what was your own part, and why did you choose that approach?" },
                  { tag: "Problem-solving", q: "Here's a situation from your field. How would you handle it, step by step?" },
                  { tag: "Behavioural", q: "Tell me about a time something failed. What did you do, and what would you change?" },
                ].map((x) => (
                  <li key={x.tag} className="flex flex-col gap-2 rounded-tile bg-raised p-4">
                    <Badge variant="outline" className="bg-surface">{x.tag}</Badge>
                    <p className="text-sm leading-relaxed">“{x.q}”</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <p className="flex items-center gap-2 text-xs text-fg-2"><ShieldCheck size={16} aria-hidden />Your resume is read once and then deleted. Only a short summary is kept for the interview.</p>
          <p role="status" aria-live="polite" className="text-sm text-danger-fg empty:hidden">{busy ? "" : message}</p>
        </WithAside>
      </Page>
    );
  }

  if (sessionId === null) {
    return (
      <Page>
        <PageHeader title="Choose a situation" subtitle="Speak your replies out loud. You'll get a score, your mistakes and more natural phrases at the end." />
        <WithAside aside={
          <ActivityAside kind="roleplay" tips={[
            "Answer in full sentences, not single words.",
            "It's fine to pause and think before you speak.",
            "Tap the speaker on any reply to hear it again.",
            "Finish after a few turns to get your score and mistakes.",
          ]} />
        }>
          <div className="grid gap-5 md:grid-cols-2">
            {SCENARIOS.map((sc) => (
              <button key={sc.id} type="button" onClick={() => start(sc.id)} disabled={busy}
                className={cn("group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-card bg-linear-to-br p-6 text-left shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-pop disabled:cursor-not-allowed disabled:opacity-70", sc.tone)}>
                <span aria-hidden className="absolute -top-10 -right-10 size-40 rounded-full border-[28px] border-white/15" />
                <span className="relative flex items-center justify-between gap-2">
                  <span className="grid size-12 place-items-center rounded-xl bg-white/15">
                    {busy && scenario === sc.id ? <LoaderCircle size={24} className="animate-spin" aria-hidden /> : <sc.icon size={24} aria-hidden />}
                  </span>
                </span>
                <span className="relative flex flex-col gap-1">
                  <strong className="text-2xl font-semibold tracking-[-0.02em]">{sc.title}</strong>
                  <span className="text-sm opacity-85">{sc.text}</span>
                </span>
                <span className="relative flex flex-wrap gap-1.5">
                  <Badge className="bg-white/15 text-inherit">{sc.level}</Badge>
                  <Badge className="bg-white/15 text-inherit"><Clock aria-hidden />About 5 min</Badge>
                  <Badge className="bg-white/15 text-inherit"><MessagesSquare aria-hidden />Up to 10 turns</Badge>
                </span>
                <span className="relative flex flex-col gap-1.5 border-t border-white/15 pt-3 text-sm">
                  <span className="text-xs font-semibold tracking-wide uppercase opacity-75">You&apos;ll practise</span>
                  {sc.practise.map((p) => <span key={p} className="flex items-center gap-2"><Check size={14} aria-hidden />{p}</span>)}
                </span>
                <span className="relative mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold">
                  {busy && scenario === sc.id ? "Starting…" : "Start talking"}<ChevronRight size={16} className="transition group-hover:translate-x-1" aria-hidden />
                </span>
              </button>
            ))}
          </div>

          <Card size="sm">
            <CardHeader><CardTitle>How it works</CardTitle></CardHeader>
            <CardContent>
              <ol className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: MessagesSquare, title: "Pick a situation", text: "Your AI partner starts the conversation." },
                  { icon: Mic, title: "Speak your reply", text: "Tap the mic, answer out loud, tap to send." },
                  { icon: Trophy, title: "Get your debrief", text: "A score, your mistakes and better phrases." },
                ].map(({ icon: I, title, text }, n) => (
                  <li key={title} className="flex gap-3 rounded-tile bg-raised p-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint text-on-mint"><I size={18} aria-hidden /></span>
                    <span className="flex flex-col gap-0.5 text-sm">
                      <strong className="font-semibold">{n + 1}. {title}</strong>
                      <span className="text-fg-2">{text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Link href="/interview" className="group flex items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-card transition hover:bg-hover">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mint text-on-mint"><FileUp size={20} aria-hidden /></span>
            <span className="flex min-w-0 flex-1 flex-col">
              <strong className="font-semibold">Preparing for a real interview?</strong>
              <span className="text-sm text-fg-2">Upload your resume and get questions about your own experience.</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-fg-2 transition group-hover:translate-x-1" aria-hidden />
          </Link>
          <p role="status" aria-live="polite" className="text-sm text-danger-fg empty:hidden">{busy ? "" : message}</p>
        </WithAside>
      </Page>
    );
  }

  return (
    <Page className="max-w-3xl">
      <PageHeader
        title={current?.title ?? "Conversation"}
        subtitle={eyebrow}
        actions={<Badge variant="secondary" className="h-8 px-3 text-sm">{turnsLeft} {turnsLeft === 1 ? "turn" : "turns"} left</Badge>}
      />

      <Card className="min-h-[50dvh]">
        <CardContent aria-live="polite" aria-label="Conversation" className="flex flex-col gap-4">
          {lines.map((l, i) => (
            <ChatBubble key={i} mine={l.mine} who="AI partner" onReplay={l.mine ? undefined : () => playAudio(l.audio, l.text)}>{l.text}</ChatBubble>
          ))}
          {busy && <TypingBubble who="AI partner" />}
          <div ref={endRef} />
        </CardContent>
      </Card>

      <div className="sticky bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] z-10 flex flex-col items-center gap-3 rounded-card bg-surface/90 p-4 shadow-pop ring-1 ring-line backdrop-blur-xl lg:bottom-4">
        <RecordButton
          recording={recorder.recording}
          busy={busy}
          disabled={turnsLeft === 0}
          maxSeconds={30}
          onStart={() => { setMessage(""); recorder.start(); }}
          onStop={recorder.stop}
          label={turnsLeft === 0 ? "No turns left" : "Tap to speak"}
          stopLabel="Tap to send"
          busyLabel="Thinking…"
        />
        <Button variant="secondary" size="sm" onClick={finish} disabled={busy || recorder.recording || lines.length < 2}>Finish &amp; get feedback <ArrowRight /></Button>
        <p role="status" aria-live="polite" className="text-sm text-danger-fg empty:hidden">{message}</p>
      </div>
    </Page>
  );
}

function InterviewReport({ feedback }: { feedback: InterviewFeedback }) {
  return (
    <Card aria-labelledby="interview-heading">
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-6">
          <ScoreRing score={feedback.readiness} size={110} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id="interview-heading" className="text-xl font-semibold">Interview readiness</h2>
            {feedback.verdict && <CardDescription>{feedback.verdict}</CardDescription>}
          </div>
        </div>
        {feedback.strengths.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Strengths</h3>
            <ul className="flex flex-col gap-2">
              {feedback.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--good)]"><Check size={16} className="mt-0.5 shrink-0" aria-hidden />{s}</li>
              ))}
            </ul>
          </div>
        )}
        {feedback.weaknesses.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Areas to work on</h3>
            <ul className="flex flex-col gap-3">
              {feedback.weaknesses.map((w, i) => (
                <li key={i} className="flex flex-col gap-1 rounded-tile bg-raised p-4 text-sm">
                  <strong>{w.area}</strong>
                  {w.detail && <span className="text-fg-2">{w.detail}</span>}
                  {w.improve && <span className="flex items-start gap-2 font-medium text-[var(--good)]"><Sparkles size={16} className="mt-0.5 shrink-0" aria-hidden />{w.improve}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
