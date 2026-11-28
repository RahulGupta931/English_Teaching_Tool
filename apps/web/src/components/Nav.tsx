"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, LogOut, Mic, Moon, Search, Settings, Sun, Zap, type LucideIcon } from "lucide-react";
import { getMe, signOut, useToken, type User } from "@/lib/api";
import { toggleTheme, useTheme } from "@/lib/theme";
import { cn, Pill, Tooltip } from "@/components/ui";
import { NAV, openPalette } from "./navItems";

// Short numbers so they fit beside an icon in the 56px rail: 1250 -> "1.3k".
const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
const spring = { type: "spring", stiffness: 500, damping: 40 } as const;

/** Desktop sidebar (1024px and up), phone header (Settings gear top right) and docked bottom bar, and the XP/streak pills. */
export function Nav() {
  const token = useToken();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  // Refresh XP and streak after each page change (activities award XP).
  useEffect(() => {
    if (!token) return;
    let live = true;
    getMe<{ user: User }>().then((r) => live && setUser(r.user)).catch(() => {});
    return () => { live = false; };
  }, [token, pathname]);

  const shownUser = token ? user : null;
  const skip = <a href="#main" className="absolute -top-16 left-3 z-[100] rounded-full bg-mint px-4 py-2 font-semibold text-on-mint focus:top-3">Skip to content</a>;

  // Signed out: a regular top navigation bar. Still checking: nothing, to avoid a flash.
  if (token === null) return <>{skip}<TopNav /></>;
  if (token === undefined) return skip;

  return (
    <>
      {skip}
      <Sidebar pathname={pathname} user={shownUser} />

      {/* Phone / tablet: sticky header with brand, XP and streak, theme */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-surface/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/" aria-label="English Coach home" className="flex items-center gap-2.5">
          <Brand />
          <span className="font-semibold tracking-[-0.01em]">English Coach</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {shownUser && <Stats user={shownUser} />}
          <ThemeButton className="size-9 text-fg-2 hover:bg-hover hover:text-fg" />
          <Link href="/settings" aria-label="Settings" className="grid size-9 place-items-center rounded-full text-fg-2 transition hover:bg-hover hover:text-fg active:scale-[0.97]">
            <Settings size={18} aria-hidden />
          </Link>
        </div>
      </header>

      {token && <BottomBar pathname={pathname} />}
    </>
  );
}

const TOP_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#feedback", label: "Feedback" },
  { href: "/#games", label: "Games" },
  { href: "/#how", label: "How it works" },
];

