import asyncio
import json
import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import daily_word, db, llm
from app.auth import current_user
from app.errors import ProviderFailed, ProviderUnavailable

router = APIRouter(prefix="/v1")

QUESTIONS = 10
FROM_BANK, FROM_AI, FROM_VOCAB = 4, 3, 3  # any source that fails is filled from the bank
XP_PER_CORRECT = 2

# (level, question, [correct answer first, then wrong ones], explanation). Options are shuffled when served.
BANK = [
    ("beginner", "She ___ to school every day.", ["goes", "go", "going", "gone"], "With he/she/it in the present simple, add -s or -es to the verb."),
    ("beginner", "I have ___ apple in my bag.", ["an", "a", "the", "some"], "Use 'an' before a vowel sound: an apple."),
    ("beginner", "They ___ playing cricket now.", ["are", "is", "am", "be"], "'They' takes 'are' in the present continuous."),
    ("beginner", "My birthday is ___ March.", ["in", "on", "at", "to"], "Use 'in' with months and years."),
    ("beginner", "The meeting is ___ Monday.", ["on", "in", "at", "by"], "Use 'on' with days and dates."),
    ("beginner", "We will meet ___ 6 o'clock.", ["at", "on", "in", "for"], "Use 'at' with clock times."),
    ("beginner", "There ___ two books on the table.", ["are", "is", "was", "be"], "Use 'are' with plural nouns after 'there'."),
    ("beginner", "He ___ like spicy food.", ["doesn't", "don't", "isn't", "not"], "With he/she/it, the negative is 'doesn't' + verb."),
    ("beginner", "Yesterday I ___ a film.", ["watched", "watch", "watching", "watches"], "Use the past simple for finished actions with 'yesterday'."),
    ("beginner", "This is ___ bag. It belongs to me.", ["my", "me", "mine", "I"], "Use 'my' before a noun to show it belongs to you."),
    ("beginner", "How ___ water do you drink?", ["much", "many", "lot", "few"], "Use 'much' with uncountable nouns like water."),
    ("beginner", "She is ___ than her brother.", ["taller", "tallest", "more tall", "tall"], "Short adjectives add -er to compare two things."),
    ("beginner", "Choose the correct sentence.", ["Where do you live?", "Where you live?", "Where you do live?", "Where does you live?"], "Questions in the present simple use do/does before the subject."),
    ("beginner", "I ___ a doctor.", ["am", "is", "are", "be"], "'I' always takes 'am'."),
    ("intermediate", "I ___ here since 2020.", ["have lived", "live", "am living", "lived"], "Use the present perfect with 'since' for something that started in the past and continues."),
    ("intermediate", "If it rains, we ___ at home.", ["will stay", "would stay", "stayed", "stay will"], "First conditional: if + present, will + verb."),
    ("intermediate", "She asked me where ___.", ["I lived", "did I live", "do I live", "I do live"], "Reported questions use normal word order, without do/did."),
    ("intermediate", "I'm looking forward to ___ you.", ["meeting", "meet", "met", "be meeting"], "'Look forward to' is followed by the -ing form."),
    ("intermediate", "He is good ___ maths.", ["at", "in", "on", "with"], "We say 'good at' a subject or skill."),
    ("intermediate", "Please discuss ___ with your manager.", ["it", "about it", "on it", "regarding about it"], "'Discuss' takes a direct object; don't add 'about'."),
    ("intermediate", "I ___ to Goa last year.", ["went", "have gone", "have been", "go"], "Use the past simple with a finished time like 'last year'."),
    ("intermediate", "The report ___ by the team yesterday.", ["was written", "was wrote", "is written", "wrote"], "Passive past: was/were + past participle."),
    ("intermediate", "Can you tell me what time ___?", ["it is", "is it", "it be", "does it"], "In indirect questions the subject comes before the verb."),
    ("intermediate", "I don't have ___ money left.", ["any", "some", "many", "a"], "Use 'any' in negative sentences."),
    ("intermediate", "She's the person ___ helped me.", ["who", "which", "whom", "whose"], "Use 'who' for people when they are the subject."),
    ("intermediate", "You ___ wear a helmet. It's the law.", ["must", "might", "could", "would"], "'Must' shows a strong rule or obligation."),
    ("intermediate", "Choose the correct sentence.", ["I have been waiting for an hour.", "I am waiting since an hour.", "I am waiting from one hour.", "I waited since one hour."], "For an action continuing up to now, use the present perfect continuous with 'for'."),
    ("intermediate", "He made me ___ the form again.", ["fill", "to fill", "filling", "filled"], "'Make someone do' uses the base verb without 'to'."),
    ("advanced", "If I ___ known, I would have helped.", ["had", "have", "would have", "was"], "Third conditional: if + past perfect, would have + past participle."),
    ("advanced", "Hardly ___ arrived when it started to rain.", ["had we", "we had", "did we", "we have"], "After 'hardly' at the start, invert the subject and auxiliary."),
    ("advanced", "I'd rather you ___ smoke here.", ["didn't", "don't", "won't", "not"], "'I'd rather + someone' is followed by the past simple."),
    ("advanced", "She denied ___ the money.", ["taking", "to take", "take", "to have take"], "'Deny' is followed by the -ing form."),
    ("advanced", "Not only ___ late, but he also forgot the file.", ["was he", "he was", "he is", "did he was"], "After 'not only' at the start, invert the subject and verb."),
    ("advanced", "It's high time we ___ a decision.", ["made", "make", "will make", "have made"], "'It's high time' is followed by the past simple."),
    ("advanced", "The project, ___ was delayed, is now complete.", ["which", "that", "what", "who"], "Use 'which' (not 'that') in a non-defining clause with commas."),
    ("advanced", "By next June, I ___ here for ten years.", ["will have worked", "will work", "am working", "have worked"], "Future perfect: will have + past participle, for something finished by a future time."),
    ("advanced", "Choose the most natural sentence.", ["I look forward to hearing from you.", "I am looking forward to hear from you.", "I look forward to hear from you.", "Looking forward for your reply."], "'Look forward to' takes the -ing form; this is the standard email closing."),
    ("advanced", "Neither the manager nor the employees ___ aware.", ["were", "was", "is", "has been"], "With 'neither...nor', the verb agrees with the nearer subject (employees, plural)."),
    ("advanced", "He suggested ___ a break.", ["taking", "to take", "take", "took"], "'Suggest' is followed by the -ing form, not 'to' + verb."),
    ("advanced", "Choose the correct word: The news ___ surprising.", ["was", "were", "are", "have been"], "'News' is uncountable and takes a singular verb."),
]
LEVELS = ("beginner", "intermediate", "advanced")
# Vocabulary: (word, part of speech, learner-friendly meaning). Meanings are written here, not taken from the
# dictionary, whose first definition is often a rare or old sense (e.g. "eager": "sharp; sour").
VOCAB = [
    ("abundant", "adjective", "existing in large amounts; more than enough"),
    ("accurate", "adjective", "correct and exact, without mistakes"),
    ("adapt", "verb", "to change to suit a new situation"),
    ("ambition", "noun", "a strong wish to achieve something"),
    ("anxious", "adjective", "worried and nervous about something"),
    ("brief", "adjective", "lasting only a short time"),
    ("cautious", "adjective", "careful to avoid danger or mistakes"),
    ("confident", "adjective", "sure of yourself and your abilities"),
    ("curious", "adjective", "wanting to know or learn about something"),
    ("decline", "verb", "to politely refuse an offer or invitation"),
    ("eager", "adjective", "wanting very much to do or have something"),
    ("efficient", "adjective", "working well without wasting time or energy"),
    ("essential", "adjective", "completely necessary; extremely important"),
    ("fragile", "adjective", "easily broken or damaged"),
    ("generous", "adjective", "happy to give money, time or help to others"),
    ("genuine", "adjective", "real; truly what it seems to be"),
    ("humble", "adjective", "not proud; not thinking you are better than others"),
    ("ignore", "verb", "to pay no attention to someone or something"),
    ("inspire", "verb", "to make someone want to do something good"),
    ("loyal", "adjective", "always supporting a person, group or idea"),
    ("modest", "adjective", "not talking much about your own achievements"),
    ("narrow", "adjective", "small from one side to the other"),
    ("obvious", "adjective", "easy to see or understand"),
    ("patient", "adjective", "able to wait calmly without getting upset"),
    ("polite", "adjective", "behaving with good manners and respect"),
    ("precise", "adjective", "exact and clear in every detail"),
    ("rapid", "adjective", "happening very quickly"),
    ("reliable", "adjective", "able to be trusted to do what is expected"),
    ("rescue", "verb", "to save someone from danger"),
    ("sincere", "adjective", "honest; really meaning what you say"),
    ("strict", "adjective", "making sure rules are always obeyed"),
    ("summary", "noun", "a short statement of the main points"),
    ("temporary", "adjective", "lasting only for a limited time"),
    ("urgent", "adjective", "needing attention immediately"),
    ("vague", "adjective", "not clear or detailed"),
    ("vivid", "adjective", "very bright, clear or detailed"),
    ("wander", "verb", "to walk around slowly without a clear purpose"),
    ("wealthy", "adjective", "having a lot of money"),
    ("wisdom", "noun", "good judgement that comes from knowledge and experience"),
    ("hesitate", "verb", "to pause before doing or saying something because you are unsure"),
    ("punctual", "adjective", "arriving or doing something at the agreed time"),
    ("flexible", "adjective", "able to change easily to suit different situations"),
    ("habit", "noun", "something you do often, almost without thinking"),
    ("deadline", "noun", "the latest time by which something must be done"),
    ("opportunity", "noun", "a chance to do something good or useful"),
]
GRAMMAR_TOPICS = ["tenses", "articles", "prepositions", "subject-verb agreement", "modal verbs", "conditionals",
                  "passive voice", "reported speech", "gerunds and infinitives", "question forms", "comparatives",
                  "phrasal verbs", "countable and uncountable nouns", "common Indian English mistakes", "word order"]


