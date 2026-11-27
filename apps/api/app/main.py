import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import admin, coach, daily_word, db, jam, payments, placement, quiz, roleplay, tongue_twister, users, word_chain
from app.errors import NoSpeechDetected, ProviderFailed, ProviderUnavailable


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init()
    yield


app = FastAPI(title="English Learning API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    # comma-separated deployed web origins; spaces and trailing slashes would never match the browser's Origin header
    allow_origins=[o.strip().rstrip("/") for o in os.environ.get("WEB_ORIGIN", "http://localhost:3000").split(",") if o.strip()],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",  # any local dev server (web :3000, Expo web :8081)
    allow_methods=["*"],
    allow_headers=["*"],
)
for module in (users, placement, roleplay, coach, jam, daily_word, word_chain, tongue_twister, quiz, payments, admin):
    app.include_router(module.router)


@app.exception_handler(ProviderUnavailable)
async def unavailable(_: Request, e: ProviderUnavailable):
    return JSONResponse({"detail": str(e)}, status_code=503)


@app.exception_handler(ProviderFailed)
async def failed(_: Request, e: ProviderFailed):
    return JSONResponse({"detail": "A service we depend on failed. Please try again."}, status_code=502)


@app.exception_handler(NoSpeechDetected)
async def no_speech(_: Request, e: NoSpeechDetected):
    return JSONResponse({"detail": "No speech detected. Please try again and speak clearly."}, status_code=422)


@app.get("/v1/health")
def health():
    return {"status": "ok"}
