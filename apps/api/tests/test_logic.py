from datetime import date

import pytest

from app import audio, azure_speech, db
from app.daily_word import evaluate
from app.jam import speech_metrics
from app.placement import placement_level


def test_evaluate_handles_repeated_letters():
    assert evaluate("apple", "apple") == ["correct"] * 5
    # Only one 'l' in the answer, so the second 'l' in the guess is absent.
    assert evaluate("hello", "world") == ["absent", "absent", "absent", "correct", "present"]
    assert evaluate("eerie", "there") == ["present", "absent", "present", "absent", "correct"]


def test_next_streak():
    day = date(2026, 11, 17)
    assert db.next_streak(0, None, day) == 1
    assert db.next_streak(4, "2026-11-17", day) == 4
    assert db.next_streak(4, "2026-11-16", day) == 5
    assert db.next_streak(4, "2026-11-10", day) == 1


def test_placement_level():
    assert placement_level([90, 85, 70]) == "advanced"
    assert placement_level([70, 55, 65]) == "intermediate"
    assert placement_level([40, 50, 60]) == "beginner"


def test_speech_metrics():
    m = speech_metrics("Umm I I like basically love cricket", 30, 1)
    assert m["filler_count"] == 3
    assert m["repetitions"] == 1
    assert m["long_pauses"] == 1
    assert m["words_per_minute"] == 14


def test_save_mistakes_keeps_only_well_formed():
    with db.connect() as con:
        con.execute("insert into users (name, birth_year) values ('a', 2000)")
        kept = db.save_mistakes(con, 1, "jam", [
            {"type": "grammar", "original": "he go", "correction": "he goes", "explanation": "third person"},
            {"type": "grammar", "original": "missing fields"},
            "not a dict",
        ])
    assert [m["original"] for m in kept] == ["he go"]


def test_ssml_rate_only_for_standard_voices(monkeypatch):
    monkeypatch.setenv("AZURE_TTS_RATE", "+10%")
    monkeypatch.setenv("AZURE_TTS_VOICE", "en-IN-NeerjaNeural")
    assert "<prosody rate=\"+10%\">Tom &amp; Jerry</prosody>" in azure_speech.ssml("Tom & Jerry")
    monkeypatch.setenv("AZURE_TTS_VOICE", "en-IN-Neerja:DragonHDLatestNeural")
    out = azure_speech.ssml("Hi")
    assert "prosody" not in out and "name=\"en-IN-Neerja:DragonHDLatestNeural\"" in out


def test_plain_speech_strips_symbols():
    from app.llm import plain_speech
    raw = "**Great!** 😊 Tell me:\n1. Your _role_\n- Your [project](http://x.io)\n# Done"
    assert plain_speech(raw) == "Great! Tell me: Your role. Your project. Done."
    assert plain_speech("I have 2.5 years and scored 90%.") == "I have 2.5 years and scored 90%."
    assert plain_speech("About 2-3 years in R & D") == "About 2 to 3 years in R and D."


def test_trim_silence_and_long_pauses():
    from conftest import make_wav
    wav = make_wav(pattern=[(1, False), (1, True), (2, False), (1, True), (0.5, False), (1, True), (1, False)])
    trimmed = audio.trim_silence(audio._frames(wav))
    assert 5.4 <= len(trimmed) / audio.BYTES_PER_SECOND <= 6.0  # 5.5 s of speech and gaps + 0.2 s padding each side
    assert audio.long_pauses(wav) == 1  # the 2 s gap counts; the 0.5 s gap and the edges don't


def test_shared_audio_generated_once(monkeypatch):
    import asyncio
    calls = []

    async def speak(text):
        calls.append(text)
        return "mp3"
    monkeypatch.setattr(azure_speech, "speak", speak)
    azure_speech._cache.clear()
    paid, free = {"plan": {"azure_voice": 1}}, {"plan": {"azure_voice": 0}}
    for _ in range(3):
        assert asyncio.run(azure_speech.speak_for(paid, "apple", shared=True)) == "mp3"
    assert asyncio.run(azure_speech.speak_for(free, "apple", shared=True)) is None
    assert calls == ["apple"]


