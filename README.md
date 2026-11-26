# AI English Learning App

Product plan and feature overview. Navyanexus, November 2026.

## 1. Vision

A voice-first app that helps people speak English confidently through AI conversation practice, spoken feedback, tests and games. It explains in the learner's own language when they need it and moves them towards thinking in English as they improve.

**What makes it different:** most English apps focus on reading and tapping. This one centres on speaking, using speech-to-text (STT) and text-to-speech (TTS), so learners get real feedback on their spoken English.

### Target Audience

- **Casual Learners:** anyone who wants to speak English more confidently in daily life, through short practice sessions and games
- **Students:** school and college learners building everyday and academic English
- **Professionals:** working people improving client calls, emails, meetings and presentations

## 2. Core Features

### AI Role-Play Practice
Realistic spoken conversations with an AI partner that adapts to the learner's level, followed by a debrief on mistakes and more natural phrasing.

- **Job Interview:** HR rounds, technical intros, "tell me about yourself"
- **Everyday Conversation:** small talk, ordering food, travel, shopping
- **Customer Calls:** support calls, sales calls, handling complaints
- **More scenarios:** visa interviews, meetings, presentations, phone etiquette

### Written Tests
Grammar, vocabulary and writing tests at each level, including short writing tasks (emails, paragraphs) that the AI corrects with explanations.

### Find the Mistakes
Spot and fix errors in sentences drawn from the learner's own past mistakes in role-plays and tests (a personal mistake bank), so practice targets real weak points.

### Reading & Speaking Tests
Answer spoken questions, scored on grammar, vocabulary and fluency (reading aloud returns with pronunciation scoring). The same test is the placement test, taken after the learner's first try of a game or role-play (not as a signup blocker).

### Accent-Specific Mode (UK, US, Indian)
Understand and practise UK, US or Indian English. The goal is clarity and comprehension, not "fixing" an accent.

- **Pronunciation differences:** sounds, stress and intonation for each accent
- **Vocabulary differences:** flat / apartment, lift / elevator, petrol / gas
- **Listening practice:** native voices for each accent at adjustable speeds

### Pronunciation Scoring (deferred)
*Removed from the MVP to cut cost; planned for Phase 2.*

Phoneme-level feedback showing exactly which sound was off (e.g. v/w, th, z/j, or wrong word stress).

### Mother-Tongue Support
Explanations in Hindi, Hinglish or a regional language, switching gradually to English:

- **Beginner:** explanations in their language, practice in English
- **Intermediate:** mostly English, with their language on request ("Hindi mein samjhao")
- **Advanced:** English only

## 3. Games

Four games covering pronunciation, vocabulary and fluency. All earn XP and post high scores to leaderboards.

### Tongue Twister Challenge
A tongue twister plays once, then the learner says it as clearly and quickly as they can. Levels get longer and faster.
- **Score:** pronunciation accuracy × speed bonus; accuracy carries more weight (needs pronunciation scoring)
- **Social:** weekly "Twister of the Week" with a friends leaderboard

### Word Chain
Each spoken word must start with the last letter of the previous word, against a timer. Played against the AI or turn by turn with a friend.
- **Score:** points per valid word, bonus for longer or rarer words, no repeats
- **Fairness:** shows the word the app heard, with one retry per game if it misheard; recognition is constrained to valid dictionary words, since STT is weakest on single isolated words

### JAM: Just a Minute
A random topic, 10 seconds to think, then 60 seconds of speaking. Short AI feedback after each round.
- **Score:** fluency, pauses, filler words (umm, basically, like), repetition, vocabulary and grammar
- **Social:** one shared daily topic so friends can compare scores

### Daily Word
One five-letter word a day for everyone, solved in six guesses. (Never use "Wordle" in names or marketing; it is a New York Times trademark.)
- **Learning twist:** after solving, see the meaning, an example and the pronunciation, then use the word in a spoken sentence for bonus points
- **Social:** shareable result grid for WhatsApp, plus daily streaks

## 4. Social & Motivation

- **Friends:** add friends by contact or invite link
- **Leaderboards:** friends and all players, reset weekly so new players can compete
- **"Beat My Score" Challenges:** send a challenge link over WhatsApp, which also brings in new users
- **XP, Streaks, Badges & Leagues:** daily habit building with Bronze, Silver and Gold leagues
- **Fair Matchmaking:** compete against others at a similar level
- **Progress Dashboard:** scores over time, fluency trends, weak sounds and filler-word reduction
- **Smart Review (Spaced Repetition):** past mistakes and new vocabulary return at the right intervals

