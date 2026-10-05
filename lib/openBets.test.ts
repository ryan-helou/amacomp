// An offer to anyone, end to end through the store — the in-memory one, so
// make sure nothing points this at a real database.
delete process.env.DATABASE_URL;

async function main() {
const { getStore } = await import("./db");
const { ANYONE, isOpenToAll, duplicateBet, betResult } = await import("./bets");
const { DEFAULT_SETTINGS } = await import("./types");

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}

const store = getStore();
const ryan = await store.findOrCreateAthlete("Ryan");
const jona = await store.findOrCreateAthlete("Jona");
const alberto = await store.findOrCreateAthlete("Alberto");

console.log("\nan offer to anyone");
const offer = await store.addBet({
  fromId: ryan.id, toId: ANYONE, kind: "board", terms: "", metric: "points",
  period: "week", startsOn: "2026-10-05", stake: 100, note: "",
});
check("has nobody on the other side yet", offer.toId, "");
check("and reads as open to all", isOpenToAll(offer), true);
check("and as an offer, not a running bet",
  betResult(offer, [ryan, jona, alberto], [], { ...DEFAULT_SETTINGS, seasonStart: "2026-08-03" }, "2026-10-06").status,
  "offered");

console.log("\nthe first man to take it is the other side");
check("the man who made it can't take it", await store.takeBet(offer.id, ryan.id), null);
const taken = await store.takeBet(offer.id, jona.id);
check("Jona takes it", taken?.toId, jona.id);
check("and it is running", taken?.state, "accepted");
check("Alberto, a moment later, gets nothing", await store.takeBet(offer.id, alberto.id), null);
const after = (await store.listBets()).find((b) => b.id === offer.id)!;
check("it is still Jona's", after.toId, jona.id);
check("and no longer open to all", isOpenToAll(after), false);

console.log("\nno two identical offers to anyone");
const again = { fromId: ryan.id, metric: "points" as const, startsOn: "2026-10-12" };
await store.addBet({ ...again, toId: ANYONE, kind: "board", terms: "", period: "week", stake: 50, note: "" });
check("the same offer twice is caught",
  !!duplicateBet(await store.listBets(), again.fromId, ANYONE, again.metric, again.startsOn), true);

console.log(failures === 0 ? "\nAll open-bet tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
}

main();