def test_hinglish_words_spoken_in_hindi_script():
    from app.hinglish import by_list
    assert by_list("Main theek hoon, but kal baat karte hain.") == "मैं ठीक हूँ, but कल बात करते हैं."
    assert by_list("Mai aaj busy hoon! Aage chalo.") == "मैं आज busy हूँ! आगे चलो."
    assert by_list("The main idea is clear.") == "The main idea is clear."  # one match only: English left alone
    assert by_list("Great job! Try the past tense.") == "Great job! Try the past tense."


def test_hinglish_ai_uses_context_with_word_list_fallback(monkeypatch):
    import asyncio
    from app import hinglish, llm
    from app.errors import ProviderFailed
    reply = {"text": "मुझे थोड़ा पानी दो, but I do yoga."}

    async def chat(system, messages):
        if isinstance(reply["text"], Exception):
            raise reply["text"]
        return reply["text"]
    monkeypatch.setattr(llm, "chat", chat)
    speak = lambda t: asyncio.run(hinglish.for_speech(t))
    assert speak("Mujhe thoda paani do, but I do yoga.") == "मुझे थोड़ा पानी दो, but I do yoga."  # AI: Hindi do vs English do
    assert speak("The main idea is clear.") == "The main idea is clear."  # English: no AI call needed
    reply["text"] = ProviderFailed("down")
    assert speak("Aage chalo, bahut accha.") == "आगे चलो, बहुत अच्छा."  # AI down: word list
    reply["text"] = "Let's go ahead, very good."  # AI translated instead: rejected, word list used
    assert speak("Aage chalo, bahut accha.") == "आगे चलो, बहुत अच्छा."


def test_tts_provider_switch_and_azure_fallback(monkeypatch):
    import asyncio
    import base64
    import json
    import httpx
    hits, plivo_ok = [], [True]

    def handler(request):
        if "plivo" in request.url.host:
            hits.append(("plivo", json.loads(request.content)["voice_id"]))
            return httpx.Response(200 if plivo_ok[0] else 500, content=b"PLIVO")
        hits.append(("azure", None))
        return httpx.Response(200, content=b"AZURE")
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(azure_speech, "_client", lambda: client)
    for k, v in {"PLIVO_AUTH_ID": "id", "PLIVO_AUTH_TOKEN": "t", "AZURE_SPEECH_KEY": "k", "AZURE_SPEECH_REGION": "r"}.items():
        monkeypatch.setenv(k, v)
    monkeypatch.delenv("TTS_PROVIDER", raising=False)
    monkeypatch.delenv("PLIVO_TTS_VOICE_HINDI", raising=False)
    said = lambda text: base64.b64decode(asyncio.run(azure_speech.speak(text)))
    assert said("आज का lesson") == b"PLIVO" and hits == [("plivo", "6uWzc4xFj31t4jNJUaED")]  # default plivo, Hindi voice
    plivo_ok[0] = False
    assert said("Hi") == b"AZURE"  # Plivo failed: Azure fallback
    hits.clear()
    monkeypatch.setenv("TTS_PROVIDER", "azure")
    assert said("Hi") == b"AZURE" and hits == [("azure", None)]  # azure skips Plivo


def test_hindi_text_uses_a_hindi_voice(monkeypatch):
    monkeypatch.setenv("AZURE_TTS_VOICE", "en-IN-AartiNeural")
    monkeypatch.delenv("AZURE_TTS_VOICE_HINDI", raising=False)
    assert "en-IN-AartiNeural" in azure_speech.ssml("Tell me about yourself.")
    hindi = azure_speech.ssml("ठीक है, let's continue.")
    assert "hi-IN-SwaraNeural" in hindi and "xml:lang=\"hi-IN\"" in hindi
    monkeypatch.setenv("AZURE_TTS_VOICE", "en-IN-Neerja:DragonHDLatestNeural")  # multilingual: keeps its voice
    assert "en-IN-Neerja:DragonHDLatestNeural" in azure_speech.ssml("ठीक है")


def test_help_rule_follows_explanation_language():
    from app.roleplay import _help_rule
    hinglish = {"explain_lang": "hinglish", "level": "intermediate"}
    assert "Hinglish" in _help_rule(hinglish)
    assert "Hinglish" not in _help_rule({**hinglish, "level": "advanced"})  # advanced: English only
    assert "Hinglish" not in _help_rule({"explain_lang": "english", "level": None})


