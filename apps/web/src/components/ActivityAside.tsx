"use client";

import { useEffect, useState } from "react";
import { History, Lightbulb, Mic, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getMe } from "@/lib/api";

type Me = {
  activities: { kind: string; score: number | null; created_at: string }[];
  best: Record<string, number>;
  speaking_seconds_today: number;
  speaking_limit_seconds: number;
};

// The API stores activity times in UTC as "YYYY-MM-DD HH:MM:SS".
const when = (utc: string) => new Date(utc.replace(" ", "T") + "Z");
function ago(utc: string) {
  const min = Math.round((Date.now() - when(utc).getTime()) / 60000);
  if (min < 60) return min < 1 ? "just now" : `${min} min ago`;
  if (min < 24 * 60) return `${Math.round(min / 60)} h ago`;
  return when(utc).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Side column for an activity's start screen: your stats for it, speaking time left today, and tips.
 * Fills the space beside the main card on wide screens; stacks below it on phones.
 */
export function ActivityAside({ kind, tips, speaking = true, stats = true, top, bottom }: { kind: string; tips: string[]; speaking?: boolean; stats?: boolean; top?: React.ReactNode; bottom?: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    getMe<Me>().then(setMe).catch(() => {});
  }, []);

  const mine = me?.activities.filter((a) => a.kind === kind) ?? [];
  const best = me?.best[kind];
  const minutesLeft = me ? Math.round(Math.max(0, me.speaking_limit_seconds - me.speaking_seconds_today) / 60) : 0;
  const limit = me ? Math.round(me.speaking_limit_seconds / 60) : 0;

  return (
    // Sticky on wide screens, so the side column stays in view instead of ending early as you scroll.
    <aside className="flex flex-col gap-5 lg:sticky lg:top-6" aria-label="Your stats and tips">
      {top}
      {stats && <Card size="sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="size-4 text-accent-fg" aria-hidden />Your stats</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!me ? (
            <Skeleton className="h-16 rounded-tile" />
          ) : best === undefined ? (
            <p className="text-sm text-fg-2">No score yet. Your first try sets your best.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-fg-2">Best score</span>
                <span className="text-2xl font-semibold tabular-nums">{Math.round(best)}<span className="text-sm font-normal text-fg-3"> / 100</span></span>
              </div>
              <Progress value={best} aria-label="Best score" />
            </div>
          )}
          {me && (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-tile bg-raised p-3">
                <dt className="text-xs text-fg-2">Sessions</dt>
                <dd className="text-lg font-semibold tabular-nums">{mine.length}</dd>
              </div>
              <div className="rounded-tile bg-raised p-3">
                <dt className="flex items-center gap-1 text-xs text-fg-2"><History className="size-3" aria-hidden />Last played</dt>
                <dd className="truncate font-semibold">{mine[0] ? ago(mine[0].created_at) : "Never"}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>}

      {speaking && me && (
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2"><Mic className="size-4 text-accent-fg" aria-hidden />Speaking today</CardTitle>
              <Badge variant={minutesLeft > 0 ? "secondary" : "destructive"}>{minutesLeft} of {limit} min left</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={limit ? (minutesLeft / limit) * 100 : 0} aria-label="Speaking time left today" />
          </CardContent>
        </Card>
      )}

      <Card size="sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="size-4 text-coral" aria-hidden />Tips</CardTitle></CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2.5 text-sm text-fg-2">
            {tips.map((t) => (
              <li key={t} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-mint-hover" />{t}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {bottom}
    </aside>
  );
}

/** Two columns on wide screens: the activity on the left, ActivityAside on the right. */
export function WithAside({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
      {aside}
    </div>
  );
}
