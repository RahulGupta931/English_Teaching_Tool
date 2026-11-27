"use client";

import { ActivityAside, WithAside } from "@/components/ActivityAside";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, CircleCheck, LoaderCircle, RotateCcw } from "lucide-react";
import { RecordButton } from "@/components/RecordButton";
import { ScoreGrid, ScoreRing, XpBadge } from "@/components/Results";
import { Page, PageHeader, cn } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorText, useRequireLogin } from "@/lib/api";
import { useRecorder } from "@/lib/useRecorder";

type Content = { questions: string[]; max_seconds: number };
type Result = {
  level: string;
  score: number;
  scores: Record<string, number>;
  transcripts: string[];
  feedback: string;
  xp: number;
};

export default function Placement() {
  useRequireLogin();
  const [content, setContent] = useState<Content | null>(null);
  const [recordings, setRecordings] = useState<Blob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const step = recordings.length; // 0-2: questions, 3: done
  const total = content?.questions.length ?? 3;
  const maxSeconds = content?.max_seconds ?? 45;
  const recorder = useRecorder(maxSeconds, (wav) => setRecordings((r) => [...r, wav]), setMessage);

  useEffect(() => {
    api<Content>("/v1/placement").then(setContent).catch((e) => setMessage(errorText(e)));
  }, []);

  async function submit() {
    setSubmitting(true);
    setMessage("");
    const form = new FormData();
    recordings.forEach((wav, i) => form.append(`answer_${i}`, wav, "answer.wav"));
    try {
      setResult(await api<Result>("/v1/placement", { method: "POST", body: form }));
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!content) {
    return (
      <Page className="max-w-3xl">
        {message ? <p role="alert" className="text-sm text-danger-fg">{message}</p> : <p role="status" className="sr-only">Loading…</p>}
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-40 rounded-card" />
      </Page>
    );
  }

  if (result) {
    return (
      <Page className="max-w-3xl">
        <PageHeader title="Your level" subtitle="Based on your three spoken answers." />
        <Card aria-label="Your placement result">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-6">
              <ScoreRing score={result.score} size={120} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Badge className="h-9 bg-linear-to-br from-hero to-hero-2 px-4 text-base text-mint capitalize">{result.level}</Badge>
                <p className="text-sm text-fg-2">{result.feedback}</p>
                <div><XpBadge xp={result.xp} /></div>
              </div>
            </div>
            <ScoreGrid scores={result.scores} />
          </CardContent>
        </Card>

        <Card aria-labelledby="answers-heading">
          <CardHeader><CardTitle id="answers-heading">What we heard</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {content.questions.map((q, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <strong className="text-sm">{q}</strong>
                <p className="rounded-tile bg-raised px-4 py-3 text-sm text-fg-2">“{result.transcripts[i]}”</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-3">
          <Link href="/roleplay" className={buttonVariants()}>Practise a conversation <ArrowRight /></Link>
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>Back to home</Link>
        </div>
      </Page>
    );
  }

  const prompt = step < total ? content.questions[step] : null;

  return (
    <Page>
      <PageHeader
        title={prompt ? "Answer this question" : "All done!"}
        subtitle={prompt ? `Answer out loud in a few sentences. You have up to ${maxSeconds} seconds.` : "Submit your answers to see your level."}
      />
      <WithAside aside={<ActivityAside kind="placement" tips={["Answer in a few full sentences, not one word.", "Speak naturally: it is fine to pause and think.", "There are no wrong answers: we only measure your English.", "You can redo the last answer before you submit."]} />}>

      <ol aria-label={`Step ${Math.min(step + 1, total)} of ${total}`} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {content.questions.map((_, i) => (
          <li key={i} aria-current={i === step ? "step" : undefined} className="flex flex-col gap-2">
            <span className={cn("h-1.5 rounded-full transition-colors", i < step ? "bg-mint-hover" : i === step ? "bg-hero" : "bg-track/60")} />
            <span className={cn("flex items-center gap-1 text-xs font-semibold", i <= step ? "text-fg" : "text-fg-3")}>
              {i < step && <Check size={14} aria-hidden />}Question {i + 1}
            </span>
          </li>
        ))}
      </ol>

      {prompt ? (
        <>
          <Card className="bg-linear-to-br from-hero to-hero-2 text-on-dark">
            <CardContent className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wider text-mint uppercase">Question {step + 1} of {total}</span>
              <p className="text-2xl leading-snug font-semibold tracking-[-0.01em]">{prompt}</p>
            </CardContent>
          </Card>
          <RecordButton
            recording={recorder.recording}
            maxSeconds={maxSeconds}
            onStart={() => { setMessage(""); recorder.start(); }}
            onStop={recorder.stop}
            label="Tap and answer"
          />
        </>
      ) : (
        <Card className="items-center text-center">
          <CardContent className="flex flex-col items-center gap-4">
            <CircleCheck size={44} className="text-[var(--good)]" aria-hidden />
            <p className="text-base font-medium">You answered all {total} questions.</p>
            <Button size="lg" onClick={submit} disabled={submitting}>
              {submitting ? <><LoaderCircle className="animate-spin" />Checking… (about 10 seconds)</> : <>See my level <ArrowRight /></>}
            </Button>
          </CardContent>
        </Card>
      )}

      {step > 0 && !recorder.recording && !submitting && (
        <Button variant="ghost" onClick={() => setRecordings((r) => r.slice(0, -1))} className="self-center"><RotateCcw />Redo last step</Button>
      )}
      <p role="status" aria-live="polite" className="min-h-5 text-center text-sm text-fg-2">
        {recorder.recording ? "Recording… tap stop when you finish." : message}
      </p>
      </WithAside>
    </Page>
  );
}
