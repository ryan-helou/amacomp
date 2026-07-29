# Amagoh

A weekly points competition for a small group training triathlon. Log the
kilometres you swim, bike and run; each discipline is worth a different number
of points; hit the weekly quota and stay ahead of your friends on the board.

Built to be added to the home screen from Safari — it installs and behaves like
an app, no App Store involved.

## How it works

- **Name-only login.** Five friends, no passwords. Type the same name each time
  and your history follows you.
- **Points per kilometre**, set per discipline. Defaults: swim **25**, bike
  **1**, run **5**. Weekly quota **75 points**.
- **Four sections:** Log a session, your Week (quota pace-clock), the Board
  (leaderboard for today / week / month / all-time), and the Feed (everyone's
  sessions).
- **Edit or delete** your own sessions any time.
- **One admin** (Ryan by default) can change the scoring. Changing a multiplier
  re-scores every session ever logged — nobody keeps points earned under a rule
  that no longer exists.

## Stack

Next.js (App Router) · Postgres on Railway · Tailwind v4 · installable PWA. No
database needed to run locally — it falls back to an in-memory store.

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no `DATABASE_URL` set, data lives in memory and
resets when the server restarts.

## Environment

| Variable         | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `DATABASE_URL`   | Postgres connection string. Unset → in-memory store |
| `SESSION_SECRET` | Signs the login cookie                              |
| `ADMIN_NAME`     | The one athlete allowed to edit scoring (`Ryan`)    |

## Deploy

Pushed to Railway (`AmagohTrain` service + Postgres). `railway up` builds with
Nixpacks and runs `npm run start`.
