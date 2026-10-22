#!/usr/bin/env node
/**
 * Checks the built docs show each mode's own balance: on a page, a label must be followed by the value its mode's
 * generated config holds, and the relic page each relic's cost as the Blitz preset's relic rules set it. Blitz and
 * Eternum differ on these values, so a Blitz component that reads Eternum's config (or a hard-coded number that
 * drifted) fails the build. The text export (llm.txt) must state the same numbers, with no expression left as code.
 * Run after `vocs build`: node scripts/check-rendered-balance.mjs <dist>
 */
import fg from "fast-glob";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
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
      page: "blitz/map",
      runs: [
        [
          "Essence",
          `${firstReward.percent}%`,
          ((firstReward.percent * blitz.troop.limit.exploreRewardStrengthCap) / 100).toLocaleString("en-US"),
          `${firstReward.probabilityBps / 100}%`,
        ],
      ],
    },
    {
      page: "blitz/realms",
      runs: [
        [
          "Donkeys",
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
    page: "blitz/map",
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

/** Blitz's stamina as its armies page states it: per army tick, in seconds. */
/** A tier's damage multiplier over T1's, from its 64.64 fixed-point config value. */
const tierWeight = (multiplier) => n(Number(BigInt(multiplier) / 2n ** 64n));

const blitzStaminaPhrases = (config) => {
  const stamina = config.troop.stamina;
  const damage = config.troop.damage;
  return [
    {
      page: "blitz/armies",
      phrases: [
        `recovers ${stamina.staminaGainPerTick} every ${config.tick.armiesTickIntervalInSeconds} seconds`,
        `Exploring a tile costs ${stamina.staminaExploreStaminaCost}`,
        `Attacking takes ${stamina.staminaAttackReq} stamina`,
        `The defender spends ${stamina.staminaDefenseReq} stamina`,
        `each side waits up to ${config.battle.cooldownSeconds} seconds`,
        `After a ranged attack, both sides wait ${Math.floor(config.battle.cooldownSeconds / 2)} seconds.`,
        `The tier weights are 1 for T1, ${tierWeight(damage.t2DamageMultiplier)} for T2 and ${tierWeight(damage.t3DamageMultiplier)} for T3.`,
      ],
    },
  ];
};

/** One Knight's wheat, as its recipe takes it per troop made: Frontier deploys Knights only. */
const wheatPerTroop = (config) =>
  config.resources.productionBySimpleRecipe[26].find((input) => input.resource === 35).amount /
  config.resources.productionBySimpleRecipeOutputs[26];

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
      page: "frontier/armies",
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
        `take ${n(preset.board.rationStep)} wheat off the ${n(wheatPerTroop(config))} wheat each troop costs to deploy`,
        ...armies.map((count, index) => `${index + 1} ${n(count)} ${n(caps[index])}`),
      ],
    },
  ];
};

/**
 * The entry page says a sword and a shield each cost one entry: true only while both registered prices equal the entry
 * fee. Otherwise the page must state the prices themselves, which it does not, so the check fails.
 */
const flagPrices = (ledger) => {
  const entry = lordsOf(ledger.entry_fee);
  const sword = lordsOf(ledger.sword_price);
  const shield = lordsOf(ledger.shield_price);
  return sword === entry && shield === entry
    ? "Each costs one entry."
    : `A sword costs ${sword} LORDS and a shield ${shield} LORDS.`;
};

const lordsOf = (amount) => n(Number(BigInt(amount.low) + (BigInt(amount.high) << 128n)) / 1e18);

/** Where an entry goes, as the page states it: all of it to the chest reserve and the treasury. */
const entrySplit = (ledger) => {
  if (ledger.chest_lords_bps + ledger.protocol_cut_bps !== 10_000)
    throw new Error("Blitz's entry also funds the prize pool: the prize page states a two-way split");
  return `split two ways: ${pct(ledger.chest_lords_bps)} to the chest reserve and ${pct(ledger.protocol_cut_bps)} to the treasury`;
};

/**
 * The one chest every band draws, as the page states it. The page has no band table and names no cosmetic, so chests
 * whose bands differ, or that can draw a cosmetic, fail here rather than let the page go stale.
 */