## 5. Technology Stack

| Layer | Choice | Why |
|---|---|---|
| Web App | Next.js (React + TypeScript) | Fast to build, good for SEO and landing pages |
| Mobile App | React Native (Expo) | Same language as the web app, shared code and types |
| Backend API | Python FastAPI | Best fit for speech and AI tooling |
| Real-time Voice | LiveKit (role-play only) | Low-latency live conversation; tests and games record then upload over plain HTTP, which is simpler and more reliable on bad networks |
| Database, Auth, Storage | Supabase (PostgreSQL + Auth + Storage) | One service for users, progress, mistake bank, leaderboards, login (email, phone OTP, Google) and any stored audio |
| Cache / Queues | None for MVP; Redis later | Postgres handles leaderboards and jobs at early scale; add Redis only when load measurements show the need |
| Analytics | PostHog | Track engagement and drop-off |
| Error Tracking | Sentry | Know when voice sessions and provider calls fail |
| Hosting Region | India (Mumbai) | Lower voice latency and data residency |

## 6. AI & Speech APIs (Options)

| Purpose | Options | Notes |
|---|---|---|
| Pronunciation Scoring (deferred) | Azure Pronunciation Assessment, SpeechSuper, Speechace, ELSA API, Langcraft | SpeechSuper / Azure recommended first; phoneme-level scores. Benchmark on real Indian learner audio and check the reference accent, so Indian English is not penalised as wrong |
| Speech-to-Text | Sarvam AI, Deepgram, Reverie, Gladia, Whisper, Google, Azure | Must handle Indian accents and Hinglish; benchmark on real learner audio |
| Text-to-Speech | Sarvam Bulbul, Gnani.ai, Smallest AI, ElevenLabs, Azure, Google | Sarvam for Hinglish; ElevenLabs / Azure for native UK and US voices |
| AI Tutor (LLM) | Claude, GPT, Gemini; open models later | Role-play, corrections, explanations, feedback |
| Grammar Check | LanguageTool | Open source, can be self-hosted |
| Dictionary | Wordnik, Oxford, Free Dictionary API | Word Chain validation and vocabulary |
| Translation | Sarvam Translate, IndicTrans2, Google Translate | Mother-tongue explanations |

Keep each provider's calls in a single backend module, so a vendor can be swapped during an outage or price change without touching the rest of the app.

## 7. Platform Approach: Web First, Then Mobile

Build the web app first to prove the product, then add the mobile app on the same backend:

- **API-first backend:** all logic lives in the backend; web and mobile are both just clients
- **Token-based login:** the same authentication works on web and mobile
- **Flexible audio handling:** the backend accepts browser and phone audio formats and converts them
- **Versioned API (`/v1`):** older mobile app versions keep working after updates
- **Shared code (monorepo):** web and mobile share types and logic, so mobile is mostly new screens
- **Mobile extras planned early:** push notifications for streaks, microphone permissions, in-app account deletion (App Store requirement). Offline mode is limited to reading content, since scoring needs the server

## 8. Launch Requirements

These must be in place before real users arrive.

### Costs & Monetization
- Every speaking minute costs money (STT + LLM + TTS). Track cost per user per day from day one
- Free tier with a daily speaking limit (e.g. X minutes/day); paid plan removes or raises it
- Payments: Razorpay on web; App Store / Play Store billing for digital purchases in the mobile app (stores take 15–30%)
- Rate limiting on all AI and speech endpoints to prevent abuse

### Fair Scoring
- All scores (games, tests, challenges, leaderboards) are computed on the server from the audio; the client never sends its own score

### Privacy & Data (India DPDP Act; GDPR if serving the EU)
- Age check at signup; verifiable parental consent for users under 18
- Audio is not stored by default: score it, then discard it. If kept, use a clear retention limit and explicit consent
- In-app account and data deletion
- Data hosted in India
- Have a lawyer review consent and retention flows before launch

### Child Safety
- Content filtering on usernames and AI role-play responses
- Report and block options for friends and challenges
- Leaderboards limited to friends-only for minors

### AI Output
- The AI tutor returns mistakes in a fixed structure (type, original text, correction, explanation) from day one; the mistake bank, Find the Mistakes and spaced repetition depend on it

## Development

```
apps/api     FastAPI backend (/v1 endpoints)
apps/web     Next.js web app
apps/mobile  React Native (Expo) app, same API and sign-in (see apps/mobile/README.md)
```

