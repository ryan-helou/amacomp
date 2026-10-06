import { freeCoins } from "./coins";
import { onTheLine, type Bet } from "./bets";
import { DEFAULT_SETTINGS } from "./types";
import type { Athlete, Settings } from "./types";
import type { CoinGrant } from "./types";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}

const S: Settings = { ...DEFAULT_SETTINGS, seasonStart: "2026-08-03" };
const today = "2026-10-06";
const who = (id: string) => ({ id, name: id, avatarColor: null, avatarGlyph: null, avatarUrl: null, weightKg: null }) as Athlete;
const people = [who("george"), who("alberto"), who("jona")];
// 200 coins each, by grant, and no sessions — so the only thing that moves a
// balance in here is a bet.
const grants = people.map((p, i) => ({ id: `g${i}`, athleteId: p.id, amount: 200, note: "", day: "2026-10-01" })) as CoinGrant[];
let n = 0;
const bet = (over: Partial<Bet>): Bet => ({
  id: `b${n++}`, kind: "word", terms: "x", fromId: "alberto", toId: "george", metric: "points",
  period: "week", startsOn: "2026-10-05", stake: 150, state: "accepted", note: "",
  createdAt: "2026-10-05T10:00:00Z", decidedAt: "2026-10-05T11:00:00Z",
  calledBy: null, calledWinner: null, settledWinner: null, ...over,
});
const free = (id: string, bets: Bet[], except?: string) =>
  freeCoins(id, people, [], S, today, grants, [], bets, [], [], except).free;

console.log("\nyou can't put up coins you've already put up");
{
  const running = [bet({})];  // George is in a 150 bet that hasn't finished
  check("George's balance is still 200", free("george", []), 200);
  check("but only 50 of it is free", free("george", running), 50);
  check("so a second 150 bet is more than he can cover", 150 > free("george", running), true);
}

console.log("\nwhat counts as on the line");
{
  const offerFromMe = bet({ fromId: "george", toId: "", state: "open" });
  const offerToMe = bet({ fromId: "alberto", toId: "george", state: "open" });
  check("my own standing offer is on the line", onTheLine("george", [offerFromMe], people, [], S, today), 150);
  check("an offer made TO me isn't, until I take it", onTheLine("george", [offerToMe], people, [], S, today), 0);
  check("a settled bet isn't", onTheLine("george", [bet({ settledWinner: "george" })], people, [], S, today), 0);
  check("a declined one isn't", onTheLine("george", [bet({ state: "declined" })], people, [], S, today), 0);
  check("taking a bet doesn't count it against itself",
    free("alberto", [offerToMe], offerToMe.id), 200);
}

if (failures) { console.error(`\n${failures} failing.`); process.exit(1); }
console.log("\nAll stake tests passed.");