const chestDraw = (chests) => {
  const [band] = chests.bands;
  const same = chests.bands.every(
    (each) => JSON.stringify(each) === JSON.stringify({ ...band, metadata: each.metadata }),
  );
  if (!same) throw new Error("Blitz's chest bands differ: the prize page states one chest for every band");
  if (TIERS.some((tier) => band.odds[tier] > 0))
    throw new Error("Blitz's chests can draw a cosmetic: the prize page names none");
  const worth = band.lords_shares === 1 ? "one entry's worth" : `${n(band.lords_shares)} entries' worth`;
  return `${worth} of LORDS (${pct(band.odds.lords)}), a sword credit (${pct(band.odds.sword)}) or a shield credit (${pct(band.odds.shield)})`;
};

/**
 * Blitz's entry and prizes, from the ledger and chest presets production registers (config/deployer/clean/ledger/
 * economics.ts, chestPresetFor), as the entry, prize and armies pages state them.
 */
const blitzLedgerPhrases = (blitz, ledger, chests) => {
  const reserve = blitz.startingResources.find((stack) => stack.resource === 26).amount;
  return [
    {
      page: "blitz/entry",
      phrases: [`at the season's entry fee (${lordsOf(ledger.entry_fee)} LORDS this season)`, flagPrices(ledger)],
    },
    {
      page: "blitz/scoring",
      phrases: [
        entrySplit(ledger),
        chestDraw(chests),
        `Ratings are measured against a reference mean of ${n(ledger.mmr.mean)}`,
        `A game's base rating change is capped at ${ledger.mmr.max_delta}, less in a small game; then a sword doubles a gain and a shield halves a loss`,
        `The best ${pct(ledger.paid_fraction_bps)} of the season's players`,
        `each place after it ${pct(ledger.decay_bps)} of the share above`,
      ],
    },
    {
      page: "blitz/armies",
      phrases: [
        `Each starts with ${n(blitz.troop.limit.startingGuard)} T1 troops of its type garrisoned and ${n(reserve)} in reserve`,
      ],
    },
  ];
};

/** The phrases every rules page that states a stamina, guard, chest or points number must show. */
export const expectedPhrases = (blitz, eternum, frontier, frontierPreset, ledger, chests) => [
  ...blitzStaminaPhrases(blitz),
  ...staminaPhrases("eternum", eternum),
  {
    page: "blitz/map",
    phrases: [
      `Opening a crate scores ${n(Number(blitz.victoryPoints.pointsForRelicDiscovery) / POINTS_PRECISION)} points`,
    ],
  },
  ...frontierPhrases(frontier, frontierPreset),
  ...blitzLedgerPhrases(blitz, ledger, chests),
];

/**
 * The relic table, the Blitz preset's relic rules, Frontier's native preset, the text export's path and Blitz's
 * ledger and chest presets, read from
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
    const { buildLedgerEconomicPreset, chestPresetFor } = await server.ssrLoadModule(
      join(here, "../../../config/deployer/clean/ledger/economics.ts"),
    );
    // The pages describe production: its chests and ledger preset, as setup registers them.
    const chests = chestPresetFor("production");
    const ledger = buildLedgerEconomicPreset("blitz", { environment: "production", chests });
    return {
      relics: RELICS,
      rules: blitzPreset.relics,
      firstRelicId: ResourcesIds.StaminaRelic1,
      frontierPreset,
      llmTxtFile,
      ledger,
      chests,
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

const mdx = remark().use(remarkMdx).use(remarkGfm);

/**
 * Every `{expression}` the export still holds, by page: the generator writes each value it renders, so any left is a
 * value shipped as code, whatever its name.
 */
const unevaluatedExpressions = (llm) =>
  llm.split("\n\n---\n\n").flatMap((section) => {
    const page = section.match(/^file: (\S+)/)?.[1] ?? "llm.txt";
    const body = section.replace(/^file: .*\nmeta: (\{[\s\S]*?\n\}|\{\})\n\n/, "");
    const left = [];
    const walk = (node) => {
      for (const child of node.children ?? []) {
        if (child.type === "mdxTextExpression" || child.type === "mdxFlowExpression") left.push(child.value);
        walk(child);
      }
    };
    walk(mdx.parse(body));
    return left.map((value) => ({ page: `llm.txt ${page}`, run: [`unevaluated {${value}}`] }));
  });

