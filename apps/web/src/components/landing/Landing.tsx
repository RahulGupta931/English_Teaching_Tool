"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  ArrowDown, ArrowLeft, ArrowRight, AudioLines, BriefcaseBusiness, Check, Flame, Languages, LayoutGrid, Link2,
  ListChecks, MessagesSquare, Mic, Sparkles, Target, Timer, Trophy, X, type LucideIcon,
} from "lucide-react";
import { SignIn } from "@/components/Auth";
import { ButtonLink, Flourish, IconTile, Pill, cn } from "@/components/ui";
import { Dock, Lens, MagnifyText } from "./Magnify";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------- Small motion helpers ---------- */

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Section heading whose words rise in one by one. */
function RevealWords({ text, flourish, className }: { text: string; flourish?: string; className?: string }) {
  const words = text.split(" ");
  return (
    <motion.h2
      className={cn("text-[2rem] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[2.75rem]", className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.6 }}
      transition={{ staggerChildren: 0.06 }}
    >
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="mr-[0.25em] inline-block"
          variants={{ hidden: { opacity: 0, y: 14, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)" } }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          {w === flourish ? <Flourish>{w}</Flourish> : w}
        </motion.span>
      ))}
    </motion.h2>
  );
}

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <Reveal><Pill tone="neutral" dot className="w-fit bg-surface shadow-card">{children}</Pill></Reveal>
);

/* ---------- Content ---------- */

const FEATURES: { title: string; text: string; tag: string; icon: LucideIcon }[] = [
  { title: "AI Role-Play", text: "Real spoken conversations: job interviews, small talk, ordering food, travel. Then a debrief on what to say more naturally.", tag: "Speaking", icon: MessagesSquare },
  { title: "Interview Preparation", text: "Upload your resume and answer questions about your own experience, out loud.", tag: "Career", icon: BriefcaseBusiness },
  { title: "JAM: Just a Minute", text: "A topic, ten seconds to think, sixty seconds to speak. Feedback on fillers, pauses and grammar.", tag: "Fluency", icon: Timer },
  { title: "Daily Word", text: "One five-letter word a day in six guesses. Then hear it, learn it and use it in a sentence.", tag: "Game", icon: LayoutGrid },
  { title: "Word Chain", text: "Say a word that starts with the last letter of the AI's word, before the timer runs out.", tag: "Game", icon: Link2 },
  { title: "Tongue Twister", text: "Listen once, then say it clearly and quickly. Levels get longer and faster.", tag: "Game", icon: AudioLines },
  { title: "MCQ Quiz", text: "Ten quick grammar and vocabulary questions with an explanation for every answer.", tag: "Grammar", icon: ListChecks },
  { title: "Hinglish explanations", text: "Stuck? Get the explanation in Hinglish, then switch back to English as you improve.", tag: "Support", icon: Languages },
];

const GAMES: { label: string; icon: LucideIcon }[] = [
  { label: "Daily Word", icon: LayoutGrid },
  { label: "JAM", icon: Timer },
  { label: "Word Chain", icon: Link2 },
  { label: "Tongue Twister", icon: AudioLines },
  { label: "MCQ Quiz", icon: ListChecks },
];

const STEPS: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "Start talking", text: "Sign in and try a role-play or a game. No test needed to begin.", icon: Mic },
  { title: "Find your level", text: "Answer three spoken questions so practice matches where you are.", icon: Target },
  { title: "Practise daily", text: "Earn XP, keep your streak, and see your mistakes come back for review.", icon: Flame },
];

/* ---------- Page ---------- */

export function Landing() {
  return (
    <main className="flex flex-col">
      <Hero />
      <Features />
      <Feedback />
      <Games />
      <HowItWorks />
      <Join />
      <Footer />
    </main>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pt-20 lg:pb-28">
      <div className="flex flex-col gap-6">
        <Eyebrow>Voice-first English practice</Eyebrow>
        <MagnifyText
          className="text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[4rem]"
          parts={[{ text: "Speak English with" }, { text: "confidence", className: "font-serif font-normal italic text-coral" }]}
        />
        <Reveal delay={0.1}>
          <p className="max-w-md text-base leading-relaxed text-fg-2 sm:text-lg">
            Practise speaking with an AI partner, prepare for interviews from your own resume, and play quick word games every day.
          </p>
        </Reveal>
        <Reveal delay={0.2} className="flex flex-wrap gap-3">
          <ButtonLink href="#signin" icon={Mic}>Start speaking free</ButtonLink>
          <ButtonLink href="#features" variant="ghost" className="bg-surface shadow-card">See what&apos;s inside <ArrowDown size={16} aria-hidden /></ButtonLink>
        </Reveal>
        <Reveal delay={0.3} className="flex flex-wrap gap-2">
          {["Hinglish explanations", "Interview practice", "Daily games and streaks"].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-2">
              <Check size={14} className="text-accent-fg" aria-hidden />{t}
            </span>
          ))}
        </Reveal>
      </div>
      <HeroVisual />
    </section>
  );
}