class Answers(BaseModel):
    answers: list[int | None]


def _shuffled(source: str, question: str, options: list[str], explanation: str) -> dict:
    order = random.sample(range(len(options)), len(options))
    return {"source": source, "question": question, "options": [options[i] for i in order],
            "answer": order.index(0), "explanation": explanation}


def bank_questions(level: str | None, n: int) -> list[dict]:
    """Questions at the learner's level first, then the nearest others."""
    own = level if level in LEVELS else "intermediate"
    near = sorted(LEVELS, key=lambda lv: abs(LEVELS.index(lv) - LEVELS.index(own)))
    picked = []
    for lv in near:
        pool = [q for q in BANK if q[0] == lv]
        picked += random.sample(pool, min(len(pool), n - len(picked)))
        if len(picked) >= n:
            break
    return [_shuffled("grammar", q, options, why) for _, q, options, why in picked]


def clean_ai_questions(raw) -> list[dict]:
    """Keep only well-formed AI questions: 4 distinct options and a valid answer index."""
    out = []
    for q in raw if isinstance(raw, list) else []:
        if not isinstance(q, dict):
            continue
        options, answer = q.get("options"), q.get("answer")
        if (isinstance(q.get("question"), str) and q["question"].strip() and isinstance(options, list)
                and len(options) == 4 and all(isinstance(o, str) and o.strip() for o in options)
                and len({o.strip().lower() for o in options}) == 4 and isinstance(answer, int) and 0 <= answer < 4):
            ordered = [options[answer]] + [o for i, o in enumerate(options) if i != answer]
            out.append(_shuffled("grammar", q["question"].strip()[:300], [o.strip()[:150] for o in ordered],
                                 str(q.get("explanation", ""))[:300]))
    return out


