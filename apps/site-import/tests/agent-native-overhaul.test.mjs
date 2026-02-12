import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("Homepage route includes agent-native and atlas section anchors", () => {
  const homeRoute = read("src/routes/index.tsx");

  assert.match(
    homeRoute,
    /id="agent-native"/,
    "Expected homepage to include an agent-native section anchor"
  );
  assert.match(
    homeRoute,
    /id="ecosystem-atlas"/,
    "Expected homepage to include an ecosystem-atlas section anchor"
  );
  assert.doesNotMatch(
    homeRoute,
    /id="games"/,
    "Expected duplicate homepage games section to be removed"
  );
});

test("Intro hero derives live game count from shared games data", () => {
  const intro = read("src/components/sections/IntroSection.tsx");

  assert.match(
    intro,
    /games\.filter\(\(game\) => game\.isLive\)\.length/,
    "Expected live game count to be derived from the games dataset"
  );
});

test("Agent rollout message is present in hero copy", () => {
  const intro = read("src/components/sections/IntroSection.tsx");

  assert.match(
    intro,
    /rolling out across games/i,
    "Expected rollout wording in hero copy"
  );
});

test("Header keeps only Games/Scroll while section links move to right rail", () => {
  const topBar = read("src/components/layout/TopBar.tsx");

  assert.match(
    topBar,
    /to="\/games"/,
    "Expected header nav to keep Games link"
  );
  assert.match(
    topBar,
    /to="\/scroll"/,
    "Expected header nav to keep Scroll link"
  );
  assert.match(
    topBar,
    /Section rail navigation/,
    "Expected a right-side vertical section rail"
  );
  assert.match(
    topBar,
    /Agent Native/,
    "Expected section rail to include Agent Native"
  );
  assert.match(
    topBar,
    /Ecosystem Atlas/,
    "Expected section rail to include Ecosystem Atlas"
  );
  assert.doesNotMatch(
    topBar,
    /id:\s*"games",\s*label:\s*"Games",\s*href:\s*"#games"/,
    "Expected header section anchors to drop removed duplicate games block"
  );
});

test("Header style aligns with agent-native revamp", () => {
  const topBar = read("src/components/layout/TopBar.tsx");

  assert.match(
    topBar,
    /bg-black\/45/,
    "Expected a darker mythic header surface"
  );
  assert.match(
    topBar,
    /Go to homepage/,
    "Expected logo button to remain for homepage navigation"
  );
  assert.doesNotMatch(
    topBar,
    /Agent-native ecosystem/,
    "Expected agent-native text block to be removed from header"
  );
  assert.doesNotMatch(
    topBar,
    /Explore Ecosystem/,
    "Expected extra header CTA to be removed"
  );
  assert.doesNotMatch(
    topBar,
    /LORDS:/,
    "Expected legacy LORDS ticker to be removed from header"
  );
});

test("Background scene uses a Mobius strip centerpiece", () => {
  const bg = read("src/components/RealmSceneBackground.tsx");

  assert.match(
    bg,
    /createMobiusStripGeometry/,
    "Expected explicit Mobius strip geometry generator"
  );
  assert.match(
    bg,
    /mobiusStrip/i,
    "Expected Mobius strip mesh usage in scene composition"
  );
  assert.doesNotMatch(
    bg,
    /new THREE\.TorusGeometry\(2\.6, 0\.12, 24, 140\)/,
    "Expected legacy torus centerpiece to be removed"
  );
});

test("Partners section uses shared partner data source", () => {
  const partnersSection = read("src/components/sections/PartnersSection.tsx");

  assert.match(
    partnersSection,
    /from "@\/data\/partners"/,
    "Expected partners section to consume shared data module"
  );
  assert.doesNotMatch(
    partnersSection,
    /const partners = \[/,
    "Expected inline partner list duplication to be removed"
  );
});
