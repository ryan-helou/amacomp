import { canPreviewAvatar, keyAccepted } from "./club";

/**
 * The gate on unfinished work.
 *
 * Signing in to this app is a name and nothing else, so "are you Ryan?" was
 * never a question the client could be trusted to answer. What follows is the
 * question the server asks instead — and the failure that matters most is the
 * one where nobody set a key at all.
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

const KEY = "a7f3d9c1e5b28406fa3d";

console.log("\nthe key opens the door and nothing else does");
{
  check("the right key opens it", keyAccepted(KEY, KEY), true);
  check("a wrong key of the same length doesn't", keyAccepted("b7f3d9c1e5b28406fa3d", KEY), false);
  check("nor one character off at the end", keyAccepted("a7f3d9c1e5b28406fa3e", KEY), false);
  check("nor a prefix of the real one", keyAccepted(KEY.slice(0, -1), KEY), false);
  check("nor the key with something added", keyAccepted(`${KEY}x`, KEY), false);
  check("no key at all is refused", keyAccepted(null, KEY), false);
  check("and so is an empty one", keyAccepted("", KEY), false);
}

console.log("\nan unset key locks the door, it doesn't remove it");
{
  // The dangerous default: deploy without the variable, compare "" to "", and
  // every phone in the league walks straight in.
  check("no key on the server opens nothing", keyAccepted("", undefined), false);
  check("not even with a matching empty string", keyAccepted("", ""), false);
  check("and a guess opens nothing either", keyAccepted("anything", undefined), false);
  // A short key is a typo or a placeholder, not a secret worth honouring.
  check("a laughably short key is refused", keyAccepted("letmein", "letmein"), false);
}

console.log("\nthe client is told yes or no, and can't argue");
{
  check("granted means granted", canPreviewAvatar(true), true);
  check("not granted means not", canPreviewAvatar(false), false);
  check("and neither does missing", canPreviewAvatar(undefined), false);
}

console.log(failures === 0 ? "\nAll preview tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
