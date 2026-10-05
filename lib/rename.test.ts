// Renaming, through the in-memory store — never a real database.
delete process.env.DATABASE_URL;

async function main() {
  const { getStore } = await import("./db");
  const { renameInSettings, nameProblem } = await import("./rename");
  const { goalFor } = await import("./scoring");
  const { DEFAULT_SETTINGS } = await import("./types");

  let failures = 0;
  const check = (label: string, actual: unknown, expected: unknown) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`}`);
    if (!ok) failures++;
  };

  console.log("\nonce a day");
  const store = getStore();
  const jonah = await store.findOrCreateAthlete("Jonah");
  await store.findOrCreateAthlete("Jona");
  check("a first rename goes through", await store.renameAthlete(jonah.id, "Big J", "2026-10-06"), "ok");
  check("a second one the same day doesn't", await store.renameAthlete(jonah.id, "Bigger J", "2026-10-06"), "too-soon");
  check("the next day it does", await store.renameAthlete(jonah.id, "Bigger J", "2026-10-07"), "ok");

  console.log("\nnobody takes a name that's already in use");
  check("not Jona's", await store.renameAthlete(jonah.id, "Jona", "2026-10-08"), "taken");
  check("not even in other letters", await store.renameAthlete(jonah.id, "JONA", "2026-10-09"), "taken");

  console.log("\nJonah's quota goes with his name");
  const S = { ...DEFAULT_SETTINGS, goalChanges: [{ from: "2026-09-14", goals: { Jonah: 50 } }] };
  const moved = renameInSettings(S, "Jonah", "Big J");
  check("under his new name he is still on 50", goalFor("Big J", moved, "2026-09-21"), 50);
  check("and the old name holds nothing", goalFor("Jonah", moved, "2026-09-21"), S.weeklyGoal);
  check("a man with no override is untouched", renameInSettings(S, "Ryan", "R"), S);

  console.log("\nthe same rules as signing up");
  check("blank", nameProblem(""), "Enter your name to continue.");
  check("an emoji start", !!nameProblem("🔥Jona"), true);
  check("a normal name", nameProblem("Jean-Luc O'Neil"), null);

  console.log(failures === 0 ? "\nAll rename tests passed.\n" : `\n${failures} failing.\n`);
  process.exit(failures === 0 ? 0 : 1);
}
main();

export {};
