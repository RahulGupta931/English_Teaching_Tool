from datetime import date, timedelta

import hashlib
import hmac
import json
import time

import jwt
import pytest

from app import daily_word, db, llm, word_chain
from conftest import SUPABASE_URL, make_pdf, make_token, make_wav


def set_free_limit_seconds(seconds):
    with db.connect() as con:
        con.execute("update plans set daily_minutes = ? where id = 1", (seconds / 60,))


def audio(seconds=1.0, **kw):
    return {"audio": ("a.wav", make_wav(seconds, **kw), "audio/wav")}


def test_health(client):
    assert client.get("/v1/health").json() == {"status": "ok"}


def profile(client, sub, **body):
    headers = {"Authorization": f"Bearer {make_token(sub=sub)}"}
    data = {"name": "Kid", "phone": "98765 43210", "birth_year": 2000, **body}
    return client.post("/v1/auth/profile", headers=headers, json=data)


def test_profile_rules(client, fakes):
    assert profile(client, "a", birth_year=2015).status_code == 422  # minor without consent
    assert profile(client, "a", name="x").status_code == 422
    assert profile(client, "a", phone="12345").status_code == 422
    fakes["flagged"] = True
    assert profile(client, "a", name="Rude").status_code == 422
    fakes["flagged"] = False
    assert profile(client, "a", birth_year=2015, parental_consent=True).status_code == 200
    assert profile(client, "a").status_code == 409  # already set up
    # The same number in another format is still the same number: one account per phone.
    r = profile(client, "b", phone="+91 98765-43210")
    assert r.status_code == 409 and "already registered" in r.json()["detail"]
    assert profile(client, "b", name="राहुल शर्मा", phone="+44 7700 900123").status_code == 200


def test_signed_in_without_profile_must_complete_it(client, fakes):
    headers = {"Authorization": f"Bearer {make_token(sub='new-user')}"}
    assert client.get("/v1/me", headers=headers).status_code == 428


