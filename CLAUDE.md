# AmaComp — project instructions

> **New session / new Claude account: read
> `~/Developer/CLAUDE_TRANSFER_AUG25/Amagoh Competition.md` IN FULL before doing
> anything in this repo.** It is the complete handoff — standing rules, decisions
> already made, the deploy runbook, known bugs and in-flight work. Do not
> re-litigate decisions recorded there. A git-tracked mirror lives at
> `~/Developer/brain/projects/Amagoh Competition/CLAUDE_TRANSFER_AUG25_AmagohCompetition.md`
> (that folder under `~/Developer` is not a git repo and files there have been
> overwritten by concurrent sessions — prefer the mirror if the two disagree).
>
> **At the end of any substantial session, update both copies.**

## The five things that cause the most damage if you don't know them

1. **`railway up` is the deploy. Pushing to `main` deploys NOTHING** — Railway is
   not watching this repo. Ship with `railway up --service AmagohTrain`, then
   confirm the new code is live by curling the site (the login screen
   server-renders the scoring rates). `/api/health` is a bare `{"ok":true}` and
   tells you nothing about which build is running.

2. **The database settings override `DEFAULT_SETTINGS` in `lib/types.ts`, which is
   stale.** Read the `settings` row before quoting any rate. Live base as of
   2026-08-30: swim 20 · bike 1 · run 5 · gym 5, quota 100. Bike climbing is
   **1 point per 33 m** (stored as 100/33 per 100 m) since 2026-10-10, for all
   time; run ascent counts 100 m as 1 km run.

3. **Scoring rates are DATED.** Points are still derived at read time, but from
   the rates in force on the session's own day — `Settings.rateChanges` +
   `ratesOn(day, settings)`, resolved from each activity's `occurredOn`. A rate
   change moves the weeks ahead of it and leaves the weeks behind it exactly as
   scored, so it can't retroactively hand out or take away a forfeit. Live
   changes: **run 4/km and swim 15/km from Mon 2026-08-31**, **swim 20/km from
   2026-11-01**, **run 5/km from Mon 2026-11-02** (Ryan: "dont change the past"). The exceptions are
   retroactive by Ryan's instruction and live in the BASE rates, not in
   `rateChanges`: the open water rate, run ascent, and bike climbing (1 per 33 m,
   set 2026-10-10 by the one-off in `lib/migrations.ts`). A retroactive change is
   recorded in `settings.retroChanges` so the app can announce it. Each change is a
   PARTIAL override — never write all four rates into one entry, or you reset
   bike and gym to the stale code defaults. `pointsFor` requires a day argument
   on purpose.

4. **`lib/strava.ts` imports `server-only`**, which throws under a plain `tsx` run.
   Anything importing it needs `tsx --conditions=react-server`. That's why
   `npm test` is two commands.

5. **`Jona` and `Jonah` are two different athletes.** Never match an athlete by
   prefix; match exactly or refuse.

6. **Push to `main` and deploy, every change** (Ryan, 2026-08-30: "ALWAYS DEPLOY
   MAIN ALL CHANGES"). No PRs here. The push alone deploys nothing — see rule 1.

7. **The Bible rule (lib/bible), from 2026-11-03.** A session scores only if
   its athlete ticked "I read the Bible today" for that day (`bible_days`).
   Applied in the STORE's `listActivities` (stamps `bibleMissing`), so every
   scoring path agrees; `activityPoints` returns 0 for it. Grants are exempt.
   Ticks are today-only. The QA seed ticks everyone for today.

8. **The day rolls over at 3 AM, league-wide** (`RESET_HOUR` in `lib/dates.ts`).
   The board turns over at midnight (`viewDayAt`) but a session logged before
   3 AM still counts for the day, and week, that is ending (`logDayAt`). The old
   per-athlete `resetHour` is gone; `athletes.reset_hour` is a vestigial column.

## Gate before shipping

```bash
npm run typecheck && npx eslint lib components app scripts && npm test && npm run build
```

A test must be load-bearing: verify it fails against the unfixed code before you
claim it covers anything.

## And for anything with a button, drive the UI

```bash
NEXT_PUBLIC_CLUB_LIVE=1 npx next build
DATABASE_URL= SESSION_SECRET=qa NEXT_PUBLIC_CLUB_LIVE=1 npx next start -p 3177 &
python3 scripts/qa.py
```

**The var has to be on BOTH lines.** `NEXT_PUBLIC_*` is inlined into the client
bundle at BUILD time and read from the environment at RUN time, so a build
without it and a server with it disagree about `CLUB_LIVE` — React throws
hydration error #418, the non-admin's page never hydrates, and every button he
owns silently does nothing. It looks exactly like a broken feature. It has cost
three debugging detours; it is not a bug in the app.

`scripts/qa.py` walks every screen in both palettes, as the admin and as a
regular athlete, then presses everything that writes and checks the number
actually moved. It seeds its own league and refuses to run against the live app.

It exists because of the gift bug (0cb04e1): the screen rendered perfectly and
blanked the app the moment anybody tapped the button, because the route
answered with a partial payload. Every endpoint called through `useLeague`'s
`send` MUST return `readState()` — the whole state, never `{ ok: true }` — and
a feature exercised only through its API is not a feature that has been tested.
