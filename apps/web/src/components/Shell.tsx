"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { usePathname } from "next/navigation";
import { useToken } from "@/lib/api";
import { Nav } from "./Nav";
import { CommandPalette } from "./CommandPalette";

/** The big rounded app container: rail on the left (1024px+), content on the right. */
export function Shell({ children }: { children: ReactNode }) {
  const token = useToken();
  // Admin has its own sign-in and header: no learner rail or public site bar.
  if (usePathname()?.startsWith("/admin")) return <MotionConfig reducedMotion="user"><div id="main" tabIndex={-1} className="flex min-h-dvh flex-col outline-none">{children}</div></MotionConfig>;
  const signedOut = token === null;
  return (
    <MotionConfig reducedMotion="user">
      <div
        className={
          signedOut
            ? "relative flex min-h-dvh flex-1 flex-col" // landing: top bar, full width
            : "relative flex min-h-dvh flex-1 flex-col lg:m-6 lg:min-h-[calc(100dvh-48px)] lg:flex-row lg:items-start lg:gap-4 lg:rounded-shell lg:border lg:border-[var(--shell-border)] lg:bg-[var(--shell)] lg:p-4 lg:backdrop-blur-xl"
        }
      >
        <Nav />
        <div id="main" tabIndex={-1} className={signedOut ? "flex min-w-0 flex-1 flex-col outline-none" : "flex min-w-0 flex-1 flex-col self-stretch pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] outline-none lg:pb-0"}>
          {children}
        </div>
      </div>
      <CommandPalette />
    </MotionConfig>
  );
}