def test_bad_tokens_are_rejected(client):
    assert client.get("/v1/me").status_code == 401
    for token in (make_token(secret="wrong-secret-that-is-long-enough-for-hs256"), make_token(exp=int(time.time()) - 120),
                  make_token(aud="anon"), make_token(iss="https://evil.example/auth/v1"), "not-a-jwt"):
        assert client.get("/v1/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_token_from_slightly_fast_clock_is_accepted(client, login):
    login()
    early = make_token(iat=int(time.time()) + 5)  # Supabase's clock a few seconds ahead of ours
    assert client.get("/v1/me", headers={"Authorization": f"Bearer {early}"}).status_code == 200


def test_asymmetric_supabase_keys(client, login, monkeypatch):
    from cryptography.hazmat.primitives.asymmetric import ec
    from app import auth
    login()  # creates the profile for sub "user-asha"
    key = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setattr(auth, "_signing_key", lambda url, token: key.public_key())
    token = jwt.encode({"sub": "user-asha", "aud": "authenticated", "iss": f"{SUPABASE_URL}/auth/v1",
                        "exp": int(time.time()) + 60}, key, algorithm="ES256")
    assert client.get("/v1/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    # An HS256 token must not be accepted as if it were signed with the public key.
    monkeypatch.delenv("SUPABASE_JWT_SECRET")
    assert client.get("/v1/me", headers={"Authorization": f"Bearer {make_token(sub='user-asha')}"}).status_code == 401


def test_me_shows_contact_details(client, login):
    user = client.get("/v1/me", headers=login()).json()["user"]
    assert user["email"] == "asha@example.com" and user["phone"].startswith("+9198")


def test_delete_account_removes_data(client, login):
    headers = login()
    assert client.post("/v1/jam", headers=headers, files=audio()).status_code == 200
    assert client.delete("/v1/me", headers=headers).status_code == 204
    assert client.get("/v1/me", headers=headers).status_code == 428  # data gone; would need a new profile


def test_activity_awards_xp(client, login, fakes):
    headers = login()
    fakes["json"] = {"fluency": 80, "vocabulary": 80, "grammar": 80, "relevance": 80, "feedback": "Nice"}
    r = client.post("/v1/jam", headers=headers, files=audio())
    assert r.status_code == 200 and r.json()["xp"] == 15 and r.json()["metrics"]["long_pauses"] == 0
    me = client.get("/v1/me", headers=headers).json()
    assert me["user"]["xp"] == 15 and me["user"]["streak"] == 1 and me["best"] == {"jam": 78}


def test_rejects_bad_audio(client, login):
    headers = login()
    for files in ({"audio": ("a.wav", b"junk" * 100, "audio/wav")}, audio(rate=44100), audio(channels=2)):
        assert client.post("/v1/jam", headers=headers, files=files).status_code == 415


def test_daily_speaking_limit(client, login, monkeypatch):
    set_free_limit_seconds(3)
    headers = login()
    post = lambda: client.post("/v1/jam", headers=headers, files=audio(2))
    assert post().status_code == 200
    assert post().status_code == 429


def test_roleplay_flow(client, login, fakes):
    headers = login()
    start = client.post("/v1/roleplay", headers=headers, json={"scenario": "everyday"}).json()
    sid = start["session_id"]
    assert start["reply"] and start["audio"] == "bXAz"  # Free uses the Azure voice too
    assert client.post(f"/v1/roleplay/{sid}/finish", headers=headers).status_code == 422

    turn = client.post(f"/v1/roleplay/{sid}/turn", headers=headers, files=audio()).json()
    assert turn["transcript"] == "I would like a coffee please" and turn["turns_left"] == 9

    fakes["json"] = {"score": 70, "summary": "Good", "mistakes": [
        {"type": "grammar", "original": "I want coffee", "correction": "I'd like a coffee", "explanation": "polite"},
        {"type": "grammar", "original": "yes please", "correction": "Yes, please.", "explanation": "comma"}]}
    debrief = client.post(f"/v1/roleplay/{sid}/finish", headers=headers).json()
    assert debrief["score"] == 70 and len(debrief["mistakes"]) == 1 and debrief["xp"] == 17
    assert client.get("/v1/me", headers=headers).json()["mistakes"][0]["source"] == "roleplay"
    assert client.post(f"/v1/roleplay/{sid}/turn", headers=headers, files=audio()).status_code == 409


def test_roleplay_flagged_turn_is_not_kept(client, login, fakes):
    headers = login()
    sid = client.post("/v1/roleplay", headers=headers, json={"scenario": "interview"}).json()["session_id"]
    fakes["flagged"] = True
    turn = client.post(f"/v1/roleplay/{sid}/turn", headers=headers, files=audio()).json()
    assert turn["reply"].startswith("Let's keep") and turn["turns_left"] == 10


def test_roleplay_other_users_session_hidden(client, login):
    sid = client.post("/v1/roleplay", headers=login("Asha"), json={"scenario": "everyday"}).json()["session_id"]
    assert client.post(f"/v1/roleplay/{sid}/turn", headers=login("Ravi"), files=audio()).status_code == 404


RESUME = "Asha Verma. B.Tech Computer Science 2026. Skills: Python, React. Project: built a library booking app."


def test_resume_interview_uses_summary(client, login, fakes, monkeypatch):
    seen = []

    async def chat(system, messages):
        seen.append((system, messages))
        return "Summary: CS graduate, built a library booking app." if len(seen) == 1 else "Hello Asha!"

    monkeypatch.setattr(llm, "chat", chat)
    headers = login()
    files = {"resume": ("cv.pdf", make_pdf(RESUME), "application/pdf")}
    r = client.post("/v1/roleplay/resume", headers=headers, files=files)
    assert r.status_code == 200 and r.json()["reply"] == "Hello Asha!"
    assert "library booking app" in seen[0][1][0]["content"]  # text extracted from the PDF
    assert "library booking app" in seen[1][0]  # summary given to the interviewer

    client.post(f"/v1/roleplay/{r.json()['session_id']}/turn", headers=headers, files=audio())
    assert "library booking app" in seen[2][0]  # still there on later turns


def test_resume_interview_rejects_bad_files(client, login, fakes, monkeypatch):
    headers = login()
    post = lambda data: client.post("/v1/roleplay/resume", headers=headers, files={"resume": ("cv.pdf", data, "application/pdf")})
    assert post(b"not a pdf at all").status_code == 415
    assert post(b"%PDF-" + b"0" * 2_000_000).status_code == 413
    assert post(make_pdf("Hi")).status_code == 422  # no real text

    async def not_resume(system, messages):
        return "NOT_A_RESUME"
    monkeypatch.setattr(llm, "chat", not_resume)
    assert post(make_pdf(RESUME)).status_code == 422


def test_jam(client, login, fakes):
    headers = login()
    fakes["transcript"] = "umm cricket is like my favourite game"
    fakes["json"] = {"fluency": 80, "vocabulary": 70, "grammar": 90, "relevance": 100, "feedback": "Nice"}
    r = client.post("/v1/jam", headers=headers, files=audio(5)).json()
    assert r["metrics"]["filler_count"] == 2 and r["penalty"] == 4 and r["score"] == 81


def test_daily_word(client, login, fakes, monkeypatch):
    monkeypatch.setattr(daily_word, "answer_for_today", lambda: "apple")
    headers = login()
    assert client.post("/v1/daily-word/guess", headers=headers, json={"word": "zzzzz"}).status_code == 422
    assert client.post("/v1/daily-word/guess", headers=headers, json={"word": "abc"}).status_code == 422
    assert client.post("/v1/daily-word/sentence", headers=headers, files=audio()).status_code == 409

    first = client.post("/v1/daily-word/guess", headers=headers, json={"word": "plant"}).json()
    assert first["guesses"][0]["result"] == ["present", "present", "present", "absent", "absent"] and not first["finished"]
    won = client.post("/v1/daily-word/guess", headers=headers, json={"word": "apple"}).json()
    assert won["solved"] and won["reveal"]["word"] == "apple" and won["reveal"]["meaning"] == "(noun) a thing"
    assert client.post("/v1/daily-word/guess", headers=headers, json={"word": "grape"}).status_code == 409

    fakes["transcript"] = "I ate an apple today"
    fakes["json"] = {"correct": True, "feedback": "Great"}
    assert client.post("/v1/daily-word/sentence", headers=headers, files=audio()).json()["xp"] == 20
    assert client.post("/v1/daily-word/sentence", headers=headers, files=audio()).status_code == 409
    assert client.get("/v1/me", headers=headers).json()["user"]["xp"] == 50 + 20


def test_word_chain(client, login, fakes, monkeypatch):
    monkeypatch.setattr(word_chain.random, "choice", lambda options: sorted(options)[0])
    headers = login()
    game = client.post("/v1/word-chain", headers=headers).json()
    assert game["words"] == [{"word": "angle", "by": "ai", "points": 0}] and game["next_letter"] == "e"

    fakes["transcript"] = "Elephant."
    game = client.post(f"/v1/word-chain/{game['id']}/turn", headers=headers, files=audio()).json()
    assert game["turn"]["ok"] and game["score"] == 18 and game["words"][-1]["word"] == "table" and game["next_letter"] == "e"

    fakes["transcript"] = "apple"  # wrong letter: uses the one retry
    game = client.post(f"/v1/word-chain/{game['id']}/turn", headers=headers, files=audio()).json()
    assert not game["turn"]["ok"] and game["turn"]["retry"] and not game["finished"]
    game = client.post(f"/v1/word-chain/{game['id']}/turn", headers=headers, files=audio()).json()
    assert game["finished"] and game["xp"] == 5
    assert client.post(f"/v1/word-chain/{game['id']}/turn", headers=headers, files=audio()).status_code == 409
    assert client.post(f"/v1/word-chain/{game['id']}/stop", headers=login("Ravi")).status_code == 404  # not their game


def test_word_chain_timer(client, login, fakes):
    headers = login()
    game = client.post("/v1/word-chain", headers=headers).json()
    with db.connect() as con:
        con.execute("update word_chain_games set turn_started = turn_started - 100 where id = ?", (game["id"],))
    game = client.post(f"/v1/word-chain/{game['id']}/turn", headers=headers, files=audio()).json()
    assert game["finished"] and game["turn"]["reason"] == "Time's up!"


def test_tongue_twister(client, login, fakes):
    headers = login()
    level = client.get("/v1/tongue-twister/1", headers=headers).json()
    assert level["levels"] == 15 and level["pool_size"] == 15  # AI added nothing (fake reply is empty)
    assert client.get("/v1/tongue-twister/99", headers=headers).status_code == 404
    fakes["transcript"] = level["text"]
    r = client.post("/v1/tongue-twister/1", headers=headers, files=audio(), data={"twister_id": level["id"]}).json()
    assert r["accuracy"] == 100 and r["next_level"] == 2 and r["xp"] == r["score"] // 5
    assert client.post("/v1/tongue-twister/1", headers=headers, files=audio(), data={"twister_id": 9999}).status_code == 404


def test_tongue_twister_pool_grows_daily(client, login, fakes, monkeypatch):
    headers = login()
    fakes["json"] = {"twisters": [f"Vicky's violet van went west {i}" for i in range(15)] + ["Too short", 42]}
    assert client.get("/v1/tongue-twister/1", headers=headers).json()["pool_size"] == 30
    fakes["json"] = {"twisters": ["Something new and different"]}
    assert client.get("/v1/tongue-twister/1", headers=headers).json()["pool_size"] == 30  # once a day
    monkeypatch.setattr(db, "today", lambda: date(2030, 1, 2))
    assert client.get("/v1/tongue-twister/1", headers=headers).json()["pool_size"] == 31  # next day adds more


def test_quiz(client, login, fakes, monkeypatch):
    async def all_verified(questions):
        return questions
    monkeypatch.setattr("app.quiz.verified", all_verified)
    headers = login()
    fakes["json"] = {"questions": [{"question": f"Q{i} ___", "options": ["a", "b", "c", "d"], "answer": 2,
                                    "explanation": "why"} for i in range(3)]}
    quiz = client.post("/v1/quiz", headers=headers).json()
    assert len(quiz["questions"]) == 10 and all("answer" not in q for q in quiz["questions"])
    assert sum(q["question"].startswith("Q") for q in quiz["questions"]) == 3  # AI questions; the bank fills the rest
    with db.connect() as con:
        stored = json.loads(con.execute("select questions from quiz_sessions").fetchone()["questions"])
    answers = [q["answer"] for q in stored[:9]] + [(stored[9]["answer"] + 1) % 4]
    r = client.post(f"/v1/quiz/{quiz['id']}", headers=headers, json={"answers": answers}).json()
    assert r["correct"] == 9 and r["score"] == 90 and r["xp"] == 18 and len(r["mistakes"]) == 1
    assert client.post(f"/v1/quiz/{quiz['id']}", headers=headers, json={"answers": answers}).status_code == 409
    assert client.post(f"/v1/quiz/{quiz['id']}", headers=login("Ravi"), json={"answers": []}).status_code == 404


def test_placement_sets_level(client, login, fakes):
    headers = login()
    fakes["json"] = {"grammar": 80, "vocabulary": 80, "fluency": 80, "feedback": "Good"}
    files = {f"answer_{i}": ("a.wav", make_wav(), "audio/wav") for i in range(3)}
    r = client.post("/v1/placement", headers=headers, files=files).json()
    assert r["level"] == "advanced" and r["score"] == 80 and len(r["transcripts"]) == 3
    assert client.get("/v1/me", headers=headers).json()["user"]["level"] == "advanced"


def test_missing_keys_return_503(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert profile(client, "new").status_code == 503
    monkeypatch.delenv("SUPABASE_URL")
    assert client.get("/v1/me", headers={"Authorization": "Bearer x"}).status_code == 503


def test_paid_plan_gets_azure_voice(client, login):
    from app import db
    headers = login()
    with db.connect() as con:
        con.execute("update users set plan_id = 2")
    start = client.post("/v1/roleplay", headers=headers, json={"scenario": "everyday"}).json()
    assert start["audio"] == "bXAz"


def test_silence_is_rejected_and_trimmed_silence_is_free(client, login, monkeypatch):
    headers = login()
    silent = {"audio": ("a.wav", make_wav(pattern=[(2, False)]), "audio/wav")}
    assert client.post("/v1/jam", headers=headers, files=silent).status_code == 422
    set_free_limit_seconds(3)
    padded = {"audio": ("a.wav", make_wav(pattern=[(3, False), (1, True), (3, False)]), "audio/wav")}
    assert client.post("/v1/jam", headers=headers, files=padded).status_code == 200  # only ~1.4 s charged


def admin_headers(client, monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "s3cret")
    token = client.post("/v1/admin/login", json={"password": "s3cret"}).json()["token"]
    return {"X-Admin-Token": token}


def test_admin_requires_password(client, monkeypatch):
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    assert client.post("/v1/admin/login", json={"password": "x"}).status_code == 503
    monkeypatch.setenv("ADMIN_PASSWORD", "s3cret")
    assert client.post("/v1/admin/login", json={"password": "wrong"}).status_code == 403
    assert client.get("/v1/admin/users").status_code == 403
    assert client.get("/v1/admin/users", headers={"X-Admin-Token": "made-up"}).status_code == 403
    token = admin_headers(client, monkeypatch)["X-Admin-Token"]
    expires, sig = token.split(".")
    assert client.get("/v1/admin/users", headers={"X-Admin-Token": f"{int(expires) + 1}.{sig}"}).status_code == 403  # tampered
    monkeypatch.setenv("ADMIN_PASSWORD", "changed")
    assert client.get("/v1/admin/users", headers={"X-Admin-Token": token}).status_code == 403  # password rotated


def test_admin_plans_and_switching_users(client, login, monkeypatch):
    admin = admin_headers(client, monkeypatch)
    headers = login()
    me = client.get("/v1/me", headers=headers).json()["user"]["plan"]
    assert me == {"name": "Free", "expires": None, "azure_voice": True, "interviews_left": 1, "upcoming": None}

    plans = client.get("/v1/admin/plans", headers=admin).json()
    assert [(p["name"], p["price_inr"], p["days"], p["interviews"]) for p in plans] ==         [("Free", 0, None, 1), ("Interview Pack", 99, 90, 10)]
    new = {"name": "Pro", "price_inr": 299, "days": 30, "interviews": None, "daily_minutes": 30}
    pro = client.post("/v1/admin/plans", headers=admin, json=new).json()["id"]
    assert client.post("/v1/admin/plans", headers=admin, json=new).status_code == 409

    user_id = client.get("/v1/admin/users?q=ash", headers=admin).json()[0]["id"]
    assert client.post(f"/v1/admin/users/{user_id}/plan", headers=admin, json={"plan_id": 2}).status_code == 200
    me = client.get("/v1/me", headers=headers).json()
    assert me["user"]["plan"]["name"] == "Interview Pack" and me["user"]["plan"]["interviews_left"] == 10
    assert me["user"]["plan"]["expires"] == (db.today() + timedelta(days=89)).isoformat()

    assert client.post(f"/v1/admin/plans/{pro}/listed", headers=admin, json={"listed": False}).status_code == 200
    assert client.post(f"/v1/admin/users/{user_id}/plan", headers=admin, json={"plan_id": pro}).status_code == 409
    assert client.post("/v1/admin/plans/1/listed", headers=admin, json={"listed": False}).status_code == 409


def test_expired_plan_falls_back_to_free(client, login):
    headers = login()
    with db.connect() as con:
        con.execute("update users set plan_id = 2, plan_expires = ?", ((db.today() - timedelta(days=1)).isoformat(),))
    plan = client.get("/v1/me", headers=headers).json()["user"]["plan"]
    assert plan["name"] == "Free" and plan["interviews_left"] == 0  # no fresh free interview on expiry


def test_free_plan_allows_one_resume_interview(client, login, fakes):
    headers = login()
    post = lambda: client.post("/v1/roleplay/resume", headers=headers,
                               files={"resume": ("cv.pdf", make_pdf(RESUME), "application/pdf")})
    first = post()
    assert first.status_code == 200 and first.json()["interviews_left"] == 0
    assert post().status_code == 403

    sid = first.json()["session_id"]
    client.post(f"/v1/roleplay/{sid}/turn", headers=headers, files=audio())
    fakes["json"] = {"score": 60, "summary": "OK", "interview": {
        "readiness": 55, "verdict": "Not yet", "strengths": ["Clear intro"],
        "weaknesses": [{"area": "SQL joins", "detail": "Mixed up inner and left joins", "improve": "Practise joins"},
                       {"detail": "no area, dropped"}]}}
    debrief = client.post(f"/v1/roleplay/{sid}/finish", headers=headers).json()
    assert debrief["interview"]["readiness"] == 55
    assert [w["area"] for w in debrief["interview"]["weaknesses"]] == ["SQL joins"]


def test_everyday_roleplay_has_no_interview_feedback(client, login, fakes):
    headers = login()
    sid = client.post("/v1/roleplay", headers=headers, json={"scenario": "everyday"}).json()["session_id"]
    client.post(f"/v1/roleplay/{sid}/turn", headers=headers, files=audio())
    assert client.post(f"/v1/roleplay/{sid}/finish", headers=headers).json()["interview"] is None


def test_plan_without_azure_voice_gets_browser_voice(client, login):
    headers = login()
    with db.connect() as con:
        con.execute("update plans set azure_voice = 0 where id = 1")
    assert client.post("/v1/roleplay", headers=headers, json={"scenario": "everyday"}).json()["audio"] is None


KEY_SECRET, WEBHOOK_SECRET = "rzp_test_secret", "rzp_webhook_secret"


@pytest.fixture
def razorpay(monkeypatch):
    """Razorpay in test mode: orders are created locally; returns a helper that signs checkout results."""
    from app import payments
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_key")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", KEY_SECRET)
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET)
    orders = []

    async def create_order(amount, receipt, notes):
        orders.append(amount)
        return f"order_{len(orders)}"
    monkeypatch.setattr(payments, "create_order", create_order)

    def signed(order_id, payment_id="pay_1"):
        sig = hmac.new(KEY_SECRET.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
        return {"razorpay_order_id": order_id, "razorpay_payment_id": payment_id, "razorpay_signature": sig}
    signed.orders = orders
    return signed


def buy(client, headers, razorpay, plan_id, payment_id="pay_1"):
    order = client.post("/v1/payments/order", headers=headers, json={"plan_id": plan_id})
    assert order.status_code == 200, order.text
    return client.post("/v1/payments/verify", headers=headers, json=razorpay(order.json()["order_id"], payment_id))


def add_plan(name, price, days=30, interviews=5):
    with db.connect() as con:
        return con.execute("insert into plans (name, price_inr, days, interviews, daily_minutes, azure_voice) "
                           "values (?, ?, ?, ?, 15, 1) returning id", (name, price, days, interviews)).fetchone()["id"]


def test_buying_from_free_starts_today_at_the_database_price(client, login, razorpay):
    headers = login()
    order = client.post("/v1/payments/order", headers=headers, json={"plan_id": 2}).json()
    assert order["amount"] == 9900 and order["prefill"]["email"] == "asha@example.com"
    r = client.post("/v1/payments/verify", headers=headers, json=razorpay(order["order_id"])).json()
    assert r["outcome"] == "activated" and r["current"]["name"] == "Interview Pack" and r["current"]["interviews_left"] == 10
    # Applying the same payment again (e.g. the webhook arriving after the browser) changes nothing.
    again = client.post("/v1/payments/verify", headers=headers, json=razorpay(order["order_id"])).json()
    assert again["outcome"] == "activated" and again["current"]["interviews_left"] == 10


def test_payment_checks(client, login, razorpay):
    headers = login()
    order_id = client.post("/v1/payments/order", headers=headers, json={"plan_id": 2}).json()["order_id"]
    forged = {**razorpay(order_id), "razorpay_signature": "0" * 64}
    assert client.post("/v1/payments/verify", headers=headers, json=forged).status_code == 400
    assert client.post("/v1/payments/verify", headers=login("Ravi"), json=razorpay(order_id)).status_code == 404
    assert client.post("/v1/payments/order", headers=headers, json={"plan_id": 1}).status_code == 409  # Free
    hidden = add_plan("Old", 49)
    with db.connect() as con:
        con.execute("update plans set listed = 0 where id = ?", (hidden,))
    assert client.post("/v1/payments/order", headers=headers, json={"plan_id": hidden}).status_code == 409


def test_cheaper_plan_waits_until_current_ends(client, login, razorpay):
    headers = login()
    buy(client, headers, razorpay, 2)  # Interview Pack, ₹99
    cheap = add_plan("Lite", 49)
    listing = {p["id"]: p for p in client.get("/v1/plans", headers=headers).json()["plans"]}
    assert listing[cheap]["on_purchase"] == "starts_later"
    r = buy(client, headers, razorpay, cheap, "pay_2").json()
    assert r["outcome"] == "queued" and r["current"]["name"] == "Interview Pack" and r["upcoming"]["name"] == "Lite"
    assert r["upcoming"]["starts"] == (db.today() + timedelta(days=90)).isoformat()
    # One upcoming plan at a time; a pricier plan is still an upgrade and starts now.
    assert client.post("/v1/payments/order", headers=headers, json={"plan_id": cheap}).status_code == 409
    pro = add_plan("Pro", 299)
    assert buy(client, headers, razorpay, pro, "pay_3").json()["outcome"] == "activated"

    # When the current plan ends, the upcoming plan starts the next day.
    with db.connect() as con:
        con.execute("update users set plan_id = 2, plan_expires = ?", ((db.today() - timedelta(days=1)).isoformat(),))
    plan = client.get("/v1/me", headers=headers).json()["user"]["plan"]
    assert plan["name"] == "Lite" and plan["upcoming"] is None and plan["interviews_left"] == 5


def test_activate_upcoming_early_only_when_interviews_used_up(client, login, razorpay):
    headers = login()
    buy(client, headers, razorpay, 2)
    buy(client, headers, razorpay, add_plan("Lite", 49), "pay_2")
    assert client.post("/v1/plans/activate-upcoming", headers=headers).status_code == 409
    with db.connect() as con:
        con.execute("update users set interviews_used = 10")
    r = client.post("/v1/plans/activate-upcoming", headers=headers).json()
    assert r["current"]["name"] == "Lite" and r["current"]["interviews_left"] == 5 and r["upcoming"] is None


def test_webhook_applies_paid_order_once(client, login, razorpay, monkeypatch):
    headers = login()
    order_id = client.post("/v1/payments/order", headers=headers, json={"plan_id": 2}).json()["order_id"]
    body = json.dumps({"event": "order.paid", "payload": {"payment": {"entity": {"id": "pay_9", "order_id": order_id}},
                                                         "order": {"entity": {"id": order_id}}}}).encode()
    sig = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    assert client.post("/v1/payments/webhook", content=body, headers={"X-Razorpay-Signature": "bad"}).status_code == 400
    for _ in range(2):
        assert client.post("/v1/payments/webhook", content=body, headers={"X-Razorpay-Signature": sig}).status_code == 200
    me = client.get("/v1/me", headers=headers).json()["user"]["plan"]
    assert me["name"] == "Interview Pack" and me["interviews_left"] == 10
    admin = admin_headers(client, monkeypatch)
    paid = client.get("/v1/admin/payments", headers=admin).json()
    assert [(p["status"], p["outcome"], p["razorpay_payment_id"]) for p in paid] == [("paid", "activated", "pay_9")]


def add_mistakes(name, *originals):
    with db.connect() as con:
        uid = con.execute("select id from users where auth_id = ?", (f"user-{name.lower()}",)).fetchone()["id"]
        con.executemany("insert into mistakes (user_id, source, type, original, correction, explanation) "
                        "values (?, 'jam', 'grammar', ?, ?, 'rule')", [(uid, o, o + " (fixed)") for o in originals])


def test_coach_needs_saved_mistakes(client, login):
    r = client.post("/v1/coach", headers=login(), json={})
    assert r.status_code == 422 and "no saved mistakes" in r.json()["detail"]


def test_coach_flow(client, login, fakes, monkeypatch):
    asha, ravi = login("Asha"), login("Ravi")
    add_mistakes("Asha", "I am going to market", "he go to school", "He go to school.")
    add_mistakes("Ravi", "ravi's own mistake")
    systems = []

    async def chat(system, messages):
        systems.append(system)
        return "Let's practise."
    monkeypatch.setattr(llm, "chat", chat)

    start = client.post("/v1/coach", headers=asha, json={"language": "hinglish"}).json()
    sid = start["session_id"]
    assert start["language"] == "hinglish" and start["mistakes"] == 2 and start["turns_left"] == 10  # duplicate dropped
    assert "Hinglish" in systems[0] and "I am going to market" in systems[0] and "ravi's own mistake" not in systems[0]

    assert client.post(f"/v1/coach/{sid}/finish", headers=asha).status_code == 422
    assert client.post(f"/v1/coach/{sid}/turn", headers=ravi, files=audio()).status_code == 404
    assert client.post(f"/v1/roleplay/{sid}/turn", headers=asha, files=audio()).status_code == 404  # coach-only session
    turn = client.post(f"/v1/coach/{sid}/turn", headers=asha, files=audio()).json()
    assert turn["transcript"] == "I would like a coffee please" and turn["turns_left"] == 9

    fakes["json"] = {"summary": "You practised **he goes**.", "mistakes": [
        {"type": "grammar", "original": "I goes", "correction": "I go", "explanation": "rule"},
        {"type": "grammar", "original": "ok", "correction": "OK.", "explanation": "punctuation only"}]}
    recap = client.post(f"/v1/coach/{sid}/finish", headers=asha).json()
    assert recap["summary"] == "You practised he goes." and recap["audio"] == "bXAz" and recap["xp"] == 10
    assert [m["original"] for m in recap["mistakes"]] == ["I goes"]
    me = client.get("/v1/me", headers=asha).json()
    assert me["mistakes"][0]["source"] == "coach" and me["activities"][0]["kind"] == "coach"
    assert client.post(f"/v1/coach/{sid}/turn", headers=asha, files=audio()).status_code == 409


def test_coach_language_defaults_to_profile(client, login):
    headers = login("Meera", explain_lang="hinglish")
    add_mistakes("Meera", "she don't like it")
    assert client.post("/v1/coach", headers=headers, json={}).json()["language"] == "hinglish"
    assert client.post("/v1/coach", headers=headers, json={"language": "english"}).json()["language"] == "english"
