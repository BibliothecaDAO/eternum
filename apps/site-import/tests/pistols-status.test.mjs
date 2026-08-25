import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("Pistols at Dawn is marked as coming soon (not live)", () => {
  const gamesData = read("src/data/games.ts");
  const pistolsBlockMatch = gamesData.match(
    /\{\s*id:\s*8,[\s\S]*?slug:\s*"pistols-at-dawn"[\s\S]*?\n\s*\},/
  );

  assert.ok(pistolsBlockMatch, "Expected to find Pistols at Dawn game block");
  const pistolsBlock = pistolsBlockMatch[0];

  assert.match(
    pistolsBlock,
    /status:\s*"development"/,
    "Expected Pistols at Dawn status to be development"
  );
  assert.match(
    pistolsBlock,
    /isLive:\s*false/,
    "Expected Pistols at Dawn to be development and not live"
  );
});
