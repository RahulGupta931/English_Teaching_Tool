import { AudioLines, BookX, BriefcaseBusiness, Dumbbell, GraduationCap, House, LayoutGrid, Link2, ListChecks, MessagesSquare, Sparkles, Target, Timer, User, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; hint: string; icon: LucideIcon; rail: boolean; bar: boolean };

/** Every page, in one list: the rail, the bottom bar and the command palette read from it.
 * Main sections match the mobile tabs (Home, Practice, Me); the rest are reached from Practice or the palette. */
export const NAV: NavItem[] = [
  { href: "/", label: "Home", hint: "Your progress and today's plan", icon: House, rail: true, bar: true },
  { href: "/practice", label: "Practice", hint: "Every activity, game and test", icon: Dumbbell, rail: true, bar: true },
  { href: "/roleplay", label: "Role-play", hint: "Talk with an AI partner", icon: MessagesSquare, rail: true, bar: true },
  { href: "/coach", label: "Mistake Coach", hint: "Talk through your recent mistakes", icon: GraduationCap, rail: true, bar: false },
  { href: "/interview", label: "Interview", hint: "Practise from your resume", icon: BriefcaseBusiness, rail: true, bar: false },
  { href: "/jam", label: "JAM", hint: "Speak for one minute", icon: Timer, rail: true, bar: false },
  { href: "/daily-word", label: "Daily Word", hint: "Today's five-letter word", icon: LayoutGrid, rail: true, bar: false },
  { href: "/word-chain", label: "Word Chain", hint: "Last letter, next word", icon: Link2, rail: false, bar: false },
  { href: "/tongue-twister", label: "Tongue Twister", hint: "Say it clearly and quickly", icon: AudioLines, rail: false, bar: false },
  { href: "/quiz", label: "MCQ Quiz", hint: "Grammar and vocabulary", icon: ListChecks, rail: false, bar: false },
  { href: "/placement", label: "Placement Test", hint: "Find your level", icon: Target, rail: false, bar: false },
  { href: "/mistakes", label: "Mistakes", hint: "Review everything you got wrong", icon: BookX, rail: false, bar: false },
  { href: "/plans", label: "Plans", hint: "Upgrade and speaking time", icon: Sparkles, rail: false, bar: false },
  { href: "/me", label: "Me", hint: "Profile, plan and settings", icon: User, rail: true, bar: true },
];

export const OPEN_PALETTE = "open-palette";
export const openPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE));
