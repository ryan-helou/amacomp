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
   stale.** Read the `settings` row before quoting any rate.

3. **Points are derived at read time**, never frozen — changing a multiplier
   re-scores the whole season for everyone, instantly. Cheap to apply
   retroactively; easy to do damage with.

4. **`lib/strava.ts` imports `server-only`**, which throws under a plain `tsx` run.
   Anything importing it needs `tsx --conditions=react-server`. That's why
   `npm test` is two commands.

5. **`Jona` and `Jonah` are two different athletes.** Never match an athlete by
   prefix; match exactly or refuse.

## Gate before shipping

```bash
npm run typecheck && npx eslint lib components app scripts && npm test && npm run build
```

A test must be load-bearing: verify it fails against the unfixed code before you
claim it covers anything.
