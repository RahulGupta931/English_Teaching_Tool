import type { ReactNode } from "react";
import { Check, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/components/ui";
import type { Mistake } from "@/lib/api";

/** Text colour for a score band; pass to a ring or number. */
export const scoreClass = (score: number | null | undefined) =>
  score == null ? "text-fg-2" : score >= 80 ? "text-[var(--good)]" : score >= 60 ? "text-[var(--ok)]" : "text-[var(--bad)]";
export const scoreWord = (score: number | null | undefined) =>
  score == null ? "" : score >= 80 ? "Great" : score >= 60 ? "Good" : "Keep practising";
export const fmt = (score: number | null | undefined) => (score == null ? "–" : Math.round(score));

/** Circular progress ring; the filled arc takes the parent's text colour. */
export function Ring({ value, size = 140, stroke = 12, className, children }: { value: number; size?: number; stroke?: number; className?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true" className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-track/60" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" stroke="currentColor"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-700 ease-out" />
      </svg>
      <div className="relative flex flex-col items-center text-fg">{children}</div>
    </div>
  );
}

/** Big score out of 100 with a word label, so meaning never relies on colour alone. */
export function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  return (
    <Ring value={score} size={size} className={scoreClass(score)}>
      <span role="img" aria-label={`Score ${Math.round(score)} out of 100, ${scoreWord(score)}`} className="font-semibold tracking-[-0.03em] tabular-nums" style={{ fontSize: size * 0.28 }}>
        {Math.round(score)}
      </span>
      <span className="text-xs font-medium text-fg-2" aria-hidden="true">{scoreWord(score)}</span>
    </Ring>
  );
}

export function XpBadge({ xp }: { xp: number }) {
  return <Badge className="h-7 bg-peach px-3 text-on-mint"><Zap aria-hidden />+{xp} XP</Badge>;
}

/** One row per score with a bar; names come from the API ("filler_words" → "filler words"). */
export function ScoreGrid({ scores }: { scores: Record<string, number | null> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {Object.entries(scores).map(([name, value]) => (
        <div key={name} className="flex flex-col gap-2 rounded-tile bg-raised p-4">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-sm font-medium capitalize text-fg-2">{name.replaceAll("_", " ")}</dt>
            <dd className="flex items-baseline gap-2">
              <strong className={cn("text-2xl font-semibold tabular-nums", scoreClass(value))}>{fmt(value)}</strong>
              <span className="text-xs text-fg-3">{scoreWord(value)}</span>
            </dd>
          </div>
          <Progress value={value ?? 0} aria-label={`${name.replaceAll("_", " ")} score`} />
        </div>
      ))}
    </dl>
  );
}

export function MistakeList({ mistakes }: { mistakes: Mistake[] }) {
  if (mistakes.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-tile bg-raised px-4 py-3 text-sm font-medium text-[var(--good)]">
        <Check size={18} aria-hidden />No mistakes found. Well done!
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {mistakes.map((m, i) => (
        <li key={i} className="flex flex-col gap-1.5 rounded-tile bg-raised p-4">
          <span className="flex items-start gap-2 text-sm text-[var(--bad)]">
            <X size={16} className="mt-0.5 shrink-0" aria-label="You said" /><span className="line-through decoration-1">{m.original}</span>
          </span>
          <span className="flex items-start gap-2 text-sm text-[var(--good)]">
            <Check size={16} className="mt-0.5 shrink-0" aria-label="Correct" /><strong className="font-semibold">{m.correction}</strong>
          </span>
          {m.explanation && <span className="pl-6 text-sm text-fg-2">{m.explanation}</span>}
        </li>
      ))}
    </ul>
  );
}
