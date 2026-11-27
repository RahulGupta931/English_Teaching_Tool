// Shared by Home and Games. The API stores activity times in UTC as "YYYY-MM-DD HH:MM:SS".
export const when = (utc: string) => new Date(utc.replace(" ", "T") + "Z");
export const localDay = (utc: string) => when(utc).toDateString();

export function ago(utc: string) {
  const min = Math.round((Date.now() - when(utc).getTime()) / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.round(min / 60)} h ago`;
  return when(utc).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Activity kinds the API records (db.award). */
export const KINDS: Record<string, string> = {
  roleplay: "Role-play", coach: "Mistake Coach", jam: "JAM", daily_word: "Daily Word", daily_word_bonus: "Daily Word bonus",
  word_chain: "Word Chain", tongue_twister: "Tongue Twister", quiz: "MCQ Quiz", placement: "Placement Test",
};

/** Kinds of activity done today (local time). */
export const doneToday = (activities: { kind: string; created_at: string }[]) => {
  const today = new Date().toDateString();
  return new Set(activities.filter((a) => localDay(a.created_at) === today).map((a) => a.kind));
};
