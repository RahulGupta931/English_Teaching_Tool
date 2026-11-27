import type { ReactNode } from "react";
import { Bot, User, Volume2 } from "lucide-react";
import { cn } from "@/components/ui";
import { Button } from "@/components/ui/button";

/** One chat message: the learner's on the right in green, the AI's on the left in grey with a replay button. */
export function ChatBubble({ mine, children, onReplay, replayDisabled, who }: {
  mine: boolean; children: ReactNode; onReplay?: () => void; replayDisabled?: boolean; who: string;
}) {
  return (
    <div className={cn("flex items-end gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300", mine && "flex-row-reverse")}>
      <span aria-label={mine ? "You" : who} className={cn("grid size-8 shrink-0 place-items-center rounded-full", mine ? "bg-chat-sent text-on-mint" : "bg-linear-to-br from-hero to-hero-2 text-mint")}>
        {mine ? <User size={16} aria-hidden /> : <Bot size={16} aria-hidden />}
      </span>
      {/* ChatBubble spec: 20px radius on every bubble, no large shadows */}
      <div className={cn("flex max-w-[80%] items-center gap-1 rounded-[20px] px-4 py-2.5 text-[0.9375rem] leading-relaxed",
        mine ? "bg-chat-sent text-on-mint" : "bg-chat-received text-fg")}>
        <span className="min-w-0">{children}</span>
        {onReplay && (
          <Button variant="ghost" size="icon" onClick={onReplay} disabled={replayDisabled} aria-label="Play again" className="-my-2 -mr-2 size-11 shrink-0 text-fg-2">
            <Volume2 />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Three bouncing dots while the AI is thinking. */
export function TypingBubble({ who }: { who: string }) {
  return (
    <div className="flex items-end gap-2.5">
      <span aria-label={who} className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-hero to-hero-2 text-mint"><Bot size={16} aria-hidden /></span>
      <span aria-label="Thinking" className="flex gap-1 rounded-[20px] bg-chat-received px-4 py-3.5">
        {[0, 150, 300].map((d) => <i key={d} className="size-1.5 animate-bounce rounded-full bg-fg-3" style={{ animationDelay: `${d}ms` }} />)}
      </span>
    </div>
  );
}
