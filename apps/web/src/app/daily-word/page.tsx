"use client";

import { useEffect, useState } from "react";
import { Check, Delete, LoaderCircle, Share2, Sparkles, Volume2, X } from "lucide-react";
import { ActivityAside } from "@/components/ActivityAside";
import { RecordButton } from "@/components/RecordButton";
import { Page, PageHeader, cn } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorText, playAudio, postAudio, postJson, useRequireLogin } from "@/lib/api";
import { useRecorder } from "@/lib/useRecorder";

type Tile = "correct" | "present" | "absent";
type State = {
  guesses: { word: string; result: Tile[] }[];
  max_guesses: number;
  finished: boolean;
  solved: boolean;
  bonus_done: boolean;
  reveal: { word: string; meaning: string; example: string; phonetic: string; audio: string | null } | null;
};
type Bonus = { transcript: string; correct: boolean; feedback: string; xp: number };

// Used only in the shared text result, not as UI icons.
const EMOJI: Record<Tile, string> = { correct: "🟩", present: "🟨", absent: "⬜" };
const TILE_WORD: Record<Tile, string> = { correct: "right place", present: "wrong place", absent: "not in word" };
const TILE_BG: Record<Tile, string> = {
  correct: "bg-[var(--tile-correct)] text-white border-transparent",
  present: "bg-[var(--tile-present)] text-white border-transparent",
  absent: "bg-[var(--tile-absent)] text-white border-transparent",
};
const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const RANK: Record<Tile, number> = { absent: 0, present: 1, correct: 2 };