/** The phrases the text export does not show, and every expression it ships unevaluated, each with its page. */
export const exportProblems = (llm, pages) => {
  const sections = exportPages(llm);
  const missing = pages.flatMap(({ page, phrases }) =>
    phrases
      .filter((phrase) => !(sections.get(page) ?? "").includes(phrase))
      .map((phrase) => ({ page: `llm.txt ${page}`, run: [phrase] })),
  );
  return [...missing, ...unevaluatedExpressions(llm)];
};

/**
 * Values no page may show: NaN or Infinity (a key read wrong), and the u64 maximum in any scale (a limit the game sets to
 * "none", which a page states in words). A zero from a missing key fails earlier, at prerender (`ETERNUM_CONFIG`).
 */
const FORBIDDEN_VALUES = [/\bNaN\b/, /\bInfinity\b/, /18,?446,?744,?073/];

/** Each forbidden value a text shows, with a little of what surrounds it. */
const forbiddenIn = (text) =>
  FORBIDDEN_VALUES.flatMap((pattern) => {
    const match = text.match(pattern);
    return match ? [`forbidden value: …${text.slice(Math.max(0, match.index - 60), match.index + 30)}…`] : [];
  });

/** Every built page, and the text export, showing a forbidden value. */
export const forbiddenValues = (dist, llm) => [
  ...fg
    .sync("**/index.html", { cwd: dist })
    .flatMap((file) =>
      forbiddenIn(pageLine(readFileSync(join(dist, file), "utf8"))).map((found) => ({ page: file, run: [found] })),
    ),
  ...forbiddenIn(llm).map((found) => ({ page: "llm.txt", run: [found] })),
];

/**
 * Every table, header cell or cell in the built pages that sets its own inline font size or leading. The reading scale's
 * table step lives in docs/styles.css alone (--docs-table-size, --docs-table-leading), so a component table reads it as an
 * MDX table does; a size of its own would override it.
 */
export const tableSizeOverrides = (dist) =>
  fg.sync("**/index.html", { cwd: dist }).flatMap((file) =>
    [...readFileSync(join(dist, file), "utf8").matchAll(/<(table|thead|tbody|tr|th|td)\b[^>]*\bstyle="([^"]*)"/g)]
      .map(([, tag, style]) => [tag, style.match(/(?:font-size|line-height):\s*[^;]+/)?.[0]])
      .filter(([, size]) => size !== undefined)
      .map(([tag, size]) => ({
        page: file,
        run: [`<${tag}> sets its own ${size}; tables read the reading scale's step`],
      })),
  );

/** The runs a built site does not show, each with its page. */
export const missingRuns = (dist, pages) =>
  pages.flatMap(({ page, runs }) => {
    const text = visibleText(readFileSync(join(dist, page, "index.html"), "utf8"));
    return runs.filter((run) => !containsRun(text, run)).map((run) => ({ page, run }));
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? join(here, "../dist"));
  const { relics, rules, firstRelicId, frontierPreset, llmTxtFile, ledger, chests } = await loadBalanceSources();
  const llm = readFileSync(llmTxtFile, "utf8");
  const phrases = expectedPhrases(
    configOf("blitz"),
    configOf("eternum"),
    configOf("frontier"),
    frontierPreset,
    ledger,
    chests,
  );
  const missing = [
    ...missingRuns(dist, [
      ...expectedRuns(configOf("blitz"), configOf("eternum")),
      ...relicRuns(relics, rules, firstRelicId),
    ]),
    ...missingPhrases(dist, phrases),
    ...exportProblems(llm, phrases),
    ...forbiddenValues(dist, llm),
    ...tableSizeOverrides(dist),
  ];
  for (const { page, run } of missing) console.error(`${page}: expected "${run.join(" | ")}"`);
  if (missing.length) process.exit(1);
  console.log("Rendered balance and the text export match each mode's config, with no NaN or u64 maximum shown.");
}
