import logging
import os
import re
import unicodedata
from datetime import date, timedelta
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

import httpx

from app import db, llm
from app.auth import auth_claims, current_user, supabase_url

router = APIRouter(prefix="/v1")


def valid_name(name: str) -> bool:
    """2-40 characters: letters in any script (with their vowel signs), spaces, dots, dashes, apostrophes."""
    return 2 <= len(name) <= 40 and name[0].isalpha() and all(
        c.isalpha() or unicodedata.category(c).startswith("M") or c in " .'-" for c in name)


class Profile(BaseModel):
    name: str
    phone: str
    birth_year: int
    parental_consent: bool = False
    explain_lang: Literal["english", "hinglish"] = "english"


def normalize_phone(raw: str) -> str:
    """E.164: Indian mobiles (98765 43210, 098..., 91..., +91...) become +91XXXXXXXXXX; others need a + code."""
    number = re.sub(r"[\s().-]", "", raw)
    if re.fullmatch(r"(\+?91|0)?[6-9]\d{9}", number):
        return "+91" + number[-10:]
    if re.fullmatch(r"\+[1-9]\d{7,14}", number):
        return number
    raise HTTPException(422, "Enter a valid mobile number, e.g. 98765 43210 (or +44 7700 900123 outside India).")


class Settings(BaseModel):
    explain_lang: Literal["english", "hinglish"]


def public(user: dict) -> dict:
    day = db.today()
    active = user["last_active"] and date.fromisoformat(user["last_active"]) >= day - timedelta(days=1)
    return {
        "name": user["name"],
        "email": user["email"],
        "phone": user["phone"],
        "level": user["level"],
        "xp": user["xp"],
        "streak": user["streak"] if active else 0,
        "explain_lang": user["explain_lang"],
        "plan": {
            "name": user["plan"]["name"],
            "expires": user["plan_expires"],
            "azure_voice": bool(user["plan"]["azure_voice"]),
            "interviews_left": db.interviews_left(user),
            "upcoming": user["upcoming"]["name"] if user["upcoming"] else None,
        },
        "is_minor": day.year - user["birth_year"] < 18,
    }


@router.post("/auth/profile")
async def create_profile(body: Profile, claims: dict = Depends(auth_claims)):
    """First step after signing up (Google or email): name, mobile number and birth year."""
    name = " ".join(body.name.split())
    if not valid_name(name):
        raise HTTPException(422, "Name must be 2-40 letters, spaces, dots, dashes or apostrophes.")
    phone = normalize_phone(body.phone)
    year = db.today().year
    if not year - 100 <= body.birth_year <= year - 6:
        raise HTTPException(422, "Please enter a valid birth year.")
    # shortcut: a checkbox is not verifiable parental consent under DPDP; add a parent OTP/email flow before launch.
    if year - body.birth_year < 18 and not body.parental_consent:
        raise HTTPException(422, "A parent or guardian must give consent for learners under 18.")
    if await llm.is_flagged(name):
        raise HTTPException(422, "Please choose a different name.")

    with db.connect() as con:
        if con.execute("select 1 from users where auth_id = ?", (claims["sub"],)).fetchone():
            raise HTTPException(409, "Your profile is already set up.")
        # shortcut: the number isn't verified by SMS yet, so this stops casual duplicates, not determined ones.
        if con.execute("select 1 from users where phone = ?", (phone,)).fetchone():
            raise HTTPException(409, "This mobile number is already registered with another account.")
        try:
            user_id = con.execute(
                "insert into users (auth_id, email, phone, name, birth_year, parental_consent, explain_lang) "
                "values (?, ?, ?, ?, ?, ?, ?) returning id",
                (claims["sub"], claims.get("email"), phone, name, body.birth_year, int(body.parental_consent),
                 body.explain_lang),
            ).fetchone()["id"]
        except psycopg.IntegrityError:  # the same check, lost to a simultaneous sign-up
            raise HTTPException(409, "This mobile number is already registered with another account.")
        user = db.load_plan(con, dict(con.execute("select * from users where id = ?", (user_id,)).fetchone()))
    return {"user": public(user)}


@router.get("/me")
def me(user: dict = Depends(current_user)):
    uid = user["id"]
    with db.connect() as con:
        activities = [dict(r) for r in con.execute(
            "select kind, score, xp, created_at from activities where user_id = ? order by id desc limit 30", (uid,))]
        mistakes = [dict(r) for r in con.execute(
            "select source, type, original, correction, explanation, created_at from mistakes "
            "where user_id = ? order by id desc limit 10", (uid,))]
        best = {r["kind"]: r["best"] for r in con.execute(
            "select kind, max(score) as best from activities where user_id = ? and score is not null group by kind", (uid,))}
        used = con.execute("select seconds from usage where user_id = ? and day = ?",
                           (uid, db.today().isoformat())).fetchone()
    return {
        "user": public(user),
        "activities": activities,
        "mistakes": mistakes,
        "best": best,
        "speaking_seconds_today": round(used["seconds"]) if used else 0,
        "speaking_limit_seconds": round(user["plan"]["daily_minutes"] * 60),
    }


@router.patch("/me")
def update_settings(body: Settings, user: dict = Depends(current_user)):
    with db.connect() as con:
        con.execute("update users set explain_lang = ? where id = ?", (body.explain_lang, user["id"]))
    return public({**user, "explain_lang": body.explain_lang})


@router.delete("/me", status_code=204)
def delete_account(user: dict = Depends(current_user)):
    # Cascades to every table holding this user's data.
    with db.connect() as con:
        con.execute("delete from users where id = ?", (user["id"],))
    # Also remove the sign-in itself (email/Google link) from Supabase, which needs the project's secret key.
    secret = os.environ.get("SUPABASE_SECRET_KEY")
    if secret:
        try:
            # New secret keys (sb_secret_...) go only in the apikey header; the legacy service_role key is a JWT
            # and also goes in Authorization.
            headers = {"apikey": secret} if secret.startswith("sb_secret_") else \
                {"apikey": secret, "Authorization": f"Bearer {secret}"}
            r = httpx.delete(f"{supabase_url()}/auth/v1/admin/users/{user['auth_id']}", timeout=15, headers=headers)
            if r.status_code not in (200, 204, 404):
                logging.error("Supabase user delete failed: HTTP %s", r.status_code)
        except httpx.HTTPError as e:
            logging.error("Supabase user delete failed: %s", e)
    return Response(status_code=204)
