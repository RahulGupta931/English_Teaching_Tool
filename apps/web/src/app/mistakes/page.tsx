"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Sparkles } from "lucide-react";
import { MistakeList } from "@/components/Results";
import { ButtonLink, EmptyState, Page, PageHeader, Segmented } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorText, getMe, useRequireLogin, type Mistake } from "@/lib/api";

const TYPES = [
  { value: "all", label: "All" },
  { value: "grammar", label: "Grammar" },
  { value: "vocabulary", label: "Vocabulary" },
  { value: "phrasing", label: "Phrasing" },
] as const;
type Type = (typeof TYPES)[number]["value"];

/** Every saved mistake once, newest first, with a filter by type: the web twin of the mobile Mistakes screen. */
export default function Mistakes() {
  useRequireLogin();
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null);
  const [type, setType] = useState<Type>("all");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getMe<{ mistakes: Mistake[] }>().then((r) => setMistakes(r.mistakes)).catch((e) => setMessage(errorText(e)));
  }, []);

  if (!mistakes) {
    return (
      <Page className="max-w-3xl">
        {message ? <p role="alert" className="text-sm text-danger-fg">{message}</p> : <p role="status" className="sr-only">Loading…</p>}
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 rounded-card" />
      </Page>
    );
  }

  // The same sentence can be saved more than once; show it once.
  const seen = new Set<string>();
  const all = mistakes.filter((m) => {
    const k = m.original.toLowerCase();
    return seen.has(k) ? false : (seen.add(k), true);
  });
  const count = (t: Type) => (t === "all" ? all.length : all.filter((m) => m.type === t).length);
  const shown = type === "all" ? all : all.filter((m) => m.type === type);

  return (
    <Page className="max-w-3xl">
      <PageHeader
        title="Mistakes to review"
        subtitle={`${all.length} saved from your practice. Read each one, then fix them out loud with your coach.`}
        actions={all.length > 0 && <ButtonLink href="/coach" icon={GraduationCap}>Fix with Mistake Coach</ButtonLink>}
      />
      {all.length === 0 ? (
        <EmptyState icon={Sparkles} title="No mistakes yet" text="Do a role-play, JAM or quiz. Anything you get wrong shows up here to review." />
      ) : (
        <>
          <Segmented label="Filter by type" value={type} onChange={setType}
            options={TYPES.filter((t) => count(t.value) > 0).map((t) => ({ value: t.value, label: `${t.label} ${count(t.value)}` }))} />
          <Card>
            <CardContent><MistakeList mistakes={shown} /></CardContent>
          </Card>
        </>
      )}
    </Page>
  );
}
