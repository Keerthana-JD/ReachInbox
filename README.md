# ReachInbox – Email Job Scheduler

A full-stack email scheduler: Express + TypeScript + BullMQ + Redis + Postgres + Elasticsearch on the backend, Next.js + Tailwind + Google login on the frontend.

---

## 1. Architecture Overview

**How scheduling works**
Every "send this email at time X" request is stored two places:
1. Postgres (`emails` table) – the source of truth, used to render the dashboard.
2. BullMQ, as a **delayed job** in Redis (`emailQueue`). The job's `delay` option is
   `scheduledTime - now`. Redis itself wakes the job up at the right time —
   there is no `setInterval`, no `node-cron`, nothing polling on a timer.

**How persistence on restart works**
BullMQ doesn't store jobs in the Node process's memory — it stores them in Redis
(a sorted set of delayed jobs). Redis, in turn, writes to disk via the Docker volume
in `docker-compose.yml`. So if you kill and restart `npm run dev` / `npm run worker`,
nothing is lost: Redis still has every delayed job, and the worker just reconnects
and keeps consuming them. Try it: schedule an email 2 minutes out, kill the worker,
restart it — it still fires on time.

**How idempotency (no double-send) works**
When a job is added, its BullMQ `jobId` is set to the email's own UUID
(`emailQueue.add(..., { jobId: emailId })`). This gives each email a
deterministic queue-level job ID and prevents duplicate jobs with the same
job ID while that BullMQ job record exists. As a second layer of safety,
the worker also checks `emails.status` in Postgres before sending — if it
is already `'sent'`, it skips.

**How concurrency + rate limiting work**
- `WORKER_CONCURRENCY` (env var) controls how many jobs one worker processes in
  parallel — passed straight into BullMQ's `Worker({ concurrency })`.
- Hourly limits are enforced with a **Redis counter per sender per hour**
  (`ratelimit:{senderId}:{YYYY-MM-DDTHH}`), incremented atomically with `INCR`.
  This is safe even if you run multiple worker processes, because they all share
  the same Redis — an in-memory counter would NOT be safe across processes.
- When a sender's counter goes over its limit, the worker does **not** fail or drop
  the job. It calls BullMQ's `job.moveToDelayed()` to push that exact job to the
  start of the next hour, then throws `DelayedError` (the official BullMQ pattern
  for "pause and resume this job later" without losing or duplicating it).
- `MIN_DELAY_BETWEEN_EMAILS_MS` adds a minimum gap between two sends from the same
  sender, tracked via a `lastsend:{senderId}` key in Redis.

**Slack notification**
"Connect Slack" does a real Slack OAuth v2 `incoming-webhook` flow. The resulting
webhook URL is stored per user. The moment a sender's hourly limit is hit, the
worker POSTs a message to that webhook — a live network call, not a log line. If
the user never connected Slack, the notifier just returns quietly (checked via a
DB lookup) — no crash, and it starts working immediately once they do connect,
no redeploy needed.

**Search**
The assignment requires Elasticsearch, and this build implements search using
Elasticsearch. Email documents are indexed when scheduled and updated when their
status changes to `sent` or `failed`. Search is exposed through
`GET /api/emails/search?q=...` and is scoped to the logged-in user's email. The
frontend's search bar (top of the dashboard email list) calls this endpoint live
as you type.

**Multiple senders**
Senders live in a `senders` table (name, Ethereal SMTP credentials, default hourly
limit). Each sender gets its own independent rate-limit counter and min-delay
tracker in Redis, keyed by `senderId` — so one sender hitting its limit never
affects another. Chosen from a dropdown in the Compose panel.

---

## 2. How to run it

### Prereqs
- Node.js 18+, Docker Desktop, a Google Cloud project, a Slack app (both free, both take ~5 min — instructions below).

### Step 1 — Infra
```bash
cd backend
docker compose up -d      # starts Postgres + Redis + Elasticsearch
cp .env.example .env      # then fill in the values (see Step 2-4 below)
npm install
npm run migrate           # creates tables
```

### Step 2 — Get Ethereal (fake SMTP) credentials
```bash
npx ts-node src/scripts/createEtherealAccount.ts
```
Copy the printed `user`/`pass` into `src/scripts/seedSenders.ts`, then:
```bash
npx ts-node src/scripts/seedSenders.ts
```
(Run it twice with different fake accounts/limits to get 2 senders for the demo.)

### Step 3 — Google OAuth (real login)
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth Client ID → type "Web application"
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID + Secret into **both** `backend/.env` and `frontend/.env.local`

### Step 4 — Slack OAuth (real "Connect Slack")
1. Go to https://api.slack.com/apps → "Create New App" → "From scratch"
2. Under **OAuth & Permissions**, add redirect URL: `http://localhost:4000/api/slack/callback`
3. Under **Scopes → Bot Token Scopes**, this app just needs `incoming-webhook`
   (Slack adds it automatically once you request the webhook scope in the auth URL — already wired in `slack.ts`)
4. Copy Client ID + Secret into `backend/.env` as `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`

### Step 5 — Run backend (2 terminals)
```bash
cd backend
npm run dev       # terminal 1: the API server + live Bull Board dashboard
npm run worker    # terminal 2: the BullMQ worker (this is what actually sends emails)
```
- API: http://localhost:4000
- Live queue dashboard: **http://localhost:4000/admin/queues**

### Step 6 — Run frontend
```bash
cd frontend
cp .env.local.example .env.local   # fill in Google creds
npm install
npm run dev
```
Open http://localhost:3000 → Sign in with Google → you're on the dashboard.

---

## 3. Features implemented

**Backend:** BullMQ delayed-job scheduler (no cron) · Redis+Docker persistence
across restarts · idempotent job IDs · configurable worker concurrency · Redis-backed
per-sender hourly rate limiting with automatic reschedule to next hour · minimum
delay between sends · multiple senders via Ethereal SMTP · live Bull-Board queue
dashboard · real Slack OAuth + webhook alert on rate-limit hit · CSV/TXT lead
upload & parsing · Elasticsearch-backed full-text search across scheduled and
sent emails.

**Frontend:** real Google OAuth login (NextAuth) · sidebar layout with user
profile card, name/email, and logout · Scheduled/Sent navigation with live
counts · live search bar wired to the Elasticsearch endpoint · Compose slide-in
panel (sender dropdown, chip-based recipient tags, manual + CSV/TXT upload with
live recipient count, subject, body, delay-between-emails, hourly limit, and a
"Send Later" quick-pick/custom date-time scheduler) · loading and empty states on
both email lists · Connect Slack button with connected/not-connected state.

## 4. API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/emails/senders` | Get available senders |
| POST | `/api/emails/upload-leads` | Upload and parse CSV/TXT leads |
| POST | `/api/emails/schedule` | Schedule emails |
| GET | `/api/emails/scheduled` | Get scheduled emails |
| GET | `/api/emails/sent` | Get sent/failed emails |
| GET | `/api/emails/search?q=...` | Elasticsearch email search |

## 5. Assumptions / shortcuts
- Auth between frontend↔backend is a simple `x-user-email` header rather than a
  full session/JWT system, to keep the demo scope realistic for the time budget.
- The Compose body field is plain text, not a full rich-text/WYSIWYG editor — the
  toolbar icons are visual only. The body is still sent as real HTML to Ethereal.
- Email file/image attachments are not implemented — not required by the
  assignment spec.
- Not load-tested at the literal 1000+ concurrent-email scale; the design
  (one delayed BullMQ job per email + Redis-backed limiter) does not change at
  that scale, but this wasn't empirically verified.
