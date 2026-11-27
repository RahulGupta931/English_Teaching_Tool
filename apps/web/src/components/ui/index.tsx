"use client";

/*
 * UI primitives. Styling comes from the tokens in src/styles/theme.css via Tailwind utilities.
 */

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useId, type ComponentProps, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/* ---------- Layout ---------- */

export function Page({ className, children, ...rest }: ComponentProps<"main">) {
  return (
    <main className={cn("mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-6 pb-10 sm:px-6 lg:px-8 lg:pt-8", className)} {...rest}>
      {children}
    </main>
  );
}

/** 40px title with the subtitle directly under it; optional actions on the right. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[2rem] font-semibold tracking-[-0.02em] text-fg sm:text-[2.5rem]">{title}</h1>
        {subtitle && <p className="text-sm text-fg-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

/** The one italic serif word in a headline. */
export const Flourish = ({ children }: { children: ReactNode }) => (
  <em className="font-serif font-normal text-coral">{children}</em>
);

/* ---------- Card ---------- */

type CardVariant = "default" | "hero" | "raised";
const CARD: Record<CardVariant, string> = {
  default: "bg-surface border border-line shadow-card backdrop-blur-xl",
  raised: "bg-raised",
  hero: "bg-linear-to-br from-hero to-hero-2 text-on-dark shadow-card",
};
export const cardClass = (variant: CardVariant = "default", interactive = false) =>
  cn(
    "relative flex flex-col gap-4 rounded-card p-5 sm:p-6",
    CARD[variant],
    interactive && "transition duration-200 ease-out hover:-translate-y-0.5 hover:brightness-[1.02] active:scale-[0.99]",
  );

export function Card({ variant, interactive, className, ...rest }: ComponentProps<"section"> & { variant?: CardVariant; interactive?: boolean }) {
  return <section className={cn(cardClass(variant, interactive), className)} {...rest} />;
}

export const CardTitle = ({ className, ...rest }: ComponentProps<"h2">) => (
  <h2 className={cn("text-lg font-semibold tracking-[-0.01em]", className)} {...rest} />
);

/* ---------- Buttons ---------- */

type ButtonVariant = "primary" | "coral" | "ghost" | "danger" | "glass";
// The house names map onto the shadcn button (components/ui/button.tsx), so every button shares one style.
const SHADCN_VARIANT = { primary: "default", coral: "coral", ghost: "secondary", glass: "glass", danger: "destructive" } as const;
export const buttonClass = (variant: ButtonVariant = "primary", size: "md" | "sm" = "md") =>
  buttonVariants({ variant: SHADCN_VARIANT[variant], size: size === "md" ? "default" : "sm" });

type ButtonOwn = { variant?: ButtonVariant; size?: "md" | "sm"; icon?: LucideIcon };

export function Button({ variant, size, icon: I, className, children, ...rest }: ComponentProps<"button"> & ButtonOwn) {
  return (
    <button className={cn(buttonClass(variant, size), className)} {...rest}>
      {I && <I size={18} aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, icon: I, className, children, ...rest }: ComponentProps<typeof Link> & ButtonOwn) {
  return (
    <Link className={cn(buttonClass(variant, size), className)} {...rest}>
      {I && <I size={18} aria-hidden />}
      {children}
    </Link>
  );
}

/* ---------- Tooltip (CSS only: shows on hover and keyboard focus) ---------- */

export function Tooltip({ label, side = "right", className, children }: { label: string; side?: "right" | "top" | "bottom"; className?: string; children: ReactNode }) {
  const pos = {
    right: "left-full top-1/2 ml-3 -translate-y-1/2",
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  }[side];
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute z-50 rounded-full bg-mint px-3 py-1 text-xs font-semibold whitespace-nowrap text-on-mint shadow-pop",
          "scale-95 opacity-0 transition duration-150 group-hover/tip:scale-100 group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:scale-100 group-has-[:focus-visible]/tip:opacity-100",
          pos,
          className,
        )}
      >
        {label}
      </span>
    </span>
  );
}

