import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import {
  frontierGuardPhrases,
  frontierPhrases,
  loadBalanceSources,
  missingPhrases,
  pageLine,
} from "./check-rendered-balance.mjs";

const dist = fileURLToPath(new URL("../dist", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "rendered-balance-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const {
  frontierPreset: current,
  frontierConfig,
  historicalFrontierPreset: historical,
  previewRiftGuardBound,
  nativeRules,
} = await loadBalanceSources();
const pages = frontierPhrases(frontierConfig, current, previewRiftGuardBound, nativeRules);
const n = (value) => value.toLocaleString("en-US");
const range = (lower, upper) => `${n(lower)}–${n(upper)}`;

test("built current guides match the active preset, including its balance overrides", () => {
  assert.notEqual(current.id, historical.id, "current guides must not select the historical preset");
  assert.deepEqual(missingPhrases(dist, pages), []);
});

function rejectsStaleValue(page, currentText, historicalText) {
  assert.notEqual(currentText, historicalText, "the regression must change a current value");
  const original = pageLine(readFileSync(join(dist, page, "index.html"), "utf8"));
  assert.ok(original.includes(currentText), `the built ${page} must contain ${currentText}`);
  const stale = original.replace(currentText, historicalText);
  mkdirSync(join(scratch, page), { recursive: true });
  writeFileSync(join(scratch, page, "index.html"), `<main>${stale}</main>`);
  const expected = pages.find((entry) => entry.page === page);
  const missing = missingPhrases(scratch, [expected]);
  assert.equal(missing.length, 1, `historical value must fail the rendered check: ${historicalText}`);
  assert.ok(missing[0].run[0].includes(currentText));
}

for (const [index, depth] of current.depths.entries()) {
  for (const strength of ["Weak", "Strong"]) {
    test(`the rendered expedition check rejects historical ${strength.toLowerCase()} beasts at depth ${index}`, () => {
      const row = frontierGuardPhrases(current, previewRiftGuardBound)[index + 1];
      const oldDepth = historical.depths[index];
      const stale = row.replace(
        range(depth[`beast${strength}Lower`], depth[`beast${strength}Upper`]),
        range(oldDepth[`beast${strength}Lower`], oldDepth[`beast${strength}Upper`]),
      );
      rejectsStaleValue("frontier/expedition", row, stale);
    });
  }
}

test("the rendered armies check rejects the Knight reveal cost for Scouts", () => {
  rejectsStaleValue(
    "frontier/armies",
    `${nativeRules.SCOUT_EXPLORE_STAMINA} for Scouts`,
    `${frontierConfig.troop.stamina.staminaExploreStaminaCost} for Scouts`,
  );
});
