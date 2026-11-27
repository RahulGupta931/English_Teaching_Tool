"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookX, Flame, Search, Sparkles, type LucideIcon } from "lucide-react";
import { ACTIVITIES, ActivityCard, GROUP_TONE, KIND_FOR_HREF, type Group } from "@/components/Activities";
import { EmptyState, IconTile, Page, PageHeader, Segmented } from "@/components/ui";
import { getMe, useRequireLogin } from "@/lib/api";

type Filter = "All" | Group;
const FILTERS: Filter[] = ["All", "Speaking", "Games", "Tests"];
const GROUPS: Group[] = ["Speaking", "Games", "Tests"];
const GROUP_TEXT: Record<Group, string> = {
  Speaking: "Hold a conversation out loud, with an AI partner or your coach.",
  Games: "Quick daily games for new words and clearer speech.",
  Tests: "Check what you know, and find your level.",
};

type Me = { user: { streak: number }; mistakes: { original: string }[]; best: Record<string, number> };

export default function Practice() {
  useRequireLogin();
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    getMe<Me>().then(setMe).catch(() => {});
  }, []);

  const q = query.trim().toLowerCase();
  const shown = ACTIVITIES.filter((a) => (filter === "All" || a.group === filter) && (!q || `${a.title} ${a.text}`.toLowerCase().includes(q)));
  const mistakeCount = me ? new Set(me.mistakes.map((m) => m.original.toLowerCase())).size : null;
  const metaFor = (href: string) => {
    const b = me?.best[KIND_FOR_HREF[href]];
    return b === undefined ? undefined : `Best score ${Math.round(b)}`;
  };

  return (
    <Page>
      <PageHeader title="Practice" subtitle="Speaking, games and tests, all in one place." />

      {/* Quick stats, so there's always something here even before you've picked a filter */}
      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatTile icon={Sparkles} tone="mint" label="Activities" value={ACTIVITIES.length} />
        <StatTile icon={Flame} tone="coral" label="Day streak" value={me ? `${me.user.streak} ${me.user.streak === 1 ? "day" : "days"}` : "–"} />
        <StatTile icon={BookX} tone="link" label="Mistakes to review" value={mistakeCount ?? "–"} href={mistakeCount ? "/mistakes" : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Show" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ value: f, label: f }))} />
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 text-fg-2 shadow-card focus-within:ring-2 focus-within:ring-[var(--ring)] sm:max-w-xs">
          <Search size={16} aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search practice" aria-label="Search practice"
            className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-3" />
        </label>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Search} title="Nothing matches" text={`No activity matches "${query}".`} />
      ) : (
        GROUPS.filter((g) => shown.some((a) => a.group === g)).map((g) => {
          const items = shown.filter((a) => a.group === g);
          const tone = GROUP_TONE[g];
          return (
            <section key={g} aria-labelledby={`group-${g}`} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <IconTile icon={items[0].icon} tone={tone.icon} size={36} />
                <div className="flex flex-col">
                  <h2 id={`group-${g}`} className="flex items-center gap-2 text-lg font-semibold tracking-[-0.01em]">
                    {g}<span className="text-sm font-normal text-fg-3">· {items.length}</span>
                  </h2>
                  <p className="text-sm text-fg-2">{GROUP_TEXT[g]}</p>
                </div>
              </div>
              <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                {items.map((a, i) => {
                  const isLast = i === items.length - 1;
                  const span = isLast && items.length > 3 && items.length % 3 === 1 ? "lg"
                    : isLast && items.length > 2 && items.length % 2 === 1 ? "sm"
                    : undefined;
                  return <ActivityCard key={a.href} a={a} meta={metaFor(a.href)} span={span} />;
                })}
              </div>
            </section>
          );
        })
      )}
    </Page>
  );
}

function StatTile({ icon: I, tone, label, value, href }: { icon: LucideIcon; tone: "mint" | "coral" | "link"; label: string; value: React.ReactNode; href?: string }) {
  const cls = {
    mint: "bg-mint/15 text-accent-fg",
    coral: "bg-coral/15 text-coral",
    link: "bg-link/15 text-link",
  }[tone];
  const inner = (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card transition sm:p-5">
      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${cls}`}><I size={20} aria-hidden /></span>
      <div className="flex flex-col">
        <span className="text-xs font-medium text-fg-2">{label}</span>
        <span className="text-xl font-semibold tracking-[-0.02em] tabular-nums">{value}</span>
      </div>
    </div>
  );
  if (!href) return inner;
  return <Link href={href} className="block transition-transform hover:-translate-y-0.5">{inner}</Link>;
}
