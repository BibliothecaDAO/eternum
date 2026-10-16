#!/usr/bin/env node
/**
 * Checks the built docs show each mode's own balance: on a page, a label must be followed by the value its mode's
 * generated config holds. Blitz and Eternum differ on these values, so a Blitz component that reads Eternum's config
 * (or a hard-coded number that drifted) fails the build. Run after `vocs build`: node scripts/check-rendered-balance.mjs <dist>
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const configOf = (mode) =>
  JSON.parse(readFileSync(join(here, `../../../config/generated/${mode}.madara.json`), "utf8")).configuration;

const WHEAT = 35;
const DONKEY = 25;
const ESSENCE = 38;

/** Each page's expected runs of visible text, each a label then the values its mode's config gives. */
export const expectedRuns = (blitz, eternum) => {
  const firstReward = blitz.blitz.exploration.rewards[0];
  const donkeyWheat = blitz.resources.productionByComplexRecipe[DONKEY].find((input) => input.resource === WHEAT);
  if (firstReward.rewardId !== ESSENCE) throw new Error("the first Blitz exploration reward is no longer Essence");
  return [
    {
      page: "blitz/worldmap-movement/movement",
      runs: [
        ["Stamina on Deployment", String(blitz.troop.stamina.staminaInitial)],
        ["Stamina Gain Per Phase", String(blitz.troop.stamina.staminaGainPerTick)],
        [
          "Essence",
          `${firstReward.percent}%`,
          ((firstReward.percent * blitz.troop.limit.exploreRewardStrengthCap) / 100).toLocaleString("en-US"),
          `${firstReward.probabilityBps / 100}%`,
        ],
      ],
    },
    {
      page: "blitz/materials/production",
      runs: [
        [
          "Donkey Production",
          "Resource",
          "Input Materials (units/s)",
          "Output (units/s)",
          "Donkey",
          String(donkeyWheat.amount),
          String(blitz.resources.productionByComplexRecipeOutputs[DONKEY]),
        ],
      ],
    },
    {
      page: "eternum/worldmap-movement/movement",
      runs: [["Stamina on Deployment", String(eternum.troop.stamina.staminaInitial)]],
    },
  ];
};

/** A built page's visible text, one entry per text node, in order. */
export const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    // React separates adjacent text ("5" and "%") with an empty comment; they read as one.
    .replaceAll("<!-- -->", "")
    .split(/<[^>]+>/)
    .map((text) =>
      text
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .trim(),
    )
    .filter(Boolean);

const containsRun = (text, run) =>
  text.some((_, start) => run.every((expected, offset) => text[start + offset] === expected));

/** The runs a built site does not show, each with its page. */
export const missingRuns = (dist, pages) =>
  pages.flatMap(({ page, runs }) => {
    const text = visibleText(readFileSync(join(dist, page, "index.html"), "utf8"));
    return runs.filter((run) => !containsRun(text, run)).map((run) => ({ page, run }));
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? join(here, "../dist"));
  const missing = missingRuns(dist, expectedRuns(configOf("blitz"), configOf("eternum")));
  for (const { page, run } of missing) console.error(`${page}: expected "${run.join(" | ")}"`);
  if (missing.length) process.exit(1);
  console.log("Rendered balance matches each mode's config.");
}
