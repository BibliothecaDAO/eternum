import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("Game detail route: uses themed stage wrapper", () => {
  const route = read("src/routes/games/$slug.tsx");

  assert.match(
    route,
    /createFileRoute\("\/games\/\$slug"\)/,
    "Expected game detail route registration to remain /games/$slug"
  );
  assert.match(
    route,
    /realm-games-detail-stage/,
    "Expected game detail page wrapper to use themed stage class"
  );
});

test("Game details component: uses themed hero, stats, gallery and links", () => {
  const details = read("src/components/game/GameDetails.tsx");

  assert.match(
    details,
    /Campaign Brief|realm-banner/,
    "Expected themed campaign hero copy in game details"
  );
  assert.match(
    details,
    /realm-games-detail-hero/,
    "Expected dedicated themed hero utility"
  );
  assert.match(
    details,
    /realm-games-detail-stats|realm-games-detail-stat/,
    "Expected themed stats grid utilities"
  );
  assert.match(
    details,
    /realm-games-detail-gallery/,
    "Expected themed screenshot gallery utility"
  );
  assert.match(
    details,
    /realm-games-detail-links/,
    "Expected themed links section utility"
  );
  assert.match(
    details,
    /realm-panel/,
    "Expected game details sections to use shared themed panel system"
  );
});