/** 36px circle on a raised surface. `label` is the accessible name and the tooltip. */
export function IconButton({ icon: I, label, tooltip = "top", className, ...rest }: ComponentProps<"button"> & { icon: LucideIcon; label: string; tooltip?: "right" | "top" | "bottom" | false }) {
  const btn = (
    <button
      aria-label={label}
      className={cn(
        "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-raised text-fg-2 transition duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...rest}
    >
      <I size={18} aria-hidden />
    </button>
  );
  return tooltip ? <Tooltip label={label} side={tooltip}>{btn}</Tooltip> : btn;
}

/* ---------- Pills / badges ---------- */

type Tone = "neutral" | "mint" | "coral" | "danger" | "glass";
const TONE: Record<Tone, string> = {
  neutral: "bg-raised text-fg",
  mint: "bg-mint text-on-mint",
  coral: "bg-peach text-on-mint",
  danger: "bg-danger/15 text-danger-fg",
  glass: "bg-white/10 text-on-dark",
};
const DOT: Record<Tone, string> = { neutral: "bg-mint-hover", mint: "bg-on-mint", coral: "bg-coral", danger: "bg-danger", glass: "bg-mint" };

export function Pill({ tone = "neutral", dot, icon: I, className, children }: { tone?: Tone; dot?: boolean; icon?: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold whitespace-nowrap tabular-nums", TONE[tone], className)}>
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", DOT[tone])} />}
      {I && <I size={14} aria-hidden />}
      {children}
    </span>
  );
}

/* ---------- Toggle ---------- */

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:opacity-45",
        checked ? "bg-mint" : "bg-track",
      )}
    >
      <span className={cn("absolute top-1 left-1 size-5 rounded-full transition-transform duration-200 ease-out", checked ? "translate-x-5 bg-on-mint" : "bg-white")} />
    </button>
  );
}

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-raised p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn("relative h-8 cursor-pointer rounded-full px-4 text-[0.8125rem] font-semibold transition-colors", on ? "text-on-mint" : "text-fg-2 hover:text-fg")}
          >
            {on && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-mint" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Tabs (text tabs, animated mint underline) ---------- */

export function Tabs<T extends string>({ value, tabs, onChange, label }: { value: T; tabs: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const id = useId();
  return (
    <div role="tablist" aria-label={label} className="flex gap-6 border-b border-line">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn("relative cursor-pointer pb-2.5 text-sm font-medium transition-colors", on ? "text-fg" : "text-fg-2 hover:text-fg")}
          >
            {t.label}
            {on && <motion.span layoutId={`tab-${id}`} className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-mint-hover" />}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Avatars ---------- */

export function Avatar({ name, src, size = 40, online, ringClass = "ring-surface" }: { name: string; src?: string; size?: number; online?: boolean; ringClass?: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} width={size} height={size} className="size-full rounded-full object-cover" />
      ) : (
        <span role="img" aria-label={name} className="grid size-full place-items-center rounded-full bg-mint font-semibold text-on-mint" style={{ fontSize: size * 0.38 }}>{initials}</span>
      )}
      {online && <span aria-label="online" className={cn("absolute right-0 bottom-0 size-3 rounded-full bg-mint-hover ring-2", ringClass)} />}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = 32 }: { people: { name: string; src?: string }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center">
      {extra > 0 && (
        <span className="z-10 grid place-items-center rounded-full bg-raised text-xs font-semibold text-fg ring-2 ring-surface" style={{ width: size, height: size }}>+{extra}</span>
      )}
      {shown.map((p, i) => (
        <span key={i} className="rounded-full ring-2 ring-surface" style={{ marginLeft: i || extra > 0 ? -size * 0.3 : 0 }}>
          <Avatar name={p.name} src={p.src} size={size} />
        </span>
      ))}
    </span>
  );
}

/* ---------- List row ---------- */

export function IconTile({ icon: I, tone = "raised", size = 40 }: { icon: LucideIcon; tone?: "raised" | "mint" | "hero" | "coral" | "link"; size?: number }) {
  const cls = { raised: "bg-raised text-accent-fg", mint: "bg-mint text-on-mint", hero: "bg-white/10 text-mint", coral: "bg-coral/15 text-coral", link: "bg-link/15 text-link" }[tone];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-xl", cls)} style={{ width: size, height: size }}>
      <I size={size * 0.45} aria-hidden />
    </span>
  );
}

export function ListRow({ leading, title, meta, trailing, selected, className }: { leading?: ReactNode; title: ReactNode; meta?: ReactNode; trailing?: ReactNode; selected?: boolean; className?: string }) {
  return (
    <li className={cn("flex items-center gap-3 rounded-tile px-2 py-2.5 transition-colors", selected && "bg-raised", className)}>
      {leading}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-fg">{title}</span>
        {meta && <span className="truncate text-xs text-fg-3">{meta}</span>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </li>
  );
}

/* ---------- Data ---------- */

/** Big number with a small muted unit ("574 min"). */
export function Metric({ value, unit, className }: { value: ReactNode; unit?: string; className?: string }) {
  return (
    <span className={cn("flex items-baseline gap-2", className)}>
      <span className="text-5xl font-semibold tracking-[-0.03em] tabular-nums sm:text-[3.25rem]">{value}</span>
      {unit && <span className="text-sm text-fg-2">{unit}</span>}
    </span>
  );
}

/** Row of thin vertical ticks; filled ticks are mint. */
export function TickBar({ value, ticks = 36, label }: { value: number; ticks?: number; label: string }) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * ticks);
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} className="flex h-5 gap-[3px]">
      {Array.from({ length: ticks }, (_, i) => (
        <span key={i} className={cn("flex-1 rounded-full", i < filled ? "bg-mint-hover" : "bg-track/50")} />
      ))}
    </div>
  );
}

/** Thick, fully rounded vertical bars. The highest bar is mint with a value bubble. */
export function PillBars({ data, max = 100, height = 160 }: { data: { label: string; value: number }[]; max?: number; height?: number }) {
  const top = Math.max(...data.map((d) => d.value));
  return (
    <ul className="flex items-end justify-between gap-3" style={{ height: height + 28 }}>
      {data.map((d) => {
        const hi = d.value === top;
        const h = Math.max(14, (d.value / max) * height);
        return (
          <li key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-2" aria-label={`${d.label}: ${Math.round(d.value)}`}>
            <div className="relative flex w-full max-w-11 justify-center" style={{ height }}>
              <span
                className={cn("absolute bottom-0 w-full rounded-full", hi ? "bg-linear-to-t from-mint-hover to-mint" : "bg-raised")}
                style={{ height: h }}
              />
              {hi && (
                <span className="absolute z-10 rounded-full bg-hero px-2 py-0.5 text-[0.6875rem] font-semibold text-on-dark tabular-nums" style={{ bottom: h - 12 }}>
                  {Math.round(d.value)}
                </span>
              )}
            </div>
            <span aria-hidden className="w-full truncate text-center text-xs text-fg-3">{d.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Loading / empty ---------- */

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn("shimmer rounded-tile", className)} />;

export function EmptyState({ icon: I, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-tile bg-raised px-4 py-8 text-center">
      <IconTile icon={I} tone="mint" />
      <p className="text-sm font-semibold">{title}</p>
      {text && <p className="max-w-xs text-xs text-fg-2">{text}</p>}
      {action}
    </div>
  );
}