async def ai_questions(user: dict, n: int) -> list[dict]:
    if n <= 0:
        return []
    topics = ", ".join(random.sample(GRAMMAR_TOPICS, 3))
    try:
        reply = await llm.chat_json(
            "You write multiple-choice English grammar and usage questions for an Indian learner. Reply in JSON: "
            '{"questions": [{"question": a sentence with ___ for the gap, or a short instruction, '
            '"options": exactly 4 short options, "answer": index 0-3 of the only correct option, '
            '"explanation": one short sentence on why}]}. Make each question different, unambiguous and natural. '
            f"Write explanations in {llm.explain_language(user)}.",
            f"Write {n + 2} questions for a {user['level'] or 'intermediate'} learner. Topics: {topics}. "
            f"Variety seed: {random.randint(1, 10**6)}.",
        )
        questions = clean_ai_questions(reply.get("questions"))
        return (await verified(questions))[:n]
    except (ProviderFailed, ProviderUnavailable):
        return []


async def verified(questions: list[dict]) -> list[dict]:
    """Keep only questions the AI answers the same way when solving them fresh, without the answer key.

    A wrong or ambiguous question usually gets a different answer the second time, so it is dropped (the bank fills in).
    """
    if not questions:
        return []
    listing = "\n\n".join(f"{i + 1}. {q['question']}\n" + "\n".join(f"{j}) {o}" for j, o in enumerate(q["options"]))
                           for i, q in enumerate(questions))
    reply = await llm.chat_json(
        "You are an expert English teacher. Solve each multiple-choice question. If a question has no single clearly "
        'correct option, answer -1 for it. Reply in JSON: {"answers": [option number for each question, in order]}.',
        listing,
    )
    answers = reply.get("answers")
    if not isinstance(answers, list):
        return []
    return [q for q, a in zip(questions, answers) if a == q["answer"]]


