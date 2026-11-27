"use client"; // the drifting gradient background uses framer-motion

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { AudioLines, ChevronRight, GraduationCap, LayoutGrid, Link2, ListChecks, MessagesSquare, Sparkles, Target, Timer, Zap, type LucideIcon } from "lucide-react";
import { IconTile, cardClass, cn } from "@/components/ui";

export { ACTIVITIES, GROUP_TONE, type Activity, type Group } from "@/lib/activities";
import { GROUP_TONE, type Activity } from "@/lib/activities";

export function ActivityCard({ a, meta, span }: { a: Activity; meta?: string; span?: "sm" | "lg" }) {
  const tone = GROUP_TONE[a.group];
  const reduceMotion = useReducedMotion();
  return (
    <Link href={a.href} className={cn(
      cardClass("default", true),
      "group relative gap-3 overflow-hidden ring-1 ring-transparent transition-shadow",
      tone.ring,
      // A lone card left over at the end of a row spans the full row, instead of leaving most of it empty.
      span === "sm" && "sm:col-span-2 lg:col-span-1",
      span === "lg" && "lg:col-span-3",
    )}>
      {/* Slow drifting colour blob behind the content: paused for anyone who prefers reduced motion */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full opacity-[0.14] blur-2xl transition-opacity duration-300 group-hover:opacity-25"
        style={{ background: tone.blob }}
        animate={reduceMotion ? undefined : { x: [0, -14, 6, 0], y: [0, 10, -8, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative flex items-start justify-between">
        <IconTile icon={a.icon} tone={tone.icon} size={44} />
        <span className="grid size-9 place-items-center rounded-full bg-raised text-fg-2 transition group-hover:bg-mint group-hover:text-on-mint">
          <ChevronRight size={18} aria-hidden />
        </span>
      </div>
      <span className="relative text-base font-semibold">{a.title}</span>
      <span className="relative text-sm text-fg-2">{a.text}</span>
      {meta && <span className="relative mt-auto text-xs font-semibold text-fg-3">{meta}</span>}
    </Link>
  );
}

/** Activity kinds the API records (db.award): display name, short name, icon and page. */
export const KINDS: Record<string, { label: string; short: string; icon: LucideIcon; href?: string }> = {
  placement: { label: "Placement test", short: "Placement", icon: Target, href: "/placement" },
  roleplay: { label: "Role-play", short: "Role-play", icon: MessagesSquare, href: "/roleplay" },
  coach: { label: "Mistake Coach", short: "Coach", icon: GraduationCap, href: "/coach" },
  jam: { label: "JAM", short: "JAM", icon: Timer, href: "/jam" },
  daily_word: { label: "Daily Word", short: "Word", icon: LayoutGrid, href: "/daily-word" },
  daily_word_bonus: { label: "Daily Word bonus", short: "Bonus", icon: Sparkles },
  word_chain: { label: "Word Chain", short: "Chain", icon: Link2, href: "/word-chain" },
  tongue_twister: { label: "Tongue Twister", short: "Twister", icon: AudioLines, href: "/tongue-twister" },
  quiz: { label: "MCQ Quiz", short: "Quiz", icon: ListChecks, href: "/quiz" },
};
export const kind = (k: string) => KINDS[k] ?? { label: k, short: k, icon: Zap };

/** Kind the API records for an activity's href, where one exists ("roleplay" covers both /roleplay and /interview). */
export const KIND_FOR_HREF: Record<string, string> = Object.fromEntries(
  Object.entries(KINDS).filter(([, v]) => v.href).map(([k, v]) => [v.href as string, k]),
);