export default function DailyWord() {
  useRequireLogin();
  const [state, setState] = useState<State | null>(null);
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [bonus, setBonus] = useState<Bonus | null>(null);
  const recorder = useRecorder(15, sendSentence, setMessage);

  useEffect(() => {
    api<State>("/v1/daily-word").then(setState).catch((e) => setMessage(errorText(e)));
  }, []);

  async function submitGuess(e?: React.FormEvent) {
    e?.preventDefault();
    if (guess.length !== 5 || busy) return;
    setBusy(true);
    setMessage("");
    try {
      setState(await postJson<State>("/v1/daily-word/guess", { word: guess }));
      setGuess("");
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendSentence(wav: Blob) {
    setBusy(true);
    try {
      const r = await postAudio<Bonus>("/v1/daily-word/sentence", wav);
      setBonus(r);
      if (r.correct) setState((s) => (s ? { ...s, bonus_done: true } : s));
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!state) return;
    const grid = state.guesses.map((g) => g.result.map((t) => EMOJI[t]).join("")).join("\n");
    const text = `Daily Word ${state.solved ? state.guesses.length : "X"}/${state.max_guesses}\n${grid}`;
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Result copied!");
    } catch {
      setMessage("");
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  if (!state) {
    return (
      <Page className="max-w-3xl">
        {message ? <p role="alert" className="text-sm text-danger-fg">{message}</p> : <p role="status" className="sr-only">Loading…</p>}
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mx-auto h-96 w-full max-w-sm rounded-card" />
      </Page>
    );
  }

  const rows = Array.from({ length: state.max_guesses }, (_, i) => state.guesses[i]);
  const triesLeft = state.max_guesses - state.guesses.length;
  // Best-known state of each letter, for the on-screen keyboard.
  const letters: Record<string, Tile> = {};
  for (const g of state.guesses) [...g.word].forEach((ch, j) => {
    const t = g.result[j];
    if (!letters[ch] || RANK[t] > RANK[letters[ch]]) letters[ch] = t;
  });
  const type = (ch: string) => setGuess((g) => (g.length < 5 ? g + ch : g));

  return (
    <Page className="max-w-5xl">
      <PageHeader
        title="Guess today's word"
        subtitle={`Find the five-letter word in ${state.max_guesses} tries. Everyone gets the same word today.`}
        actions={!state.finished && <Badge variant="secondary" className="h-8 px-3 text-sm">{triesLeft} {triesLeft === 1 ? "try" : "tries"} left</Badge>}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card className="items-center">
          <CardContent className="flex w-full flex-col items-center gap-5">
            <div role="grid" aria-label="Your guesses" className="grid w-full max-w-[340px] gap-2">
              {rows.map((g, i) => {
                const typing = i === state.guesses.length && !state.finished;
                return (
                  <div key={i} role="row" className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 5 }, (_, j) => {
                      const letter = g?.word[j] ?? (typing ? guess[j] ?? "" : "");
                      return (
                        <div
                          key={j}
                          role="gridcell"
                          aria-label={g ? `${g.word[j]}, ${TILE_WORD[g.result[j]]}` : letter || "empty"}
                          className={cn(
                            "grid aspect-square place-items-center rounded-xl border-2 text-2xl font-bold uppercase transition-all duration-300",
                            g ? TILE_BG[g.result[j]] : letter ? "scale-105 border-fg/40 bg-surface" : "border-line bg-raised/60",
                          )}
                        >
                          {letter}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <ul aria-label="Colour key" className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-fg-2">
              <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-[var(--tile-correct)]" />Right place</li>
              <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-[var(--tile-present)]" />Wrong place</li>
              <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-[var(--tile-absent)]" />Not in word</li>
            </ul>

            {!state.finished && (
              <>
                <form onSubmit={submitGuess} className="flex w-full max-w-[340px] gap-2">
                  <label htmlFor="guess" className="sr-only">Your guess ({triesLeft} tries left)</label>
                  <Input
                    id="guess"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 5))}
                    maxLength={5}
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Type a word"
                    className="text-center text-lg font-semibold tracking-[0.3em] uppercase placeholder:tracking-normal placeholder:normal-case"
                  />
                  <Button type="submit" disabled={busy || guess.length !== 5}>
                    {busy ? <LoaderCircle className="animate-spin" /> : "Guess"}
                  </Button>
                </form>

                {/* On-screen keyboard (touch screens), coloured by what you've learned */}
                <div className="flex w-full flex-col items-center gap-1.5" aria-hidden="true">
                  {KEYS.map((row, r) => (
                    <div key={row} className="flex w-full justify-center gap-1.5">
                      {r === 2 && <KeyButton wide onClick={() => setGuess((g) => g.slice(0, -1))}><Delete size={18} aria-label="Delete letter" /></KeyButton>}
                      {[...row].map((ch) => (
                        <KeyButton key={ch} state={letters[ch]} onClick={() => type(ch)}>{ch}</KeyButton>
                      ))}
                      {r === 2 && <KeyButton wide onClick={() => submitGuess()}>Enter</KeyButton>}
                    </div>
                  ))}
                </div>
              </>
            )}

            <p role="status" aria-live="polite" className="min-h-5 text-center text-sm text-fg-2">
              {recorder.recording ? "Recording… tap stop when you finish." : busy && !state.finished ? "Checking…" : message}
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {state.reveal ? (
            <>
              <Card className="bg-linear-to-br from-hero to-hero-2 text-on-dark">
                <CardHeader>
                  <Badge className={cn("h-7 px-3", state.solved ? "bg-mint text-on-mint" : "bg-white/10 text-on-dark")}>
                    {state.solved ? `Solved in ${state.guesses.length}!` : "Today's word was"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <p className="text-4xl font-bold tracking-[0.12em] uppercase">{state.reveal.word}</p>
                    <Button variant="glass" size="icon" onClick={() => playAudio(state.reveal?.audio, state.reveal?.word)} aria-label="Hear the word">
                      <Volume2 />
                    </Button>
                  </div>
                  {state.reveal.phonetic && <p className="text-sm text-on-dark-2">{state.reveal.phonetic}</p>}
                  {state.reveal.meaning && <p className="text-base">{state.reveal.meaning}</p>}
                  {state.reveal.example && <p className="border-l-2 border-mint/60 pl-3 text-sm italic text-on-dark-2">“{state.reveal.example}”</p>}
                  <div><Button variant="glass" onClick={share}><Share2 />Share on WhatsApp</Button></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-coral" aria-hidden />Bonus: use “{state.reveal.word}” in a sentence</CardTitle>
                  {!state.bonus_done && <CardDescription>Say one sentence out loud that uses today&apos;s word.</CardDescription>}
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  {state.bonus_done ? (
                    <p className="flex w-full items-center gap-2 rounded-tile bg-raised px-4 py-3 text-sm font-medium text-[var(--good)]">
                      <Check size={18} aria-hidden />Bonus earned! Come back tomorrow for a new word.
                    </p>
                  ) : (
                    <RecordButton
                      recording={recorder.recording}
                      busy={busy}
                      maxSeconds={15}
                      onStart={() => { setMessage(""); setBonus(null); recorder.start(); }}
                      onStop={recorder.stop}
                      label="Tap and say your sentence"
                      busyLabel="Checking…"
                    />
                  )}
                  {bonus && (
                    <div className="flex w-full flex-col gap-2">
                      <p className={cn("flex items-center gap-2 rounded-tile bg-raised px-4 py-3 text-sm font-medium", bonus.correct ? "text-[var(--good)]" : "text-[var(--bad)]")}>
                        {bonus.correct ? <Check size={18} aria-hidden /> : <X size={18} aria-hidden />}
                        {bonus.correct ? `+${bonus.xp} XP! ` : ""}{bonus.feedback}
                      </p>
                      <p className="text-sm text-fg-2">We heard: “{bonus.transcript}”</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>How to play</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-3 text-sm text-fg-2">
                  {[
                    "Type any five-letter word and press Guess.",
                    "Green means the letter is in the right place; orange means it's in the word but somewhere else.",
                    "Grey letters aren't in the word at all. Use the keyboard colours to plan your next guess.",
                    "After the game, say a sentence with the word for bonus XP.",
                  ].map((t, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-mint text-xs font-bold text-on-mint">{i + 1}</span>
                      {t}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {!state.finished && state.guesses.length > 0 && <LettersCard letters={letters} />}

          <ActivityAside
            kind="daily_word"
            tips={[
              "Start with a word that has common letters, like ARISE or STONE.",
              "Don't reuse grey letters: every guess should test something new.",
              "Stuck? Think of English words that fit the green letters, then say them out loud.",
            ]}
          />
        </div>
      </div>
    </Page>
  );
}

/** What you've learned so far: letters in the right place, in the word, and ruled out. */
function LettersCard({ letters }: { letters: Record<string, Tile> }) {
  const groups: { tile: Tile; title: string }[] = [
    { tile: "correct", title: "Right place" },
    { tile: "present", title: "In the word" },
    { tile: "absent", title: "Ruled out" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Letters so far</CardTitle>
        <CardDescription>Plan your next guess around these.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {groups.map(({ tile, title }) => {
          const found = Object.keys(letters).filter((ch) => letters[ch] === tile).sort();
          return (
            <div key={tile} className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-fg-2">{title}</p>
              {found.length ? (
                <ul className="flex flex-wrap gap-1.5" aria-label={title}>
                  {found.map((ch) => (
                    <li key={ch} className={cn("grid size-8 place-items-center rounded-lg text-sm font-bold uppercase", TILE_BG[tile])}>{ch}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-3">None yet</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function KeyButton({ state, wide, onClick, children }: { state?: Tile; wide?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      className={cn(
        "grid h-11 cursor-pointer place-items-center rounded-lg text-sm font-semibold uppercase transition active:scale-95",
        wide ? "min-w-14 px-2 text-xs" : "min-w-0 flex-1 max-w-9",
        state ? TILE_BG[state] : "bg-raised text-fg hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}
