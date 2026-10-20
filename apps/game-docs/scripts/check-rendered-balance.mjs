#!/usr/bin/env node
/**
 * Checks the built docs show each mode's own balance: on a page, a label must be followed by the value its mode's
 * generated config holds, and the relic page each relic's cost as the Blitz preset's relic rules set it. Blitz and
 * Eternum differ on these values, so a Blitz component that reads Eternum's config (or a hard-coded number that
 * drifted) fails the build. The text export (llm.txt) must state the same numbers, with no expression left as code.
 * Run after `vocs build`: node scripts/check-rendered-balance.mjs <dist>
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

/**
 * The relic page's runs: each relic's effect, who activates it, and the Essence it costs as the Blitz preset's relic
 * rules (listed from the first relic) set it.
 */
export const relicRuns = (relics, rules, firstRelicId) => [
  {
    page: "blitz/materials/relics",
    runs: relics.map((relic) => [
      relic.effect,
      relic.recipientType === "Explorer" ? "Army" : "Realm",
      String(rules[relic.id - firstRelicId].essence_cost),
    ]),
  },
];

/** Thousands with commas, as the pages write them. */
const n = (value) => value.toLocaleString("en-US");
const pct = (bps) => `${n(bps / 100)}%`;
const DEPTH_NAMES = ["Surface", "Ethereal I", "Ethereal II", "Ethereal III"];
const TIERS = ["common", "uncommon", "rare", "epic", "legendary"];
const POINTS_PRECISION = 1_000_000;

/** Stamina as each mode's prose states it: a phase is one armies tick, and a day six of them. */
const staminaPhrases = (mode, config) => {
  const stamina = config.troop.stamina;
  return [
    {
      page: `${mode}/military/stamina-and-biomes`,
      phrases: [
        `Stamina Regeneration per Phase: ${stamina.staminaGainPerTick} stamina`,
        `Total Stamina Regeneration per Day: ${stamina.staminaGainPerTick * 6} stamina`,
        `the attacker must spend ${stamina.staminaAttackReq} stamina`,
        `The defender simultaneously spends ${stamina.staminaDefenseReq} stamina`,
      ],
    },
    {
      page: `${mode}/worldmap-movement/movement`,
      phrases: [
        `+${stamina.staminaGainPerTick} stamina per Phase`,
        `Exploring an unknown hex always costs ${stamina.staminaExploreStaminaCost} stamina`,
      ],
    },
    { page: `${mode}/key-concepts`, phrases: [`regenerating at +${stamina.staminaGainPerTick} per Phase`] },
  ];
};

/**
 * Frontier's numbers, from its generated config (stamina, tick, start, castle) and its native preset (days' depths,
 * guards, chests), as its four rules pages state them.
 */
const frontierPhrases = (config, preset) => {
  const stamina = config.troop.stamina;
  const tick = config.tick.armiesTickIntervalInSeconds;
  const start = (id) => n(config.startingResources.find((r) => r.resource === id).amount);
  const limit = config.troop.limit;
  const armies = [limit.settlementArmies, limit.cityArmies, limit.kingdomArmies, limit.empireArmies];
  const caps = [
    limit.settlementDeploymentCap,
    limit.cityDeploymentCap,
    limit.kingdomDeploymentCap,
    limit.empireDeploymentCap,
  ];
  const range = (lower, upper) => `${n(lower)}–${n(upper)}`;
  return [
    {
      page: "frontier/introduction",
      phrases: [
        `An army holds ${n(stamina.staminaKnightMax)} stamina and recovers ${stamina.staminaGainPerTick} every ${tick / 60} minutes, so an empty bar fills in ${((stamina.staminaKnightMax / stamina.staminaGainPerTick) * tick) / 3600} hours.`,
        `Revealing a tile costs ${stamina.staminaExploreStaminaCost}, a step over known ground ${stamina.staminaTravelStaminaCost}, and an attack needs ${stamina.staminaAttackReq}.`,
      ],
    },
    {
      page: "frontier/expedition",
      phrases: preset.depths.flatMap((depth, index) => [
        `${DEPTH_NAMES[index]} ${range(depth.siteGuardLower, depth.siteGuardUpper)} ${range(depth.ruinGuardLower, depth.ruinGuardUpper)} ${range(depth.beastWeakLower, depth.beastWeakUpper)} ${range(depth.beastStrongLower, depth.beastStrongUpper)}`,
        `${DEPTH_NAMES[index]} ${depth.revealPercent}%`,
      ]),
    },
    {
      page: "frontier/chests",
      phrases: [
        ...preset.depths.map(
          (depth, index) => `${DEPTH_NAMES[index]} ${TIERS.map((tier) => pct(depth.chest[tier])).join(" ")}`,
        ),
        `Shares ${TIERS.map((tier) => n(preset.chests.shares[tier])).join(" ")}`,
        `never exceeds ${n(preset.chests.priceCeiling)} LORDS`,
      ],
    },
    {
      page: "frontier/realm",
      phrases: [
        `A new realm starts with ${start(26)} troops, ${start(35)} wheat and ${start(23)} labor.`,
        ...armies.map((count, index) => `${index + 1} ${n(count)} ${n(caps[index])}`),
      ],
    },
  ];
};

