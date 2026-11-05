// The Strava side of gym-by-the-set: a new gym import gets its sets read off
// the description, then keeps being looked at for a while in case the athlete
// writes it afterwards. Runs on the in-memory store with Strava faked.
delete process.env.DATABASE_URL;
import { getStore } from "./db";
import { GYM_SETS_WATCH_MS, fillGymSets, importActivities, type StravaActivity } from "./strava";

let failed = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
}

const descriptions = new Map<number, string>();
let reads = 0;
globalThis.fetch = (async (url: string) => {
  reads++;
  const id = Number(String(url).split("/activities/")[1]);
  return new Response(JSON.stringify({ description: descriptions.get(id) ?? "" }), { status: 200 });
}) as typeof fetch;

function lift(id: number, start: string, moving: number): StravaActivity {
  return { id, sport_type: "WeightTraining", start_date: start, start_date_local: start, moving_time: moving, distance: 0 } as StravaActivity;
}

async function main() {
  const store = getStore();
  // A season that started long ago and an athlete who joined it, so nothing is held back.
  const s = await store.getSettings();
  await store.setSettings({ ...s, seasonStart: "2026-01-01" });
  const ath = await store.findOrCreateAthlete("Tester");
  const sets = async () =>
    (await store.listActivities()).filter((a) => a.sport === "gym").map((a) => a.sets ?? null);

  console.log("\nsets come off the description on import");
  descriptions.set(1, "Lat pulldown — 2 sets\nRow 3x8\nMuskoka #81");
  await importActivities(store, ath.id, [lift(1, "2026-11-06T10:00:00Z", 2400)], "tok");
  check("5 sets", await sets(), [5]);

  console.log("\na description written after the upload is still picked up");
  await importActivities(store, ath.id, [lift(2, "2026-11-07T10:00:00Z", 1800)], "tok");
  check("nothing yet", (await sets()).includes(null), true);
  descriptions.set(2, "2 sets squat\n1 set calf raise");
  await fillGymSets(store, ath.id, [lift(2, "2026-11-07T10:00:00Z", 1800)], "tok");
  check("filled on the next sync", (await sets()).sort(), [3, 5]);

  console.log("\nan athlete's own count is never overwritten, and old sessions are left alone");
  const row = (await store.listActivities()).find((a) => a.sets === 3)!;
  await store.updateActivity(row.id, { sets: 9 });
  descriptions.set(2, "1 set");
  reads = 0;
  await fillGymSets(store, ath.id, [lift(2, "2026-11-07T10:00:00Z", 1800)], "tok");
  check("still 9, and Strava not even asked", [(await sets()).sort(), reads], [[5, 9], 0]);
  await importActivities(store, ath.id, [lift(3, "2026-11-08T10:00:00Z", 1200)], "tok");
  descriptions.set(3, "4 sets");
  reads = 0;
  await fillGymSets(store, ath.id, [lift(3, "2026-11-08T10:00:00Z", 1200)], "tok", Date.now() + GYM_SETS_WATCH_MS + 1);
  check("past the watch window it stops asking", [(await sets()).includes(null), reads], [true, 0]);

  if (failed) {
    console.error(`\n${failed} failing.`);
    process.exit(1);
  }
  console.log("\nAll gym fill tests passed.");
}
main();