**API** (first time: `cd apps/api`, `python -m venv .venv`, `.venv\Scripts\pip install -r requirements.txt`, copy `.env.example` to `.env` and fill in the Azure and OpenAI keys):

```
cd apps/api
.venv\Scripts\uvicorn app.main:app --reload --env-file .env
.venv\Scripts\python -m pytest
```

**Sign-in** (Supabase Auth; data stays in the API's database):

1. Create a Supabase project (region: Mumbai). Under Authentication > URL Configuration set the Site URL to `http://localhost:3000` (your real domain in production) and add it to Redirect URLs.
2. Google: in Google Cloud Console create an OAuth client (Web application); add `http://localhost:3000` (and your domain) to Authorized JavaScript origins, and the callback URL shown on Supabase's Authentication > Providers > Google page to Authorized redirect URIs. Paste the client ID and secret into that Supabase page and enable it.
3. Web `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public key). API `.env`: `SUPABASE_URL`, plus `SUPABASE_SECRET_KEY` so deleting an account also deletes the sign-in, and `SUPABASE_JWT_SECRET` only if the project still uses the legacy JWT secret.

**Web** (first time: `cd apps/web`, `npm install`, copy `.env.example` to `.env.local`):

```
cd apps/web
npm run dev
npm test
```

Open http://localhost:3000.

**MVP shortcuts** (local only; replace before real users): SQLite database (`apps/api/data.db`) instead of Supabase Postgres, mobile numbers kept unique but not verified by SMS, a checkbox for parental consent instead of a verifiable flow, turn-based role-play over HTTP instead of LiveKit, an in-memory rate limiter, and Tongue Twister scored by word match against the transcript × speed instead of pronunciation scoring (the AI adds 15 new twisters to a shared pool each day; each level draws from the pool by length). The MCQ quiz (`/quiz`) mixes a built-in grammar bank, AI-written questions (kept only when a second AI pass answers them the same way) and vocabulary questions with built-in meanings plus Free Dictionary API examples; if the AI is unavailable, the bank fills in. AI model: OpenAI (`OPENAI_MODEL` in `.env`). Speech-to-text uses OpenAI `gpt-transcribe`, with silence trimmed on the server first. The AI voice is Azure Speech (standard voice) on plans that include it; others hear the browser's built-in voice. Plans (Free: 1 resume interview; Interview Pack: ₹99 for 90 days, 10 interviews, Azure voice) set each user's interviews, daily speaking minutes and voice. Learners buy plans on `/plans` through Razorpay (`RAZORPAY_*` in `.env`; test keys first). Set `ADMIN_PASSWORD` in `.env` and open `/admin` to see users and payments, switch a user's plan by hand, and create or unlist plans.

## 9. Roadmap

### Phase 1: MVP (Web)
- [x] Placement test (spoken questions)
- [x] AI role-play: interview and everyday conversation
- [x] Daily Word and JAM
- [x] Mother-tongue explanations (Hinglish)
- [x] Basic progress tracking, XP and streaks
- [x] Launch requirements done: daily speaking limit, rate limiting, server-side scoring, age check, data deletion, content filtering
- [x] Real login: Supabase Auth (Google, email + password with email confirmation and password reset), one account per mobile number
- [x] Payments: Razorpay one-time plans on web (`/plans`); upgrades start now, cheaper plans start when the current one ends
- [ ] Launch requirements still open: per-user AI cost tracking, verifiable parental consent, SMS verification of mobile numbers, hosted database

> To launch faster, Phase 1 can be trimmed to: placement test, AI role-play and one game. The rest follow once there are real users.

### Phase 2: Engagement
- [ ] Pronunciation scoring with feedback (removed from the MVP to cut cost)
- [x] Tongue Twister and Word Chain (Tongue Twister scored on word match × speed until pronunciation scoring)
- [ ] Friends, leaderboards and "Beat My Score" challenges
- [x] Mistake Coach: hands-free spoken session on the learner's recent mistakes, explained in English or Hinglish (`/coach`)
- [ ] Find the Mistakes with personal mistake bank and spaced repetition
- [ ] Written tests and writing correction (MCQ grammar and vocabulary quiz done; writing correction open)
- [ ] More role-play scenarios, including customer calls

### Phase 3: Scale
- [ ] Mobile app (React Native / Expo)
- [ ] Accent-Specific Mode (UK, US, Indian)
- [ ] More regional languages
- [ ] Live 1v1 game duels
