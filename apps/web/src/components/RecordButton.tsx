"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Mic, Square } from "lucide-react";
import { cn } from "@/components/ui";

type Props = {
  recording: boolean;
  busy?: boolean;
  disabled?: boolean;
  maxSeconds?: number;
  onStart: () => void;
  onStop: () => void;
  label?: string;
  stopLabel?: string;
  busyLabel?: string;
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** One large mic button used on every speaking screen: idle, recording (with timer) and busy states. */
export function RecordButton({ recording, busy, disabled, maxSeconds, onStart, onStop, label = "Tap to record", stopLabel = "Tap to stop", busyLabel = "Scoring…" }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => {
      clearInterval(id);
      setElapsed(0);
    };
  }, [recording]);

  const text = recording ? stopLabel : busy ? busyLabel : label;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative grid place-items-center">
        {recording && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-danger/30" />}
        <button
          type="button"
          onClick={recording ? onStop : onStart}
          disabled={!recording && (busy || disabled)}
          aria-label={text}
          aria-pressed={recording}
          className={cn(
            "relative grid size-20 cursor-pointer place-items-center rounded-full shadow-pop transition duration-200 ease-out hover:scale-105 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
            recording ? "bg-danger text-white" : "bg-linear-to-br from-hero to-hero-2 text-mint",
          )}
        >
          {busy && !recording ? <LoaderCircle size={30} className="animate-spin" aria-hidden />
            : recording ? <Square size={26} fill="currentColor" aria-hidden /> : <Mic size={30} aria-hidden />}
        </button>
      </div>
      <span className="text-sm font-medium text-fg-2" aria-hidden="true">{text}</span>
      {recording && (
        <span className="text-sm font-semibold tabular-nums text-fg" aria-live="off">
          {clock(elapsed)}
          {maxSeconds ? <span className="font-normal text-fg-3"> / {clock(maxSeconds)}</span> : null}
        </span>
      )}
    </div>
  );
}