/** A sample conversation that plays itself in. Clearly marked as an example. */
function HeroVisual() {
  const item = (delay: number) => ({
    initial: { opacity: 0, y: 14, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.5, delay, ease: EASE },
  });
  return (
    <div className="relative" aria-label="Example role-play" role="img">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-full bg-mint/25 blur-3xl" />
      <motion.div {...item(0)} className="relative flex flex-col gap-4 overflow-hidden rounded-card bg-linear-to-br from-hero to-hero-2 p-6 text-on-dark shadow-pop">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold"><IconTile icon={BriefcaseBusiness} tone="hero" size={32} />Job interview</span>
          <Pill tone="glass" dot>Example</Pill>
        </div>

        <motion.div {...item(0.35)} className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 text-sm">
          So, tell me about yourself.
        </motion.div>
        <motion.div {...item(0.75)} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-mint px-4 py-3 text-sm text-on-mint">
          I am working in sales since three years.
        </motion.div>

        <motion.div {...item(1.15)} className="flex items-center gap-3 rounded-2xl bg-black/15 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-coral text-on-coral"><Mic size={16} aria-hidden /></span>
          <span className="flex h-8 flex-1 items-center gap-[3px]">
            {Array.from({ length: 28 }, (_, i) => (
              <span key={i} className="wave-bar w-full rounded-full bg-mint/80" style={{ animationDelay: `${(i % 7) * 90}ms`, height: `${30 + ((i * 37) % 60)}%` }} />
            ))}
          </span>
          <span className="text-xs text-on-dark-2 tabular-nums">0:07</span>
        </motion.div>

        <motion.div {...item(1.55)} className="flex flex-col gap-1.5 rounded-2xl bg-white/[0.06] p-4 text-sm">
          <span className="flex items-center gap-2 text-on-dark-2 line-through decoration-coral"><X size={14} className="text-coral" aria-hidden />working in sales since three years</span>
          <span className="flex items-center gap-2 font-medium"><Check size={14} className="text-mint" aria-hidden />I have been working in sales for three years.</span>
        </motion.div>
      </motion.div>

      <motion.div {...item(1.9)} className="float-slow absolute -bottom-5 -left-3 flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 shadow-pop sm:-left-8">
        <Trophy size={16} className="text-accent-fg" aria-hidden />
        <span className="text-xs font-semibold">+20 XP</span>
      </motion.div>
      <motion.div {...item(2.1)} className="float-slow absolute -top-4 -right-2 flex items-center gap-2 rounded-full bg-coral px-4 py-2.5 text-on-coral shadow-pop [animation-delay:1.2s] sm:-right-6">
        <Flame size={16} aria-hidden />
        <span className="text-xs font-semibold">5-day streak</span>
      </motion.div>
    </div>
  );
}

/* ---------- Features: horizontal slide driven by vertical scroll (desktop), swipe carousel (smaller screens) ---------- */

function FeatureCard({ f, i }: { f: (typeof FEATURES)[number]; i: number }) {
  return (
    <article className="group relative flex w-[280px] shrink-0 snap-start flex-col gap-6 overflow-hidden rounded-card border border-line bg-surface p-6 shadow-card transition duration-300 hover:-translate-y-1 sm:w-[320px]">
      {/* Rests in the bottom-right corner; on hover it spins to the centre and grows to fill the card. */}
      <f.icon
        aria-hidden
        size={120}
        strokeWidth={1}
        className="pointer-events-none absolute top-1/2 left-1/2 translate-x-[35%] translate-y-[20%] text-accent-fg opacity-[0.07] transition-[translate,scale,rotate,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-x-1/2 group-hover:-translate-y-1/2 group-hover:scale-[1.9] group-hover:-rotate-[20deg] group-hover:opacity-[0.13]"
      />
      <div className="relative flex items-start justify-between">
        <span className="transition duration-300 group-hover:scale-110 group-hover:-rotate-6"><IconTile icon={f.icon} tone="mint" size={52} /></span>
        <span className="text-sm font-semibold text-fg-3 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
      </div>
      <div className="relative flex flex-col gap-2">
        <Pill tone="neutral" className="w-fit">{f.tag}</Pill>
        <h3 className="text-xl font-semibold tracking-[-0.01em]">{f.title}</h3>
        <p className="text-sm leading-relaxed text-fg-2">{f.text}</p>
      </div>
    </article>
  );
}

function Features() {
  return (
    <div id="features" className="scroll-mt-24">
      <FeatureScroller />
      <FeatureCarousel />
    </div>
  );
}