def test_word_chain_rules():
    from app.word_chain import AI_WORDS, ai_reply, points, problem, spoken_word
    assert spoken_word("My word is Tiger, umm.") == "tiger" and spoken_word("umm") is None
    assert problem("tiger", "t", set()) is None
    assert "start" in problem("apple", "t", set()) and "already" in problem("tiger", "t", {"tiger"})
    assert points("cat") == 10 and points("elephant") == 18
    assert ai_reply("z", {"zebra", "zero"}) == "zone" and ai_reply("z", {"zebra", "zero", "zone"}) is None
    assert all(ai_reply(c, set()) for c in "abcdefghijklmnopqrstuvwxyz")  # the AI can always answer a fresh letter
    assert len(set(AI_WORDS)) == len(AI_WORDS)


def test_tongue_twister_scoring():
    from app.tongue_twister import TWISTERS, score_attempt
    text = "Red lorry, yellow lorry."
    perfect = score_attempt(text, "red lorry yellow lorry", 1.0, 1)
    assert perfect["accuracy"] == 100 and perfect["score"] == 100 and perfect["passed"]
    slow = score_attempt(text, "red lorry yellow lorry", 10.0, 1)
    assert slow["accuracy"] == 100 and 75 <= slow["score"] < 100  # accuracy carries more weight than speed
    missed = score_attempt(text, "red lolly yellow lorry", 1.0, 1)
    assert missed["accuracy"] == 75 and not missed["passed"] and [w["hit"] for w in missed["words"]] == [True, False, True, True]
    assert score_attempt(text, "red red lorry yellow lorry", 1.0, 1)["accuracy"] == 80  # stumbles count
    assert len(TWISTERS) >= 10


def test_quiz_bank_and_grading():
    from app.quiz import BANK, LEVELS, bank_questions, clean_ai_questions, grade
    assert all(lv in LEVELS and len(opts) == 4 and len(set(opts)) == 4 and why for lv, _, opts, why in BANK)
    qs = bank_questions("advanced", 10)
    assert len(qs) == 10 and sum(q["question"] in {b[1] for b in BANK if b[0] == "advanced"} for q in qs) >= 8
    assert all(q["options"][q["answer"]] == next(b[2][0] for b in BANK if b[1] == q["question"] and b[2][0] in q["options"]) for q in qs)
    cleaned = clean_ai_questions([
        {"question": "I ___ tea.", "options": ["likes", "like", "liking", "liked"], "answer": 1, "explanation": "I + base verb"},
        {"question": "Bad", "options": ["a", "a", "b", "c"], "answer": 0},  # duplicate options
        {"question": "Bad", "options": ["a", "b", "c", "d"], "answer": 4},  # answer out of range
        "junk",
    ])
    assert len(cleaned) == 1 and cleaned[0]["options"][cleaned[0]["answer"]] == "like"
    correct, results = grade(cleaned * 2, [cleaned[0]["answer"], None])
    assert correct == 1 and results[1]["correct"] is False


def test_quiz_vocabulary_uses_curated_meanings():
    import asyncio
    from app import daily_word
    from app.quiz import VOCAB, vocabulary_questions

    async def dictionary(word):  # an old, rare first sense must not become the answer
        return True, {"meanings": [{"partOfSpeech": "adjective", "definitions": [{"definition": "Sharp; sour; acid."}]}]}
    daily_word.dictionary, original = dictionary, daily_word.dictionary
    try:
        qs = asyncio.run(vocabulary_questions(3))
    finally:
        daily_word.dictionary = original
    meanings = {f'What does "{w}" ({p}) mean?': m for w, p, m in VOCAB}
    for q in qs:
        assert q["options"][q["answer"]] == meanings[q["question"]] and "Sharp" not in " ".join(q["options"])
    for part in {p for _, p, _ in VOCAB}:
        assert sum(p == part for _, p, _ in VOCAB) >= 4  # enough same-type wrong options


def test_quiz_drops_questions_the_checker_disagrees_with(monkeypatch):
    import asyncio
    from app import llm
    from app.quiz import verified
    qs = [{"question": f"Q{i}", "options": ["a", "b", "c", "d"], "answer": 1, "explanation": ""} for i in range(3)]

    async def checker(system, user):
        return {"answers": [1, 3, -1]}  # agrees, disagrees, says ambiguous
    monkeypatch.setattr(llm, "chat_json", checker)
    assert [q["question"] for q in asyncio.run(verified(qs))] == ["Q0"]
