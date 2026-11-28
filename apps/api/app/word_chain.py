import json
import random
import re
import time

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app import audio, azure_speech, daily_word, db, llm
from app.auth import current_user
from app.jam import FILLERS

router = APIRouter(prefix="/v1")

TURN_SECONDS = 15
GRACE_SECONDS = 10  # upload and transcription time on slow networks
WIN_AFTER = 10  # the learner wins after this many valid words
WIN_BONUS = 20
# The AI's words, all ending in common letters so the learner always has a fair next letter.
AI_WORDS = (
    "apple angle arrive animal answer artist basket banana bottle butter brave candle castle carrot circle cotton "
    "danger desert dinner doctor donkey eagle engine energy escape empty finger forest flower future garden giant "
    "guitar gentle hammer honest heart island insect idea jacket jungle juice kettle kitchen kingdom lemon letter "
    "little ladder mango market mirror monkey nature number needle noodle orange office ocean open pencil planet "
    "pepper purple quiet queen question rabbit river rocket ruler silver sister sugar summer table tiger tomato "
    "travel uncle umbrella under useful valley velvet visitor village water window winter wonder xylophone yellow "
    "yogurt young year zebra zero zone"
).split()


def spoken_word(transcript: str) -> str | None:
    """The learner's word: the last real word they said ("my word is tiger, umm" -> "tiger")."""
    words = [w for w in re.findall(r"[a-z]+", transcript.lower()) if w not in FILLERS]
    return words[-1] if words else None


def problem(word: str | None, letter: str, used: set[str]) -> str | None:
    """Why the word can't be played (before the dictionary check), or None if it can."""
    if not word or len(word) < 2:
        return "We didn't hear a word."
    if not word.startswith(letter):
        return f'"{word}" doesn\'t start with "{letter.upper()}".'
    if word in used:
        return f'"{word}" was already used.'
    return None


def points(word: str) -> int:
    """10 per word, plus 2 for every letter beyond four (longer words score more)."""
    return 10 + 2 * max(0, len(word) - 4)


def ai_reply(letter: str, used: set[str]) -> str | None:
    options = [w for w in AI_WORDS if w.startswith(letter) and w not in used]
    return random.choice(options) if options else None


def _row(con, game_id: int, user_id: int):
    row = con.execute("select * from word_chain_games where id = ? and user_id = ?", (game_id, user_id)).fetchone()
    if not row:
        raise HTTPException(404, "Game not found.")
    return row


def _state(row, user: dict, ai_audio: str | None = None, turn: dict | None = None) -> dict:
    words = json.loads(row["words"])
    xp = max(5, row["score"] // 5) if row["finished"] else 0
    return {"id": row["id"], "words": words, "score": row["score"], "next_letter": words[-1]["word"][-1] if words else None,
            "retry_used": bool(row["retry_used"]), "finished": bool(row["finished"]), "turn_seconds": TURN_SECONDS,
            "ai_audio": ai_audio, "turn": turn, "xp": xp}


def _finish(con, row, user: dict, score: int) -> None:
    con.execute("update word_chain_games set finished = 1, score = ? where id = ?", (score, row["id"]))
    words = [w for w in json.loads(row["words"]) if w["by"] == "you"]
    db.award(con, user["id"], "word_chain", score, max(5, score // 5), {"words": len(words)})


@router.post("/word-chain")
async def start(user: dict = Depends(current_user)):
    first = random.choice(AI_WORDS)
    with db.connect() as con:
        game_id = con.execute("insert into word_chain_games (user_id, words, turn_started) values (?, ?, ?) returning id",
                          (user["id"], json.dumps([{"word": first, "by": "ai", "points": 0}]), time.time())).fetchone()["id"]
        row = _row(con, game_id, user["id"])
    return _state(row, user, await azure_speech.speak_for(user, first, shared=True))


@router.post("/word-chain/{game_id}/turn")
async def turn(game_id: int, audio_file: UploadFile = File(..., alias="audio"), user: dict = Depends(current_user)):
    with db.connect() as con:
        row = _row(con, game_id, user["id"])
    if row["finished"]:
        raise HTTPException(409, "This game is over. Start a new one!")
    late = time.time() - row["turn_started"] > TURN_SECONDS + GRACE_SECONDS

    wav, _ = await audio.receive(audio_file, user, max_seconds=TURN_SECONDS + 2)
    heard = spoken_word(await llm.transcribe(wav))
    words = json.loads(row["words"])
    used = {w["word"] for w in words}
    letter = words[-1]["word"][-1]

    reason = "Time's up!" if late else problem(heard, letter, used)
    if not reason:
        exists, _ = await daily_word.dictionary(heard)
        # shortcut: if the dictionary service is down, the word is accepted.
        if exists is False:
            reason = f'"{heard}" isn\'t in the dictionary.'

    with db.connect() as con:
        row = _row(con, game_id, user["id"])
        if reason:
            if not late and not row["retry_used"]:
                con.execute("update word_chain_games set retry_used = 1, turn_started = ? where id = ?", (time.time(), game_id))
                return _state(_row(con, game_id, user["id"]), user, turn={"heard": heard, "ok": False, "reason": reason, "retry": True})
            _finish(con, row, user, row["score"])
            return _state(_row(con, game_id, user["id"]), user, turn={"heard": heard, "ok": False, "reason": reason, "retry": False})

        gained = points(heard)
        score = row["score"] + gained
        words.append({"word": heard, "by": "you", "points": gained})
        used.add(heard)
        reply = ai_reply(heard[-1], used) if sum(w["by"] == "you" for w in words) < WIN_AFTER else None
        if reply:
            words.append({"word": reply, "by": "ai", "points": 0})
        con.execute("update word_chain_games set words = ?, score = ?, turn_started = ? where id = ?",
                    (json.dumps(words), score, time.time(), game_id))
        if not reply:  # the AI is out of words, or the learner reached the goal
            score += WIN_BONUS
            _finish(con, _row(con, game_id, user["id"]), user, score)
        row = _row(con, game_id, user["id"])
    ai_audio = await azure_speech.speak_for(user, reply, shared=True) if reply else None
    return _state(row, user, ai_audio, {"heard": heard, "ok": True, "points": gained, "won": not reply})


@router.post("/word-chain/{game_id}/stop")
def stop(game_id: int, user: dict = Depends(current_user)):
    with db.connect() as con:
        row = _row(con, game_id, user["id"])
        if not row["finished"]:
            _finish(con, row, user, row["score"])
        return _state(_row(con, game_id, user["id"]), user)
