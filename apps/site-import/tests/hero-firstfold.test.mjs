import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("Hero first fold is full-viewport and left aligned", () => {
  const intro = read("src/components/sections/IntroSection.tsx");

  assert.match(
    intro,
    /min-h-\[100vh\]|min-h-screen/,
    "Expected hero section to occupy full viewport height"
  );
  assert.match(
    intro,
    /text-left/,
    "Expected hero layout to be left aligned"
  );
});

test("Hero uses staged classy entrance animations", () => {
  const intro = read("src/components/sections/IntroSection.tsx");

  assert.match(
    intro,
    /initial=\{\{\s*opacity:\s*0,\s*x:\s*-?\d+/,
    "Expected content panel to animate in with horizontal motion"
  );
  assert.match(
    intro,
    /transition=\{\{\s*duration:\s*0\.[0-9]+,\s*ease:\s*"\w+"/,
    "Expected explicit easing for refined intro animation"
  );
});

test("Hero narrative is world-first with mythic CTA language", () => {
  const intro = read("src/components/sections/IntroSection.tsx");

  assert.match(
    intro,
    /One Agent\./,
    "Expected the headline to lead with a singular autonomous champion"
  );
  assert.match(
    intro,
    /Every Realm\./,
    "Expected the headline to position coverage across the full world"
  );
  assert.match(
    intro,
    /Enter the Realms/,
    "Expected primary CTA to feel like entering a world"
  );
  assert.match(
    intro,
    /Track Live Rollout/,
    "Expected secondary CTA to focus on campaign progress"
  );
});

test("Hero includes summoning gate motifs and reduces SaaS stat framing", () => {
  const intro = read("src/components/sections/IntroSection.tsx");

  assert.match(
    intro,
    /hero-summoning-panel/,
    "Expected dedicated summoning panel wrapper in hero"
  );
  assert.match(
    intro,
    /hero-sigil-ring/,
    "Expected runic ring motif for the hero visual anchor"
  );
  assert.match(
    intro,
    /hero-ember-field/,
    "Expected ember field layer for atmospheric motion"
  );
  assert.doesNotMatch(
    intro,
    /Ecosystem TVL/,
    "Expected finance-forward dashboard labels to be removed from hero"
  );
});