/** Signed-out navigation: sticky glass bar across the top. */
function TopNav() {
  return (
    <header className="sticky top-3 z-40 px-3 pt-3 sm:px-6">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 rounded-full border border-line bg-surface/80 pr-2 pl-3 shadow-card backdrop-blur-xl sm:pl-4">
        <Link href="/" aria-label="English Coach home" className="group flex items-center gap-2.5 font-semibold tracking-[-0.01em]">
          <span className="grid size-10 place-items-center rounded-full bg-linear-to-br from-hero to-hero-2 text-mint transition duration-300 group-hover:scale-110 group-hover:-rotate-12">
            <Mic size={20} aria-hidden />
          </span>
          <span className="hidden sm:inline">English Coach</span>
        </Link>
        <nav aria-label="Main" className="mx-auto hidden items-center gap-1 md:flex">
          {TOP_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="group relative rounded-full px-4 py-2 text-sm font-medium text-fg-2 transition-colors hover:text-fg">
              {l.label}
              <span aria-hidden className="absolute inset-x-4 bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-mint-hover transition-transform duration-300 ease-out group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeButton className="size-10 bg-raised text-fg-2 hover:text-fg" />
          <Link href="/#signin" className="hidden h-10 items-center rounded-full px-4 text-sm font-semibold text-fg transition-colors hover:bg-raised sm:inline-flex">Sign in</Link>
          <Link href="/#signin" className="inline-flex h-11 items-center gap-2 rounded-full bg-mint px-5 text-sm font-semibold text-on-mint transition hover:-translate-y-px hover:bg-mint-hover active:scale-[0.97]">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Stats({ user }: { user: User }) {
  return (
    <div className="flex gap-2">
      <span aria-label={`${user.xp} XP`}><Pill tone="neutral" icon={Zap} className="bg-surface shadow-card">{user.xp}</Pill></span>
      <span aria-label={`${user.streak} day streak`}><Pill tone="coral" icon={Flame}>{user.streak}</Pill></span>
    </div>
  );
}

function ThemeButton({ className }: { className?: string }) {
  const theme = useTheme();
  const Icon = theme === "night" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "night" ? "Switch to day mode" : "Switch to night mode"}
      className={cn("grid cursor-pointer place-items-center rounded-full transition active:scale-[0.97]", className)}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}

/** Logo mark: the green mic circle used across the app. */
const Brand = () => (
  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-hero to-hero-2 text-mint shadow-card">
    <Mic size={18} strokeWidth={2.4} aria-hidden />
  </span>
);

/** One sidebar link: icon + label. Below 1280px only the icon shows, with a tooltip. */
function SideLink({ icon: I, label, href, active, onClick }: { icon: LucideIcon; label: string; href?: string; active?: boolean; onClick?: () => void }) {
  const cls = cn(
    "group relative flex h-10 w-full cursor-pointer items-center justify-center gap-3 rounded-xl px-0 text-sm font-medium transition-colors duration-150 xl:justify-start xl:px-3",
    active ? "text-fg" : "text-fg-2 hover:bg-hover hover:text-fg",
  );
  const inner = (
    <>
      {active && <motion.span layoutId="side-active" transition={spring} className="absolute inset-0 rounded-xl bg-mint/15 ring-1 ring-mint/30" />}
      {active && <span aria-hidden className="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-mint-hover" />}
      <I size={18} aria-hidden className={cn("relative shrink-0", active && "text-accent-fg")} />
      <span className="relative hidden truncate xl:inline">{label}</span>
    </>
  );
  return (
    <Tooltip label={label} className="xl:hidden">
      {href
        ? <Link href={href} aria-label={label} aria-current={active ? "page" : undefined} className={cls}>{inner}</Link>
        : <button type="button" aria-label={label} onClick={onClick} className={cls}>{inner}</button>}
    </Tooltip>
  );
}

/** Desktop sidebar: brand, search, grouped links, streak and XP, and the account row. */
function Sidebar({ pathname, user }: { pathname: string; user: User | null }) {
  const theme = useTheme();
  const learn = NAV.filter((n) => n.rail && n.href !== "/me");
  const account = ["/me", "/plans", "/settings"].map((h) => NAV.find((n) => n.href === h)!);
  return (
    <aside className="sticky top-6 z-30 hidden min-h-[calc(100dvh-80px)] w-[72px] shrink-0 flex-col gap-5 rounded-rail border border-line bg-surface p-3 shadow-card lg:flex xl:w-60">
      <Link href="/" aria-label="English Coach home" className="flex items-center justify-center gap-2.5 xl:justify-start xl:px-1">
        <Brand />
        <span className="hidden flex-col leading-tight xl:flex">
          <span className="text-sm font-semibold tracking-[-0.01em]">English Coach</span>
          <span className="text-xs text-fg-3">Speak with confidence</span>
        </span>
      </Link>

      <button type="button" onClick={openPalette} aria-label="Search (Ctrl K)"
        className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-raised/60 text-sm text-fg-3 transition hover:border-fg/20 hover:text-fg-2 xl:justify-start xl:px-3">
        <Search size={16} aria-hidden />
        <span className="hidden flex-1 text-left xl:inline">Search</span>
        <kbd className="hidden rounded-md border border-line bg-surface px-1.5 font-sans text-[0.6875rem] font-semibold xl:inline">Ctrl K</kbd>
      </button>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-5">
        {[["Learn", learn], ["Account", account]].map(([title, items]) => (
          <div key={title as string} className="flex flex-col gap-1">
            <span className="hidden px-3 pb-1 text-[0.6875rem] font-semibold tracking-wider text-fg-3 uppercase xl:block">{title as string}</span>
            {(items as typeof NAV).map((n) => <SideLink key={n.href} icon={n.icon} label={n.label} href={n.href} active={isActive(pathname, n.href)} />)}
          </div>
        ))}
      </nav>

      {user && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          {/* Streak and XP: side by side when labelled, stacked when the sidebar is icons only */}
          <div className="flex flex-col items-center gap-1.5 xl:flex-row xl:gap-2">
            <Tooltip label={`${user.streak} day streak`} className="xl:hidden">
              <span className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold tabular-nums xl:bg-peach/60">
                <Flame size={14} className="text-coral" aria-hidden />{compact(user.streak)}<span className="sr-only"> day streak</span>
                <span className="hidden font-medium text-fg-2 xl:inline" aria-hidden>day streak</span>
              </span>
            </Tooltip>
            <Tooltip label={`${user.xp} XP`} className="xl:hidden">
              <span className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold tabular-nums xl:bg-raised">
                <Zap size={14} className="text-[#d97706]" aria-hidden />{compact(user.xp)}<span className="sr-only"> XP</span>
                <span className="hidden font-medium text-fg-2 xl:inline" aria-hidden>XP</span>
              </span>
            </Tooltip>
          </div>
          <div className="flex flex-col items-center gap-1 xl:flex-row xl:gap-2">
            <Link href="/me" className="flex min-w-0 items-center gap-2.5 rounded-xl xl:flex-1 xl:p-1.5 xl:hover:bg-hover" aria-label={`${user.name}, your profile`}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mint text-xs font-bold text-on-mint">{user.name[0]?.toUpperCase()}</span>
              <span className="hidden min-w-0 flex-col leading-tight xl:flex">
                <span className="truncate text-sm font-semibold">{user.name}</span>
                <span className="truncate text-xs text-fg-3">{user.plan.name} plan</span>
              </span>
            </Link>
            <div className="flex flex-col gap-1 xl:flex-row">
              <SideIcon icon={theme === "night" ? Sun : Moon} label={theme === "night" ? "Day mode" : "Night mode"} onClick={toggleTheme} />
              <SideIcon icon={LogOut} label="Sign out" onClick={() => signOut()} />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function SideIcon({ icon: I, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <Tooltip label={label}>
      <button type="button" aria-label={label} onClick={onClick}
        className="grid size-9 cursor-pointer place-items-center rounded-lg text-fg-2 transition hover:bg-hover hover:text-fg">
        <I size={17} aria-hidden />
      </button>
    </Tooltip>
  );
}

/** Phones and tablets: a bar docked to the bottom edge, active tab in green with a small top indicator. */
function BottomBar({ pathname }: { pathname: string }) {
  const items = NAV.filter((n) => n.bar);
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      {items.map((n) => {
        const on = isActive(pathname, n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined}
            className={cn("relative flex flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors", on ? "text-accent-fg" : "text-fg-3 hover:text-fg")}>
            {on && <motion.span layoutId="bar-active" transition={spring} className="absolute top-0 h-0.5 w-8 rounded-full bg-mint-hover" />}
            <n.icon size={20} strokeWidth={on ? 2.4 : 2} aria-hidden />
            <span className={cn(on && "font-semibold")}>{n.label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={openPalette} className="flex cursor-pointer flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-fg-3 hover:text-fg">
        <Search size={20} aria-hidden />
        More
      </button>
    </nav>
  );
}