function FeaturesHead() {
  return (
    <div className="flex flex-col gap-4">
      <Eyebrow>Everything inside</Eyebrow>
      <RevealWords text="Eight ways to practise, all out loud" flourish="loud" />
    </div>
  );
}

function FeatureScroller() {
  const section = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const v = viewport.current, r = row.current;
    if (!v || !r) return;
    const measure = () => setDistance(Math.max(0, r.offsetWidth - v.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(v);
    ro.observe(r);
    return () => ro.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const x = useSpring(useTransform(scrollYProgress, [0, 1], [0, -distance]), { stiffness: 120, damping: 24, mass: 0.3 });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  return (
    <section ref={section} aria-label="Features" className="relative hidden lg:block" style={{ height: `calc(100dvh + ${distance}px)` }}>
      <div className="sticky top-0 flex h-dvh flex-col justify-center gap-10 overflow-hidden pt-20">
        <div className="mx-auto flex w-full max-w-[1200px] items-end justify-between gap-6 px-8">
          <FeaturesHead />
          <p className="max-w-[16rem] pb-2 text-sm text-fg-2">Keep scrolling to slide through every feature.</p>
        </div>
        <div ref={viewport} className="mx-auto w-full max-w-[1200px] px-8">
          <motion.div ref={row} style={{ x }} className="flex w-max gap-6 py-2">
            {FEATURES.map((f, i) => <FeatureCard key={f.title} f={f} i={i} />)}
          </motion.div>
        </div>
        <div className="mx-auto w-full max-w-[1200px] px-8">
          <div className="h-1.5 overflow-hidden rounded-full bg-raised">
            <motion.div style={{ scaleX: progress }} className="h-full origin-left rounded-full bg-mint-hover" />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const slide = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  return (
    <section aria-label="Features" className="flex flex-col gap-6 py-16 lg:hidden">
      <div className="flex items-end justify-between gap-4 px-4 sm:px-6">
        <FeaturesHead />
        <div className="hidden gap-2 sm:flex">
          <button type="button" aria-label="Previous feature" onClick={() => slide(-1)} className="grid size-11 cursor-pointer place-items-center rounded-full bg-surface shadow-card active:scale-[0.97]"><ArrowLeft size={18} aria-hidden /></button>
          <button type="button" aria-label="Next feature" onClick={() => slide(1)} className="grid size-11 cursor-pointer place-items-center rounded-full bg-mint text-on-mint active:scale-[0.97]"><ArrowRight size={18} aria-hidden /></button>
        </div>
      </div>
      <div ref={track} className="flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:scroll-px-6 sm:px-6">
        {FEATURES.map((f, i) => <FeatureCard key={f.title} f={f} i={i} />)}
      </div>
    </section>
  );
}

/* ---------- Feedback, under a water-drop lens ---------- */

function Feedback() {
  return (
    <section id="feedback" className="mx-auto grid w-full max-w-[1200px] scroll-mt-24 items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-8 lg:py-28">
      <div className="flex flex-col gap-5">
        <Eyebrow>Feedback that teaches</Eyebrow>
        <RevealWords text="See exactly what to say better" flourish="better" />
        <Reveal delay={0.1}>
          <p className="max-w-md text-base leading-relaxed text-fg-2">
            After every conversation you get each mistake with a correction and a short explanation, in English or Hinglish. They come back later so you practise your real weak points.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="hidden text-sm text-fg-3 lg:block">Move your pointer over the card to look closer.</p>
        </Reveal>
      </div>

      <Reveal delay={0.1}>
        <Lens className="overflow-hidden rounded-card border border-line bg-[var(--surface-solid)] shadow-card">
          <div className="flex flex-col gap-5 p-6 sm:p-7">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Your debrief</span>
              <Pill tone="neutral">Example</Pill>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[["Grammar", 72], ["Vocabulary", 85], ["Fluency", 78]].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-2 rounded-tile bg-raised p-3">
                  <span className="text-xs text-fg-2">{k}</span>
                  <span className="text-2xl font-semibold tabular-nums">{v}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-track/50"><span className="block h-full rounded-full bg-mint-hover" style={{ width: `${v}%` }} /></span>
                </div>
              ))}
            </div>
            <ul className="flex flex-col gap-3">
              {[
                { o: "I am working here since 2022.", c: "I have been working here since 2022.", e: "Use the present perfect continuous for something that started in the past and is still going on." },
                { o: "Please do the needful.", c: "Please could you take care of this?", e: "“Do the needful” sounds dated in international English. Ask for the specific action." },
              ].map((m) => (
                <li key={m.o} className="flex flex-col gap-1.5 rounded-tile bg-raised p-4 text-sm">
                  <span className="flex items-start gap-2 text-fg-2"><X size={15} className="mt-0.5 shrink-0 text-danger-fg" aria-hidden /><span className="line-through decoration-danger/60">{m.o}</span></span>
                  <span className="flex items-start gap-2 font-semibold"><Check size={15} className="mt-0.5 shrink-0 text-accent-fg" aria-hidden />{m.c}</span>
                  <span className="pl-[23px] text-xs leading-relaxed text-fg-2">{m.e}</span>
                </li>
              ))}
            </ul>
          </div>
        </Lens>
      </Reveal>
    </section>
  );
}

