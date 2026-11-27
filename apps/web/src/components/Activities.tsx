"use client"; // the drifting gradient background uses framer-motion

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { AudioLines, BriefcaseBusiness, ChevronRight, GraduationCap, LayoutGrid, Link2, ListChecks, MessagesSquare, Sparkles, Target, Timer, Zap, type LucideIcon } from "lucide-react";
import { IconTile, cardClass, cn } from "@/components/ui";

export type Group = "Speaking" | "Games" | "Tests";
export type Activity = { href: string; title: string; text: string; icon: LucideIcon; group: Group };

/** Every practice activity, grouped like the mobile Practice tab. */
export const ACTIVITIES: Activity[] = [
  { href: "/roleplay", title: "AI Role-Play", text: "Practise a job interview or an everyday conversation.", icon: MessagesSquare, group: "Speaking" },
  { href: "/coach", title: "Mistake Coach", text: "Talk hands-free about your recent mistakes, in English or Hinglish.", icon: GraduationCap, group: "Speaking" },
  { href: "/interview", title: "Interview Preparation", text: "Upload your resume and answer questions about your own experience.", icon: BriefcaseBusiness, group: "Speaking" },
  { href: "/jam", title: "JAM: Just a Minute", text: "Speak for 60 seconds on today's topic.", icon: Timer, group: "Speaking" },
  { href: "/daily-word", title: "Daily Word", text: "Guess today's five-letter word in six tries.", icon: LayoutGrid, group: "Games" },
  { href: "/word-chain", title: "Word Chain", text: "Say a word that starts with the last letter of the AI's word.", icon: Link2, group: "Games" },
  { href: "/tongue-twister", title: "Tongue Twister", text: "Listen once, then say it clearly and quickly.", icon: AudioLines, group: "Games" },
  { href: "/quiz", title: "MCQ Quiz", text: "Ten quick grammar and vocabulary questions.", icon: ListChecks, group: "Tests" },
  { href: "/placement", title: "Placement Test", text: "Find your level: answer three questions out loud.", icon: Target, group: "Tests" },
];

/** One colour per group, so Practice reads as three families of cards rather than one flat list. */
export const GROUP_TONE: Record<Group, { icon: "mint" | "coral" | "link"; blob: string; ring: string }> = {
  Speaking: { icon: "mint", blob: "var(--mint)", ring: "hover:ring-mint/40" },
  Games: { icon: "coral", blob: "var(--coral)", ring: "hover:ring-coral/40" },
  Tests: { icon: "link", blob: "var(--link)", ring: "hover:ring-link/40" },
};

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
