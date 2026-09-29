import { canSeeClub } from "./club";

/**
 * Who the Club opens for.
 *
 * This is a name check, not a lock — signing in to this app is a name and
 * nothing else. What it must do is be EXACT: the league has a Jona and a
 * Jonah, and the day someone called Ryanne joins, the door stays shut.
 */

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`);
  }
}

console.log("\nthe Club opens for one name");
{
  check("Ryan gets in", canSeeClub("Ryan"), true);
  for (const other of ["Jona", "Jonah", "Davide", "Philippe", "James", "George"]) {
    check(`${other} does not`, canSeeClub(other), false);
  }
}

console.log("\nand only that name, exactly");
{
  // A prefix match is how Jona ends up seeing Jonah's things.
  check("not a longer name starting the same", canSeeClub("Ryanne"), false);
  check("not a shorter one", canSeeClub("Rya"), false);
  check("not the lower-case spelling", canSeeClub("ryan"), false);
  check("not with a space on the end", canSeeClub("Ryan "), false);
  check("nobody signed in gets nothing", canSeeClub(null), false);
  check("and neither does undefined", canSeeClub(undefined), false);
  check("nor an empty name", canSeeClub(""), false);
}

console.log(failures === 0 ? "\nAll club tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
