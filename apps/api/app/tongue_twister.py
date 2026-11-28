import random
import re
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app import audio, azure_speech, db, llm
from app.auth import current_user
from app.errors import ProviderFailed, ProviderUnavailable

router = APIRouter(prefix="/v1")

# The starting pool; the AI adds DAILY_NEW more each day.
TWISTERS = [
    "Red lorry, yellow lorry.",
    "Fresh fried fish.",
    "Three free throws.",
    "She sells seashells by the seashore.",
    "Very well, very well, wonderful weather.",
    "Big black bugs bleed blue black blood.",
    "Six sticky skeletons sat on six slippery stones.",
    "I saw Susie sitting in a shoeshine shop.",
    "Fred fed Ted bread, and Ted fed Fred bread.",
    "How can a clam cram in a clean cream can?",
    "Peter Piper picked a peck of pickled peppers.",
    "The thirty-three thieves thought that they thrilled the throne throughout Thursday.",
    "Whether the weather is warm, whether the weather is hot, we have to put up with the weather, whether we like it or not.",
    "How much wood would a woodchuck chuck if a woodchuck could chuck wood?",
    "Betty Botter bought some butter, but she said the butter's bitter, if I put it in my batter, it will make my batter bitter.",
]
LEVELS = 15
PASS_ACCURACY = 80  # needed to unlock the next level


def words_of(text: str) -> list[str]:
    return re.findall(r"[a-z']+", text.lower().replace("-", " "))


def target_seconds(level: int, text: str) -> float:
    # About 2.5 words a second at level 1, rising to about 4 at the last level.
    rate = 2.5 + 1.5 * (level - 1) / (LEVELS - 1)
    return len(words_of(text)) / rate


def score_attempt(text: str, transcript: str, duration: float, level: int) -> dict:
    """Word-match accuracy x speed bonus, accuracy weighted more (stand-in until pronunciation scoring)."""
    target, said = words_of(text), words_of(transcript)
    hit = [False] * len(target)
    for block in SequenceMatcher(None, target, said, autojunk=False).get_matching_blocks():
        for i in range(block.a, block.a + block.size):
            hit[i] = True
    # Extra words (stumbles, restarts) count against accuracy too.
    accuracy = round(100 * sum(hit) / max(len(target), len(said), 1))
    speed = min(1.0, target_seconds(level, text) / duration) if duration else 0.0
    score = round(accuracy * (0.75 + 0.25 * speed))
    return {"accuracy": accuracy, "speed": round(speed * 100), "score": score,
            "words": [{"word": w, "hit": h} for w, h in zip(target, hit)], "passed": accuracy >= PASS_ACCURACY}


DAILY_NEW = 15  # the AI adds this many to the pool each day


def clean_twisters(raw) -> list[str]:
    """Usable AI twisters: 3-35 words, no duplicates."""
    seen, out = set(), []
    for t in raw if isinstance(raw, list) else []:
        if isinstance(t, str) and 3 <= len(words_of(t)) <= 35 and len(t) <= 250 and t.lower() not in seen:
            seen.add(t.lower())
            out.append(" ".join(t.split()))
    return out[:DAILY_NEW]


async def _write_twisters() -> list[str]:
    try:
        reply = await llm.chat_json(
            "You write fresh, original English tongue twisters for Indian learners practising pronunciation. Target "
            "sounds they find hard: v/w, th, s/sh, z/j, r/l, p/f and short/long vowels. Family-friendly, real English "
            'words only, and not famous existing twisters. Reply in JSON: {"twisters": [strings]}, '
            "from very short (3 words) to long (30 words).",
            f"Write {DAILY_NEW} different tongue twisters. Variety seed: {db.today().isoformat()}.",
        )
        twisters = clean_twisters(reply.get("twisters"))
        if twisters and not await llm.is_flagged(" / ".join(twisters)):
            return twisters
    except (ProviderFailed, ProviderUnavailable):
        pass
    return []


async def pool() -> list[dict]:
    """Every twister so far, easiest (shortest) first. The first visit each day adds the AI's new ones."""
    day = db.today().isoformat()
    with db.connect() as con:
        con.executemany("insert into twisters (text, added) values (?, 'builtin') on conflict do nothing", [(t,) for t in TWISTERS])
        added_today = con.execute("select 1 from twisters where added = ?", (day,)).fetchone()
    if not added_today:
        # If the AI is down nothing is added, and the next visit tries again.
        new = await _write_twisters()
        with db.connect() as con:
            con.executemany("insert into twisters (text, added) values (?, ?) on conflict do nothing", [(t, day) for t in new])
    with db.connect() as con:
        rows = [dict(r) for r in con.execute("select id, text from twisters")]
    return sorted(rows, key=lambda r: (len(words_of(r["text"])), r["id"]))


def band(rows: list[dict], level: int) -> list[dict]:
    """The pool split into equal slices by length: level 1 is the shortest slice, the last level the longest."""
    n = len(rows)
    return rows[(level - 1) * n // LEVELS:level * n // LEVELS] or rows[:1]


def _check_level(level: int) -> None:
    if not 1 <= level <= LEVELS:
        raise HTTPException(404, "No such level.")


@router.get("/tongue-twister/{level}")
async def twister(level: int, user: dict = Depends(current_user)):
    _check_level(level)
    rows = await pool()
    pick = random.choice(band(rows, level))
    return {"level": level, "levels": LEVELS, "id": pick["id"], "text": pick["text"], "pool_size": len(rows),
            "target_seconds": round(target_seconds(level, pick["text"]), 1),
            "audio": await azure_speech.speak_for(user, pick["text"], shared=True)}


@router.post("/tongue-twister/{level}")
async def attempt(level: int, twister_id: int = Form(...), audio_file: UploadFile = File(..., alias="audio"),
                  user: dict = Depends(current_user)):
    _check_level(level)
    with db.connect() as con:
        row = con.execute("select text from twisters where id = ?", (twister_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Twister not found.")
    text = row["text"]
    wav, duration = await audio.receive(audio_file, user, max_seconds=20)
    transcript = await llm.transcribe(wav)
    result = score_attempt(text, transcript, duration, level)
    xp = max(5, result["score"] // 5)
    with db.connect() as con:
        db.award(con, user["id"], "tongue_twister", result["score"], xp, {"level": level, "twister_id": twister_id})
    return {**result, "transcript": transcript, "seconds": round(duration, 1), "xp": xp,
            "next_level": level + 1 if result["passed"] and level < LEVELS else None}
