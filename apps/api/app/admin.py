"""Admin: see users, switch their plan by hand (until payments exist), create and unlist plans.

Separate from learner login (which is name-only): admins sign in with ADMIN_PASSWORD.
"""

import hashlib
import hmac
import os
import secrets
import time
from collections import deque

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app import db

router = APIRouter(prefix="/v1/admin")

SESSION_SECONDS = 12 * 3600
LOGIN_ATTEMPTS_PER_MINUTE = 5
# shortcut: in-memory, so on serverless each instance counts its own attempts; move to the DB if brute force matters.
_attempts: deque = deque()


def _sign(expires: str) -> str:
    # Signed, not stored: serverless instances share no memory. Changing ADMIN_PASSWORD signs every admin out.
    return hmac.new(os.environ.get("ADMIN_PASSWORD", "").encode(), expires.encode(), hashlib.sha256).hexdigest()


def require_admin(x_admin_token: str = Header("")) -> None:
    # 403, not 401: the web app treats 401 as "learner logged out".
    expires, _, sig = x_admin_token.partition(".")
    if not (os.environ.get("ADMIN_PASSWORD") and expires.isdigit() and int(expires) > time.time()
            and hmac.compare_digest(sig, _sign(expires))):
        raise HTTPException(403, "Admin sign-in required.")


class AdminLogin(BaseModel):
    password: str


class NewPlan(BaseModel):
    name: str = Field(min_length=2, max_length=40)
    price_inr: int = Field(ge=0, le=100_000)
    days: int = Field(ge=1, le=3650)
    interviews: int | None = Field(default=None, ge=0, le=1000)  # None = unlimited
    daily_minutes: int = Field(ge=1, le=240)
    azure_voice: bool = True


class Listed(BaseModel):
    listed: bool


class AssignPlan(BaseModel):
    plan_id: int


@router.post("/login")
def login(body: AdminLogin):
    password = os.environ.get("ADMIN_PASSWORD")
    if not password:
        raise HTTPException(503, "Admin is not set up (set ADMIN_PASSWORD in the API's .env).")
    now = time.monotonic()
    while _attempts and now - _attempts[0] > 60:
        _attempts.popleft()
    if len(_attempts) >= LOGIN_ATTEMPTS_PER_MINUTE:
        raise HTTPException(429, "Too many attempts. Wait a minute and try again.")
    _attempts.append(now)
    if not secrets.compare_digest(body.password.encode(), password.encode()):
        raise HTTPException(403, "Wrong password.")
    expires = str(int(time.time()) + SESSION_SECONDS)
    return {"token": f"{expires}.{_sign(expires)}"}


@router.get("/users", dependencies=[Depends(require_admin)])
def users(q: str = ""):
    with db.connect() as con:
        rows = [dict(r) for r in con.execute(
            "select id, name, email, phone, birth_year, level, xp, last_active, created_at, plan_id, plan_started, "
            "plan_expires, interviews_used from users where name ilike ? or email ilike ? or phone ilike ? "
            "order by id desc limit 200", (f"%{q.strip()}%",) * 3)]
        out = []
        for row in rows:
            user = db.load_plan(con, row)  # also moves expired plans back to Free
            out.append({
                **{k: user[k] for k in ("id", "name", "email", "phone", "level", "xp", "last_active", "created_at",
                                        "plan_id", "plan_started", "plan_expires", "interviews_used")},
                "is_minor": db.today().year - user["birth_year"] < 18,
                "plan_name": user["plan"]["name"],
                "interviews_left": db.interviews_left(user),
            })
    return out


@router.post("/users/{user_id}/plan", dependencies=[Depends(require_admin)])
def assign(user_id: int, body: AssignPlan):
    with db.connect() as con:
        if not con.execute("select 1 from users where id = ?", (user_id,)).fetchone():
            raise HTTPException(404, "User not found.")
        plan = con.execute("select * from plans where id = ?", (body.plan_id,)).fetchone()
        if not plan:
            raise HTTPException(404, "Plan not found.")
        if not plan["listed"]:
            raise HTTPException(409, "That plan is unlisted. Relist it first.")
        db.assign_plan(con, user_id, dict(plan))
    return {"ok": True}


@router.get("/plans", dependencies=[Depends(require_admin)])
def plans():
    with db.connect() as con:
        return [dict(r) for r in con.execute(
            "select p.*, (select count(*) from users u where u.plan_id = p.id) as users "
            "from plans p order by p.listed desc, p.id")]


@router.post("/plans", dependencies=[Depends(require_admin)])
def create_plan(body: NewPlan):
    try:
        with db.connect() as con:
            plan_id = con.execute(
                "insert into plans (name, price_inr, days, interviews, daily_minutes, azure_voice) values (?, ?, ?, ?, ?, ?) returning id",
                (" ".join(body.name.split()), body.price_inr, body.days, body.interviews, body.daily_minutes,
                 int(body.azure_voice))).fetchone()["id"]
    except psycopg.IntegrityError:
        raise HTTPException(409, "A plan with that name already exists.")
    return {"id": plan_id}


@router.post("/plans/{plan_id}/listed", dependencies=[Depends(require_admin)])
def set_listed(plan_id: int, body: Listed):
    if plan_id == db.FREE_PLAN_ID and not body.listed:
        raise HTTPException(409, "The Free plan can't be unlisted.")
    with db.connect() as con:
        if not con.execute("update plans set listed = ? where id = ?", (int(body.listed), plan_id)).rowcount:
            raise HTTPException(404, "Plan not found.")
    return {"ok": True}


@router.get("/payments", dependencies=[Depends(require_admin)])
def payments():
    with db.connect() as con:
        return [dict(r) for r in con.execute(
            "select p.id, p.created_at, p.paid_at, p.status, p.outcome, p.amount_paise, p.razorpay_order_id, "
            "p.razorpay_payment_id, pl.name as plan_name, u.name as user_name, u.email, u.phone "
            "from payments p join plans pl on pl.id = p.plan_id left join users u on u.id = p.user_id "
            "order by p.id desc limit 500")]