/** The phrases every rules page that states a stamina, guard, chest or points number must show. */
export const expectedPhrases = (blitz, eternum, frontier, frontierPreset) => [
  ...staminaPhrases("blitz", blitz),
  ...staminaPhrases("eternum", eternum),
  {
    page: "blitz/worldmap-movement/worldmap",
    phrases: [`${n(Number(blitz.victoryPoints.pointsForRelicDiscovery) / POINTS_PRECISION)} victory points`],
  },
  ...frontierPhrases(frontier, frontierPreset),
];

/**
 * The relic table, the Blitz preset's relic rules, Frontier's native preset and the text export's path, read from
 * their TypeScript sources through Vite.
 */
const loadBalanceSources = async () => {
  const { createServer } = await import("vite");
  const server = await createServer({ configFile: false, logLevel: "silent", appType: "custom" });
  try {
    const { RELICS, ResourcesIds } = await server.ssrLoadModule(
      join(here, "../../../packages/types/src/constants/index.ts"),
    );
    const { blitzPreset } = await server.ssrLoadModule(join(here, "../../../config/source/blitz/native.ts"));
    const { frontierPreset } = await server.ssrLoadModule(join(here, "../../../config/source/frontier/native.ts"));
    const { llmTxtFile } = await server.ssrLoadModule(join(here, "../docs/utils/paths.ts"));
    return {
      relics: RELICS,
      rules: blitzPreset.relics,
      firstRelicId: ResourcesIds.StaminaRelic1,
      frontierPreset,
      llmTxtFile,
    };
  } finally {
    await server.close();
  }
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

/** A built page's visible text as one line: nodes joined by a space, whitespace collapsed, none before punctuation. */
export const pageLine = (html) =>
  visibleText(html)
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/ ([:,.;)%])/g, "$1");

/** The phrases a built site does not show, each with its page. */
export const missingPhrases = (dist, pages) =>
  pages.flatMap(({ page, phrases }) => {
    const line = pageLine(readFileSync(join(dist, page, "index.html"), "utf8"));
    return phrases.filter((phrase) => !line.includes(phrase)).map((phrase) => ({ page, run: [phrase] }));
  });

/** The text export's page sections, each as one line with its markdown marks dropped, keyed like the built pages. */
export const exportPages = (llm) =>
  new Map(
    llm.split("\n\n---\n\n").map((section) => [
      section.match(/^file: docs\/pages\/(\S+)\.mdx/)?.[1],
      section
        .replace(/\*\*|\||\\/g, " ")
        .replace(/\s+/g, " ")
        .replace(/ ([:,.;)%])/g, "$1"),
    ]),
  );

/** An expression the export would ship as code instead of the number it stands for. */
const UNEVALUATED = /\{(?:FRONTIER\.|staminaOf\(|victoryPointsOf\(|ETERNUM_CONFIG\()/g;

/** The phrases the text export does not show, and every expression it ships unevaluated, each with its page. */
export const exportProblems = (llm, pages) => {
  const sections = exportPages(llm);
  const missing = pages.flatMap(({ page, phrases }) =>
    phrases
      .filter((phrase) => !(sections.get(page) ?? "").includes(phrase))
      .map((phrase) => ({ page: `llm.txt ${page}`, run: [phrase] })),
  );
  const unevaluated = [...llm.matchAll(UNEVALUATED)].map((match) => ({
    page: "llm.txt",
    run: [`unevaluated ${llm.slice(match.index, match.index + 60).split("\n")[0]}`],
  }));
  return [...missing, ...unevaluated];
};

/** The runs a built site does not show, each with its page. */
export const missingRuns = (dist, pages) =>
  pages.flatMap(({ page, runs }) => {
    const text = visibleText(readFileSync(join(dist, page, "index.html"), "utf8"));
    return runs.filter((run) => !containsRun(text, run)).map((run) => ({ page, run }));
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? join(here, "../dist"));
  const { relics, rules, firstRelicId, frontierPreset, llmTxtFile } = await loadBalanceSources();
  const phrases = expectedPhrases(configOf("blitz"), configOf("eternum"), configOf("frontier"), frontierPreset);
  const missing = [
    ...missingRuns(dist, [
      ...expectedRuns(configOf("blitz"), configOf("eternum")),
      ...relicRuns(relics, rules, firstRelicId),
    ]),
    ...missingPhrases(dist, phrases),
    ...exportProblems(readFileSync(llmTxtFile, "utf8"), phrases),
  ];
  for (const { page, run } of missing) console.error(`${page}: expected "${run.join(" | ")}"`);
  if (missing.length) process.exit(1);
  console.log("Rendered balance and the text export match each mode's config.");
}
