import { betCoins, betResult, betValue, duplicateBet, type Bet } from "./bets";
import { sortBounties, bountyCoins, isOpen, type Bounty } from "./bounties";
import { coinAccount } from "./coins";
import { DEFAULT_SETTINGS, type Activity, type Athlete } from "./types";

/** The Arena: bets settle off the board, bounties settle off Ryan. */

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`);
  }
}

const S = { ...DEFAULT_SETTINGS, seasonStart: "2026-08-03" };
const ath = (id: string, name: string): Athlete =>
  ({ id, name, weightKg: null, avatarColor: null, avatarGlyph: null, avatarUrl: null });
const PEOPLE = [ath("a", "Ana"), ath("b", "Ben")];

function run(id: string, who: string, day: string, km: number): Activity {
  return { id, athleteId: who, sport: "run", km, occurredOn: day, note: null, source: "strava",
    points: null, elevationM: null, openWater: null, movingSeconds: null, localHour: 12,
    createdAt: "2026-09-01T10:00:00Z" };
}

/** Mon 28 Sep – Sun 4 Oct 2026. */
const bet = (over: Partial<Bet> = {}): Bet => ({
  id: "x", fromId: "a", toId: "b", metric: "km", period: "week",
  startsOn: "2026-09-28", stake: 100, state: "accepted", note: "",
  createdAt: "2026-09-27T10:00:00Z", decidedAt: "2026-09-27T11:00:00Z", ...over,
});

console.log("\nthe board settles it, not the men");
{
  const log = [run("1", "a", "2026-09-29", 12), run("2", "b", "2026-09-30", 9)];
  // While the window is open there is a score but no winner. A bet that could
  // be settled early is one a man can be told he has lost on a Wednesday.
  const mid = betResult(bet(), PEOPLE, log, S, "2026-09-30");
  check("it is live inside the window", mid.status, "live");
  check("with both of them showing", [mid.from, mid.to], [12, 9]);
  check("and nobody has won yet", mid.winnerId, null);

  // The last day of the window is still inside it.
  check("Sunday is not over yet", betResult(bet(), PEOPLE, log, S, "2026-10-04").status, "live");

  const done = betResult(bet(), PEOPLE, log, S, "2026-10-05");
  check("Monday settles it", done.status, "settled");
  check("the one with more wins", done.winnerId, "a");
  check("and it is not a push", done.push, false);
}

console.log("\nonly what happened INSIDE the window counts");
{
  const log = [
    run("1", "a", "2026-09-27", 50),   // the Sunday before: not this bet
    run("2", "b", "2026-09-29", 9),
    run("3", "a", "2026-10-05", 50),   // the Monday after: not this bet either
  ];
  const r = betResult(bet(), PEOPLE, log, S, "2026-10-05");
  check("Ana's 100 km outside the week count for nothing", r.from, 0);
  check("so Ben takes it on 9", r.winnerId, "b");
}

console.log("\na draw is a push, and a push moves nothing");
{
  const log = [run("1", "a", "2026-09-29", 10), run("2", "b", "2026-09-30", 10)];
  const r = betResult(bet(), PEOPLE, log, S, "2026-10-05");
  check("level is settled", r.status, "settled");
  check("with nobody named", r.winnerId, null);
  check("and flagged a push", r.push, true);
  check("so no coins move", betCoins("a", bet(), PEOPLE, log, S, "2026-10-05"), null);
}

console.log("\nan offer nobody took is not a bet");
{
  const log = [run("1", "a", "2026-09-29", 10), run("2", "b", "2026-09-30", 2)];
  for (const state of ["open", "declined", "cancelled"] as const) {
    check(`${state}: pays nobody`, betCoins("a", bet({ state }), PEOPLE, log, S, "2026-10-05"), null);
  }
  check("accepted: pays", betCoins("a", bet(), PEOPLE, log, S, "2026-10-05")?.amount, 100);
}

console.log("\nthe stake comes off one and lands on the other");
{
  const log = [run("1", "a", "2026-09-29", 10), run("2", "b", "2026-09-30", 2)];
  check("the winner is up the stake", betCoins("a", bet(), PEOPLE, log, S, "2026-10-05")?.amount, 100);
  check("the loser is down the same", betCoins("b", bet(), PEOPLE, log, S, "2026-10-05")?.amount, -100);
  check("a bystander is in neither", betCoins("c", bet(), PEOPLE, log, S, "2026-10-05"), null);

  // The whole reason settlement is derived: the wallet must agree with it.
  const wallet = coinAccount("b", PEOPLE, log, S, "2026-10-05", [], [], [bet()], []);
  const line = wallet.entries.find((e) => e.kind === "bet");
  check("the wallet carries the loss as a line", line?.amount, -100);
  check("in the loser's words", line?.label, "Lost to Ana on distance");
  const won = coinAccount("a", PEOPLE, log, S, "2026-10-05", [], [], [bet()], []);
  check("and the winner's", won.entries.find((e) => e.kind === "bet")?.label, "Beat Ben on distance");
}

console.log("\na rescored week moves the bet with it");
{
  // This is the point of deriving the outcome. Ana wins on the log as it
  // stands; strike her run off a fortnight later and the bet follows the
  // table instead of leaving a paid-out bet disagreeing with it.
  const full = [run("1", "a", "2026-09-29", 10), run("2", "b", "2026-09-30", 2)];
  const struck = full.filter((x) => x.id !== "1");
  check("Ana wins on the full log", betResult(bet(), PEOPLE, full, S, "2026-10-05").winnerId, "a");
  check("Ben wins once it is struck off", betResult(bet(), PEOPLE, struck, S, "2026-10-05").winnerId, "b");
  check("and the wallet follows",
    coinAccount("a", PEOPLE, struck, S, "2026-10-05", [], [], [bet()], []).entries
      .find((e) => e.kind === "bet")?.amount, -100);
}

console.log("\nbetting on one sport counts that sport");
{
  const log = [
    run("1", "a", "2026-09-29", 10),
    { ...run("2", "b", "2026-09-29", 40), sport: "bike" as const },
  ];
  const range: [string, string] = ["2026-09-28", "2026-10-04"];
  check("Ana's running", betValue("a", "run", PEOPLE, log, S, range), 10);
  check("Ben did none", betValue("b", "run", PEOPLE, log, S, range), 0);
  check("but he rode 40", betValue("b", "bike", PEOPLE, log, S, range), 40);
  check("so a run bet goes to Ana", betResult(bet({ metric: "run" }), PEOPLE, log, S, "2026-10-05").winnerId, "a");
  check("and a bike bet to Ben", betResult(bet({ metric: "bike" }), PEOPLE, log, S, "2026-10-05").winnerId, "b");
}

console.log("\nthe same bet twice is one bet");
{
  const open = [bet({ id: "1", state: "open" })];
  check("the same pair, same week, same thing", duplicateBet(open, "a", "b", "km", "2026-09-28")?.id, "1");
  check("and it doesn't matter who asks", duplicateBet(open, "b", "a", "km", "2026-09-28")?.id, "1");
  check("a different week is a different bet", duplicateBet(open, "a", "b", "km", "2026-10-05"), undefined);
  check("so is a different metric", duplicateBet(open, "a", "b", "run", "2026-09-28"), undefined);
  check("and a declined one is not in the way",
    duplicateBet([bet({ state: "declined" })], "a", "b", "km", "2026-09-28"), undefined);
}

console.log("\nbounties pay when Ryan says so, and not before");
const bounty = (over: Partial<Bounty> = {}): Bounty => ({
  id: "y", title: "Swim at the lake", detail: "", coins: 200, state: "open",
  postedBy: "a", claimedBy: null, claimedAt: null, expiresOn: null,
  createdAt: "2026-09-20T10:00:00Z", ...over,
});
{
  check("open pays nobody", bountyCoins("b", bounty()), 0);
  check("claimed pays nobody either", bountyCoins("b", bounty({ state: "claimed", claimedBy: "b" })), 0);
  check("paid pays the claimant", bountyCoins("b", bounty({ state: "paid", claimedBy: "b" })), 200);
  check("and nobody else", bountyCoins("a", bounty({ state: "paid", claimedBy: "b" })), 0);
  check("the wallet carries it",
    coinAccount("b", PEOPLE, [], S, "2026-10-05", [], [], [],
      [bounty({ state: "paid", claimedBy: "b" })]).entries.find((e) => e.kind === "bounty")?.amount, 200);
}

console.log("\nan expired bounty is closed, not hidden");
{
  check("still open before the date", isOpen(bounty({ expiresOn: "2026-10-05" }), "2026-10-04"), true);
  check("open ON the date", isOpen(bounty({ expiresOn: "2026-10-05" }), "2026-10-05"), true);
  check("closed after it", isOpen(bounty({ expiresOn: "2026-10-05" }), "2026-10-06"), false);
  check("no date means it stands", isOpen(bounty(), "2030-01-01"), true);
  // It must still be in the list: one that vanishes looks like a bug to
  // whoever was halfway through it.
  const board = sortBounties([bounty({ id: "live" }), bounty({ id: "gone", expiresOn: "2026-01-01" })], "2026-10-06");
  check("both are still on the board", board.map((b) => b.id), ["live", "gone"]);
  check("with the takeable one first", board[0].id, "live");
}

console.log(failures === 0 ? "\nAll arena tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
