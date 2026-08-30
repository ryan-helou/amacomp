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
   2026-08-30: swim 20 · bike 1 · run 5 · gym 5, climb 1/100m on the bike,
   quota 100.

3. **Scoring rates are DATED.** Points are still derived at read time, but from
   the rates in force on the session's own day — `Settings.rateChanges` +
   `ratesOn(day, settings)`, resolved from each activity's `occurredOn`. A rate
   change moves the weeks ahead of it and leaves the weeks behind it exactly as
   scored, so it can't retroactively hand out or take away a forfeit. Live
   change: **run 4/km and swim 15/km from Mon 2026-08-31**. Each change is a
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

7. **The day rolls over at 3 AM, league-wide** (`RESET_HOUR` in `lib/dates.ts`).
   The board turns over at midnight (`viewDayAt`) but a session logged before
   3 AM still counts for the day, and week, that is ending (`logDayAt`). The old
   per-athlete `resetHour` is gone; `athletes.reset_hour` is a vestigial column.

## Gate before shipping

```bash
npm run typecheck && npx eslint lib components app scripts && npm test && npm run build
```

A test must be load-bearing: verify it fails against the unfixed code before you
claim it covers anything.
