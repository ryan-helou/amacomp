import { MAX_DAILY_STEPS, parseStepPayload, stepStandings, toSteps } from "./steps";
import type { Athlete, StepDay } from "./types";

/**
 * Step reports come from a hand-built iOS Shortcut, formatted however the
 * phone's locale likes. These pin the shapes we accept, the window a report may
 * touch, and that a resent day replaces rather than adds. Run with `npm test`.
 */

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`);
  }
}

const TODAY = "2026-09-15";

console.log("\nnumbers the way a phone writes them");
check("plain", toSteps("8532"), 8532);
check("thousands comma", toSteps("8,532"), 8532);
check("non-breaking space (some locales)", toSteps("8 532"), 8532);
check("a decimal Health sum rounds", toSteps(8532.4), 8532);
check("negative is not steps", toSteps(-5), null);
check("absurd is not steps", toSteps(MAX_DAILY_STEPS + 1), null);
check("text is not steps", toSteps("lots"), null);

console.log("\nevery shape a shortcut might send");
const expect2 = [{ day: "2026-09-14", steps: 9100 }, { day: "2026-09-15", steps: 4200 }];
check("days as a list of {date, steps}", parseStepPayload({ days: [{ date: "2026-09-14", steps: "9,100" }, { date: "2026-09-15", steps: 4200 }] }, TODAY).days, expect2);
check("Health field names {day, value}", parseStepPayload({ days: [{ day: "2026-09-14", value: 9100 }, { day: "2026-09-15", value: "4200" }] }, TODAY).days, expect2);
check("a dictionary keyed by date", parseStepPayload({ days: { "2026-09-15": 4200, "2026-09-14": 9100 } }, TODAY).days, expect2);
check("days as a JSON string", parseStepPayload({ days: JSON.stringify([{ date: "2026-09-14", steps: 9100 }, { date: "2026-09-15", steps: 4200 }]) }, TODAY).days, expect2);
check("a bare list", parseStepPayload([{ date: "2026-09-15", steps: 4200 }], TODAY).days, [{ day: "2026-09-15", steps: 4200 }]);
check("a single day", parseStepPayload({ date: "2026-09-15", steps: 4200 }, TODAY).days, [{ day: "2026-09-15", steps: 4200 }]);
check("an ISO timestamp for the date", parseStepPayload({ days: [{ date: "2026-09-15T00:00:00-04:00", steps: 4200 }] }, TODAY).days, [{ day: "2026-09-15", steps: 4200 }]);
check("the whole body as a date dictionary", parseStepPayload({ "2026-09-14": "9,100", "2026-09-15": 4200, token: "x" }, TODAY).days, expect2);
check("the whole body as a JSON string", parseStepPayload(JSON.stringify({ days: [{ date: "2026-09-15", steps: 4200 }] }), TODAY).days, [{ day: "2026-09-15", steps: 4200 }]);

console.log("\na report can only touch recent days");
{
  const r = parseStepPayload({ days: [
    { date: "2026-09-07", steps: 1 }, // 8 days back: too old
    { date: "2026-09-08", steps: 2 }, // 7 days back: fine
    { date: "2026-09-16", steps: 3 }, // a day ahead — a phone in Tokyo
    { date: "2026-09-17", steps: 4 }, // two days ahead: no
  ] }, TODAY);
  check("keeps a week back and a day ahead", r.days.map((d) => d.day), ["2026-09-08", "2026-09-16"]);
  check("and counts what it dropped", r.rejected, 2);
}
check("junk entries are rejected, not fatal", parseStepPayload({ days: [{ date: "nope", steps: 5 }, { date: "2026-09-15", steps: "x" }] }, TODAY), { days: [], rejected: 2 });
check("nothing recognisable is empty", parseStepPayload({ hello: 1 }, TODAY).days, []);

console.log("\na day sent twice keeps the latest, never the sum");
check("last value wins", parseStepPayload({ days: [{ date: "2026-09-15", steps: 4000 }, { date: "2026-09-15", steps: 4200 }] }, TODAY).days, [{ day: "2026-09-15", steps: 4200 }]);

console.log("\nthe board");
{
  const a = (id: string, name: string) => ({ id, name }) as unknown as Athlete;
  const athletes = [a("r", "Ryan"), a("p", "Philippe"), a("j", "Jona")];
  const row = (athleteId: string, day: string, steps: number): StepDay => ({ athleteId, day, steps, updatedAt: "" });
  const steps = [
    row("r", "2026-09-14", 10000), row("r", "2026-09-15", 5000),
    row("p", "2026-09-15", 15000),
    row("j", "2026-09-10", 30000), // outside the window below
  ];
  const week = stepStandings(athletes, steps, ["2026-09-14", "2026-09-20"]);
  check("ranked by steps in the window", week.map((s) => [s.athlete.name, s.steps]), [["Philippe", 15000], ["Ryan", 15000], ["Jona", 0]]);
  check("a tie shares the rank", week.map((s) => s.rank), [1, 1, 3]);
  check("days with steps are counted", week.find((s) => s.athlete.name === "Ryan")?.days, 2);
  check("and the best day is kept", week.find((s) => s.athlete.name === "Ryan")?.best, 10000);
}

console.log(failures === 0 ? "\nAll step tests passed.\n" : `\n${failures} step test(s) FAILED.\n`);
if (failures > 0) process.exit(1);
