import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("Games route: uses a stylized full-width war-table layout", () => {
  const route = read("src/routes/games/index.tsx");

  assert.match(
    route,
    /createFileRoute\("\/games\/"\)/,
    "Expected games route file to remain registered at /games/"
  );
  assert.match(
    route,
    /realm-games-stage/,
    "Expected games page to use a dedicated themed stage wrapper"
  );
  assert.match(
    route,
    /War Table Directory/,
    "Expected stronger themed hero copy for the games landing page"
  );
  assert.match(
    route,
    /Live Realms|Studios Forging|Mainnet Live/,
    "Expected summary metrics row in the landing hero"
  );
  assert.match(
    route,
    /realm-games-feature/,
    "Expected a featured lead game treatment"
  );
  assert.match(
    route,
    /realm-games-grid/,
    "Expected dedicated stylized game grid utility"
  );
});
