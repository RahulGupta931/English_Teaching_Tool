import { AudioLines, BriefcaseBusiness, GraduationCap, LayoutGrid, Link2, ListChecks, MessagesSquare, Target, Timer, type LucideIcon } from "lucide-react";

// Data only (no components), so the shared UI primitives can read it without an import cycle.

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

/** What a page heading shows above its title: colour and section label, looked up from the URL. */
export type PageMark = { tone: "mint" | "coral" | "link"; label: string };
const OTHER_PAGES: Record<string, PageMark> = {
  "/practice": { tone: "mint", label: "Practice" },
  "/mistakes": { tone: "coral", label: "Review" },
  "/plans": { tone: "coral", label: "Account" },
  "/admin": { tone: "link", label: "Admin" },
};
export function pageMark(path: string): PageMark | undefined {
  const a = ACTIVITIES.find((x) => path === x.href || path.startsWith(x.href + "/"));
  if (a) return { tone: GROUP_TONE[a.group].icon, label: a.group === "Tests" ? "Test" : a.group === "Games" ? "Game" : "Speaking" };
  return OTHER_PAGES[Object.keys(OTHER_PAGES).find((k) => path === k || path.startsWith(k + "/")) ?? ""];
}