/* ---------- Games dock ---------- */

function Games() {
  return (
    <section id="games" className="mx-auto flex w-full max-w-[1200px] scroll-mt-24 flex-col items-center gap-10 px-4 py-20 text-center sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-4">
        <Eyebrow>Daily games</Eyebrow>
        <RevealWords text="Five minutes a day keeps the streak alive" flourish="alive" className="max-w-2xl" />
        <Reveal delay={0.1}><p className="max-w-md text-base text-fg-2">Every game earns XP. Play a round on the bus, keep your streak, climb the leagues.</p></Reveal>
      </div>
      <Reveal delay={0.15} className="w-full">
        <div className="rounded-[2rem] border border-line bg-surface px-4 pt-12 pb-6 shadow-card backdrop-blur-xl sm:px-10">
          <Dock
            items={GAMES.map((g) => (
              <a key={g.label} href="#signin" className="flex flex-col items-center gap-3 rounded-2xl">
                <span className="grid size-14 place-items-center rounded-2xl bg-linear-to-br from-hero to-hero-2 text-mint shadow-card sm:size-16">
                  <g.icon size={26} aria-hidden />
                </span>
                <span className="text-xs font-semibold whitespace-nowrap text-fg-2">{g.label}</span>
              </a>
            ))}
          />
        </div>
      </Reveal>
    </section>
  );
}

/* ---------- How it works ---------- */

function HowItWorks() {
  return (
    <section id="how" className="mx-auto flex w-full max-w-[1200px] scroll-mt-24 flex-col gap-10 px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <Eyebrow>How it works</Eyebrow>
        <RevealWords text="Three steps to speaking with ease" flourish="ease" />
      </div>
      <ol className="grid gap-5 md:grid-cols-3 lg:gap-6">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.12, ease: EASE }}
            className="group flex h-full flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-card backdrop-blur-xl transition-[translate] duration-300 hover:-translate-y-1"
          >
              <div className="flex items-center justify-between">
                <span className="transition duration-300 group-hover:scale-110 group-hover:rotate-6"><IconTile icon={s.icon} tone="mint" size={48} /></span>
                <span className="text-[3.5rem] leading-none font-semibold tracking-[-0.04em] text-fg/10 transition duration-300 group-hover:text-mint-hover">{i + 1}</span>
              </div>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-fg-2">{s.text}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- Sign in ---------- */

function Join() {
  return (
    <section id="signin" className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
      <div className="relative grid items-center gap-10 overflow-hidden rounded-[2rem] bg-linear-to-br from-hero to-hero-2 p-6 text-on-dark shadow-pop sm:p-10 lg:grid-cols-[1fr_1fr] lg:p-14">
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-mint/15 blur-3xl" />
        <div className="relative flex flex-col gap-5">
          <Pill tone="glass" dot className="w-fit">Free to start</Pill>
          <h2 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[2.75rem]">
            Your first conversation is <Flourish>one tap</Flourish> away
          </h2>
          <ul className="flex flex-col gap-3 text-sm text-on-dark-2">
            {["Daily speaking minutes on the free plan", "One resume interview included", "Explanations in English or Hinglish"].map((t) => (
              <li key={t} className="flex items-center gap-3"><span className="grid size-6 place-items-center rounded-full bg-mint text-on-mint"><Check size={14} aria-hidden /></span>{t}</li>
            ))}
          </ul>
          <span className="hidden items-center gap-2 text-xs text-on-dark-2 lg:flex"><Sparkles size={14} aria-hidden />Upgrade any time for more interviews and speaking time.</span>
        </div>
        <div className="relative text-fg">
          <SignIn />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 pt-6 pb-10 text-xs text-fg-2 sm:px-6 lg:px-8">
      <span className="flex items-center gap-2 font-semibold text-fg">
        <span className="grid size-8 place-items-center rounded-full bg-linear-to-br from-hero to-hero-2 text-mint"><Mic size={16} aria-hidden /></span>
        English Coach
      </span>
      <nav aria-label="Footer" className="flex gap-5">
        <a href="#features" className="hover:text-fg">Features</a>
        <a href="#games" className="hover:text-fg">Games</a>
        <a href="#how" className="hover:text-fg">How it works</a>
        <a href="#signin" className="hover:text-fg">Sign in</a>
      </nav>
      <span>© English Coach</span>
    </footer>
  );
}
