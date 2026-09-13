import { closingPhase, seasonClosingMessages, SOON_DAYS } from "./seasonClose";
import type { Standing } from "./scoring";

/** Season-closing notifications. Run with `npm test`. */

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`);
  }
}

const row = (id: string, name: string, points: number, rank: number) =>
  ({ athlete: { id, name }, points, rank }) as unknown as Standing;

console.log("\nwhen each message goes");
check("a week out: nothing", closingPhase(7), null);
check(`${SOON_DAYS + 1} days out: nothing yet`, closingPhase(SOON_DAYS + 1), null);
check(`${SOON_DAYS} days out: the heads-up`, closingPhase(SOON_DAYS), "soon");
check("a missed morning still gets it the next day", closingPhase(SOON_DAYS - 1), "soon");
check("the day before", closingPhase(1), "soon");
check("the last day", closingPhase(0), "final");
check("after it's over: nothing", closingPhase(-1), null);

console.log("\neach person is told where THEY stand");
{
  const table = [row("p", "Philippe", 900, 1), row("r", "Ryan", 860, 2), row("j", "Jona", 500, 3), row("h", "Jonah", 0, 4)];
  const m = Object.fromEntries(seasonClosingMessages(table, 3, "Season 1").map((x) => [x.athleteId, x]));
  check("the title names the season and the day", m.p.title, "Season 1 ends Sunday");
  check("the leader hears who is closest and by how much", m.p.body, "You lead Ryan by 40 pts. 3 days left.");
  check("second hears the gap to the leader", m.r.body, "You're 2nd, 40 pts off Philippe. 3 days left.");
  check("third too", m.j.body, "You're 3rd, 400 pts off Philippe. 3 days left.");
  check("someone on zero is told the state of the race, not their gap", m.h.body, "Philippe leads it on 900 pts. 3 days left.");
  check("everyone gets one", Object.keys(m).length, 4);
}

console.log("\nthe last day says when it actually closes");
{
  const table = [row("p", "Philippe", 900, 1), row("r", "Ryan", 860, 2)];
  const m = Object.fromEntries(seasonClosingMessages(table, 0, "Season 1").map((x) => [x.athleteId, x]));
  check("title", m.p.title, "Last day of Season 1");
  check("the 3 AM rollover is spelled out", m.r.body, "You're 2nd, 40 pts off Philippe. It closes tonight — anything before 3 AM still counts.");
}

console.log("\na shared lead is not a lead");
{
  const table = [row("p", "Philippe", 900, 1), row("r", "Ryan", 900, 1), row("j", "Jona", 500, 3)];
  const m = Object.fromEntries(seasonClosingMessages(table, 1, "Season 1").map((x) => [x.athleteId, x]));
  check("co-leaders are told they're level", m.p.body, "You're level at the top with Ryan. 1 day left.");
  check("and so is the other one", m.r.body, "You're level at the top with Philippe. 1 day left.");
  check("the chaser is chasing both", m.j.body, "You're 3rd, 400 pts off Philippe and Ryan. 1 day left.");
}

console.log("\nnothing to say");
check("outside the run-in", seasonClosingMessages([row("p", "Philippe", 900, 1)], 10, "Season 1"), []);
check("nobody has scored", seasonClosingMessages([row("p", "Philippe", 0, 1)], 2, "Season 1"), []);

console.log(failures === 0 ? "\nAll season-close tests passed.\n" : `\n${failures} season-close test(s) FAILED.\n`);
if (failures > 0) process.exit(1);