def _example(entry: dict | None, part: str, word: str) -> str | None:
    """An example sentence from the Free Dictionary API, for the right part of speech."""
    for m in (entry or {}).get("meanings", []):
        if m.get("partOfSpeech") == part:
            for d in m.get("definitions", []):
                ex = (d.get("example") or "").strip()
                if word in ex.lower() and len(ex) <= 160:
                    return ex
    return None


async def vocabulary_questions(n: int) -> list[dict]:
    """Meaning questions from the built-in list; the dictionary adds an example sentence when it has one."""
    if n <= 0:
        return []
    picked = random.sample(VOCAB, n)
    entries = await asyncio.gather(*(daily_word.dictionary(w) for w, _, _ in picked))
    out = []
    for (word, part, meaning), (_, entry) in zip(picked, entries):
        wrong = random.sample([m for w, p, m in VOCAB if w != word and p == part], 3)
        example = _example(entry, part, word)
        out.append(_shuffled("vocabulary", f'What does "{word}" ({part}) mean?', [meaning, *wrong],
                             f'"{word}" means: {meaning}.' + (f' Example: "{example}"' if example else "")))
    return out


def grade(questions: list[dict], answers: list[int | None]) -> tuple[int, list[dict]]:
    results = []
    for i, q in enumerate(questions):
        chosen = answers[i] if i < len(answers) else None
        results.append({"chosen": chosen, "answer": q["answer"], "correct": chosen == q["answer"],
                        "explanation": q["explanation"]})
    return sum(r["correct"] for r in results), results


def _public(q: dict) -> dict:
    return {"source": q["source"], "question": q["question"], "options": q["options"]}


@router.post("/quiz")
async def start(user: dict = Depends(current_user)):
    ai, vocab = await asyncio.gather(ai_questions(user, FROM_AI), vocabulary_questions(FROM_VOCAB))
    grammar = bank_questions(user["level"], QUESTIONS - len(ai) - len(vocab))
    questions = grammar + ai
    random.shuffle(questions)
    questions += vocab  # vocabulary round at the end
    with db.connect() as con:
        quiz_id = con.execute("insert into quiz_sessions (user_id, questions) values (?, ?) returning id",
                             (user["id"], json.dumps(questions))).fetchone()["id"]
    return {"id": quiz_id, "questions": [_public(q) for q in questions]}


@router.post("/quiz/{quiz_id}")
def submit(quiz_id: int, body: Answers, user: dict = Depends(current_user)):
    with db.connect() as con:
        row = con.execute("select * from quiz_sessions where id = ? and user_id = ?", (quiz_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(404, "Quiz not found.")
        if row["finished"]:
            raise HTTPException(409, "You've already submitted this quiz.")
        questions = json.loads(row["questions"])
        correct, results = grade(questions, body.answers)
        score = round(100 * correct / len(questions))
        xp = correct * XP_PER_CORRECT
        wrong = [
            {"type": q["source"], "original": f"{q['question']} → {q['options'][r['chosen']]}",
             "correction": q["options"][q["answer"]], "explanation": q["explanation"] or "Review this one."}
            for q, r in zip(questions, results) if not r["correct"] and r["chosen"] is not None and 0 <= r["chosen"] < 4
        ]
        con.execute("update quiz_sessions set finished = 1 where id = ?", (quiz_id,))
        mistakes = db.save_mistakes(con, user["id"], "quiz", wrong)
        db.award(con, user["id"], "quiz", score, xp, {"correct": correct})
    return {"correct": correct, "total": len(questions), "score": score, "xp": xp, "results": results, "mistakes": mistakes}
