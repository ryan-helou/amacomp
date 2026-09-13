import { shouldReload } from "./update";

/** Self-update rules. Run with `npm test`. */

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`);
  }
}

const base = { clientBuild: "old", serverBuild: "new", lastReloadedFor: null, editing: false };

console.log("\na newer build reloads the page");
check("different build, idle: reload", shouldReload(base), true);
check("same build: stay", shouldReload({ ...base, serverBuild: "old" }), false);

console.log("\nit never costs anyone what they are typing");
check("mid-entry: wait", shouldReload({ ...base, editing: true }), false);

console.log("\nit cannot loop");
check("already reloaded for this build: stop", shouldReload({ ...base, lastReloadedFor: "new" }), false);
check("but a build newer again still reloads", shouldReload({ ...base, serverBuild: "newer", lastReloadedFor: "new" }), true);

console.log("\nno answer is not an answer");
check("offline: stay", shouldReload({ ...base, serverBuild: null }), false);
check("dev (no build id): stay", shouldReload({ ...base, clientBuild: undefined }), false);

console.log(failures === 0 ? "\nAll update tests passed.\n" : `\n${failures} update test(s) FAILED.\n`);
if (failures > 0) process.exit(1);
