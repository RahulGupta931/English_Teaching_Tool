"use client";

import { ActivityAside, WithAside } from "@/components/ActivityAside";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ListChecks, LoaderCircle, RotateCcw, X } from "lucide-react";
import { ScoreRing, XpBadge } from "@/components/Results";
import { Page, PageHeader, cn } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { errorText, postJson, useRequireLogin, type Mistake } from "@/lib/api";

type Question = { source: "grammar" | "vocabulary"; question: string; options: string[] };
type Quiz = { id: number; questions: Question[] };
type Result = {
  correct: number;
  total: number;
  score: number;
  xp: number;
  results: { chosen: number | null; answer: number; correct: boolean; explanation: string }[];
  mistakes: Mistake[];
};

export default function QuizPage() {
  useRequireLogin();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function start() {
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const q = await postJson<Quiz>("/v1/quiz", {});
      setQuiz(q);
      setAnswers(q.questions.map(() => null));
      setCurrent(0);
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!quiz) return;
    setBusy(true);
    try {
      setResult(await postJson<Result>(`/v1/quiz/${quiz.id}`, { answers }));
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const choose = (i: number) => setAnswers((a) => a.map((v, j) => (j === current ? i : v)));
  const q = quiz?.questions[current];
  const last = quiz ? current === quiz.questions.length - 1 : false;

  return (
    <Page>
      <PageHeader title="Grammar and vocabulary" subtitle="Ten questions picked for your level. New questions every time." />
      <WithAside aside={<ActivityAside kind="quiz" speaking={false} tips={["Read every option before you choose.", "You can go back before you submit.", "Wrong answers are saved to Mistakes to review.", "New questions every time, picked for your level."]} />}>

      {!quiz && (
        <Card>
          <CardHeader>
            <div className="mb-2 grid size-12 place-items-center rounded-xl bg-mint text-on-mint"><ListChecks size={24} aria-hidden /></div>
            <CardTitle>Ten quick questions</CardTitle>
            <CardDescription>About 5 minutes, no timer. You can go back before you submit, and wrong answers are saved to your mistakes.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button size="lg" onClick={start} disabled={busy}>
              {busy ? <><LoaderCircle className="animate-spin" />Preparing questions…</> : <>Start quiz <ArrowRight /></>}
            </Button>
          </CardFooter>
        </Card>
      )}

      {quiz && q && !result && (
        <Card aria-labelledby="question">
          <CardHeader className="gap-3">
            <div className="flex items-center justify-between text-sm text-fg-2">
              <span>Question {current + 1} of {quiz.questions.length}</span>
              <Badge variant="secondary" className="capitalize">{q.source}</Badge>
            </div>
            <Progress value={((current + 1) / quiz.questions.length) * 100} aria-label="Quiz progress" />
            <h2 id="question" className="pt-2 text-xl leading-snug font-semibold tracking-[-0.01em] sm:text-2xl">{q.question}</h2>
          </CardHeader>
          <CardContent>
            <div role="radiogroup" aria-labelledby="question" className="flex flex-col gap-2.5">
              {q.options.map((option, i) => {
                const on = answers[current] === i;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => choose(i)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-tile border-2 px-4 py-3 text-left text-[0.9375rem] transition duration-150",
                      on ? "border-mint-hover bg-mint/15 font-medium" : "border-line bg-surface hover:border-fg/20 hover:bg-hover",
                    )}
                  >
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold", on ? "bg-mint text-on-mint" : "bg-raised text-fg-2")}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <Button variant="ghost" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0}><ArrowLeft />Back</Button>
            {last ? (
              <Button onClick={submit} disabled={busy || answers.some((a) => a === null)}>
                {busy ? <LoaderCircle className="animate-spin" /> : "Submit answers"}
              </Button>
            ) : (
              <Button onClick={() => setCurrent((c) => c + 1)} disabled={answers[current] === null}>Next <ArrowRight /></Button>
            )}
          </CardFooter>
        </Card>
      )}

      {quiz && result && (
        <section aria-label="Your quiz result" className="flex flex-col gap-5">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-6">
              <ScoreRing score={result.score} size={120} />
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold tracking-[-0.02em]">{result.correct} of {result.total} correct</h2>
                {result.mistakes.length > 0 && (
                  <p className="flex items-center gap-2 text-sm text-fg-2"><BookOpen size={16} aria-hidden />Wrong answers were added to your mistakes to review.</p>
                )}
                <div><XpBadge xp={result.xp} /></div>
              </div>
            </CardContent>
          </Card>

          <ol className="flex flex-col gap-3">
            {quiz.questions.map((question, i) => {
              const r = result.results[i];
              return (
                <li key={i}>
                  <Card size="sm">
                    <CardContent className="flex flex-col gap-2">
                      <p className="flex items-start gap-2 font-medium">
                        <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", r.correct ? "bg-mint/30 text-[var(--good)]" : "bg-danger/15 text-[var(--bad)]")}>
                          {r.correct ? <Check size={14} aria-label="Correct" /> : <X size={14} aria-label="Wrong" />}
                        </span>
                        {i + 1}. {question.question}
                      </p>
                      <p className="pl-8 text-sm font-semibold text-[var(--good)]">{question.options[r.answer]}</p>
                      {!r.correct && r.chosen !== null && <p className="pl-8 text-sm text-[var(--bad)] line-through">{question.options[r.chosen]}</p>}
                      {!r.correct && r.explanation && <p className="pl-8 text-sm text-fg-2">{r.explanation}</p>}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-wrap gap-3">
            <Button onClick={start} disabled={busy}><RotateCcw />New quiz</Button>
            <Link href="/" className={buttonVariants({ variant: "secondary" })}>Home</Link>
          </div>
        </section>
      )}
      <p role="alert" className="min-h-5 text-sm text-danger-fg">{message}</p>
      </WithAside>
    </Page>
  );
}
