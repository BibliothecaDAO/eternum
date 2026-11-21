#!/usr/bin/env node
/**
 * Checks the built docs show each mode's own balance: on a page, a label must be followed by the value its mode's
 * generated config holds, and the relic page each relic's cost as the Blitz preset's relic rules set it. Blitz and
 * Frontier differ on these values, so a Blitz component that reads another mode's config (or a hard-coded number that
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
import { LAYER_NAMES, beastOf, resourceName, BuildingType } from "@bibliothecadao/types";
import { playableDepths } from "../docs/utils/playable-depths.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));

/** Thousands with commas, as the pages write them. */
const n = (value) => value.toLocaleString("en-US");
const pct = (bps) => `${n(bps / 100)}%`;
const TIERS = ["common", "uncommon", "rare", "epic", "legendary"];

/** A building's price as the realm page states it: every resource it takes, by the catalog's name. */
const buildingPrice = (config, id) =>
  config.buildings.simpleBuildingCost[id]
    .map(({ resource, amount }) => `${n(amount)} ${resourceName(resource)}`)
    .join(" + ");

/**
 * Frontier's numbers, from its generated config (stamina, tick, start, castle) and its native preset (days' depths,
 * guards, chests), as its four rules pages state them.
 */

export const frontierGuardPhrases = (preset, riftGuardBound) => {
  const range = (lower, upper) => `${n(lower)}–${n(upper)}`;
  return [
    "Ground Camps Rifts Weaker beasts Stronger beasts Ruins",
    ...playableDepths(preset).map((depth, index) =>
      [
        LAYER_NAMES[index],
        beastOf("camp", index).name,
        range(depth.siteGuardLower, depth.siteGuardUpper),
        beastOf("rift", index).name,
        range(
          riftGuardBound(depth.siteGuardLower, depth.guardStep),
          riftGuardBound(depth.siteGuardUpper, depth.guardStep),
        ),
        beastOf("herd", index).name,
        range(depth.beastWeakLower, depth.beastWeakUpper),
        beastOf("band", index).name,
        range(depth.beastStrongLower, depth.beastStrongUpper),
        beastOf("ruin", index).name,
      ].join(" "),
    ),
  ];
};

export const frontierPhrases = (config, preset, riftGuardBound, nativeRules) => {
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
  return [
    {
      page: "frontier/armies",
      phrases: [
        `An army holds ${n(stamina.staminaKnightMax)} stamina and recovers ${stamina.staminaGainPerTick} every ${tick / 60} minutes, so an empty bar fills in ${((stamina.staminaKnightMax / stamina.staminaGainPerTick) * tick) / 3600} hours.`,
        `Revealing a tile costs ${stamina.staminaExploreStaminaCost} for Knights and ${nativeRules.SCOUT_EXPLORE_STAMINA} for Scouts, a step over known ground ${stamina.staminaTravelStaminaCost}, and an attack needs ${stamina.staminaAttackReq}.`,
      ],
    },
    {
      page: "frontier/expedition",
      phrases: [
        ...frontierGuardPhrases(preset, riftGuardBound),
        ...playableDepths(preset).map((depth, index) => `${LAYER_NAMES[index]} ${depth.revealPercent}%`),
      ],
    },
    {
      page: "frontier/realm",
      phrases: [
        `A new realm starts with ${start(26)} troops, ${start(35)} wheat and ${start(23)} labor.`,
        `receive ${n(preset.dailyQuest.labor)} Labor and ${n(preset.dailyQuest.essence)} Essence.`,
        ...armies.map((count, index) => `${index + 1} ${n(count)} ${n(caps[index])}`),
        // An ordinary building and a training building: each price whole, by resource (a training building takes two).
        `Farm Wheat ${buildingPrice(config, BuildingType.ResourceWheat)}`,
        `Scouts' lodge Scouts ${buildingPrice(config, BuildingType.ScoutsLodge)}`,
        `Supply yard Logistics training ${buildingPrice(config, BuildingType.SupplyYard)}`,
      ],
    },
  ];
};

/** The retired chest page remains tied to its historical paying preset. */
const historicalChestPhrases = (preset) => [
  {
    page: "frontier/chests",
    phrases: [
      ...preset.depths.map(
        (depth, index) => `${LAYER_NAMES[index]} ${TIERS.map((tier) => pct(depth.chest[tier])).join(" ")}`,
      ),
      `Shares ${TIERS.map((tier) => n(preset.chests.shares[tier])).join(" ")}`,
      `never exceeds ${n(preset.chests.priceCeiling)} LORDS`,
    ],
  },
];

/** The Payout wallet page's statement of the co-signer's hold on a replaced wallet. */
export const payoutWalletPhrases = (changeHoldSeconds) => [
  {
    page: "account/payout-wallet",
    phrases: [`the first Frontier payout to the new wallet waits ${changeHoldSeconds / 3600} hours`],
  },
];

/** The phrases every rules page that states a stamina, guard, chest or points number must show. */
export const expectedPhrases = (frontier, frontierPreset, riftGuardBound, nativeRules) => [
  ...frontierPhrases(frontier, frontierPreset, riftGuardBound, nativeRules),
];

/**
 * The relic table, the Blitz preset's relic rules, Frontier's native preset, the text export's path, Blitz's ledger and
 * chest presets, and the co-signer's payout-wallet hold, read from their TypeScript sources through Vite.
 */
export const loadBalanceSources = async () => {
  const { createServer } = await import("vite");
  const server = await createServer({ configFile: false, logLevel: "silent", appType: "custom" });
  try {
    const { nativePresetForId, nativePresetIdFor } = await server.ssrLoadModule(
      join(here, "../../../config/source/native.ts"),
    );
    const frontierPreset = nativePresetForId(nativePresetIdFor("frontier"));
    const { frontierPreset: historicalFrontierPreset } = await server.ssrLoadModule(
      join(here, "../../../config/source/frontier/native.ts"),
    );
    const { loadNativePresetConfiguration } = await server.ssrLoadModule(
      join(here, "../../../config/deployer/clean/registrar/native-preset.ts"),
    );
    const frontierConfig = loadNativePresetConfiguration("madara.frontier", frontierPreset.id);
    const { nativeRuleConstants: nativeRules } = await server.ssrLoadModule(
      join(here, "../../../contracts/l3/world-native/schema/balance.gen.ts"),
    );
    const { previewRiftGuardBound } = await server.ssrLoadModule(
      join(here, "../../../contracts/l3/world-native/schema/site-previews.gen.ts"),
    );
    const { PAYOUT_WALLET_CHANGE_SECONDS } = await server.ssrLoadModule(
      join(here, "../../../packages/value-ledger/src/payout-wallet.ts"),
    );
    return {
      frontierPreset,
      frontierConfig,
      historicalFrontierPreset,
      previewRiftGuardBound,
      nativeRules,
      payoutWalletChangeSeconds: PAYOUT_WALLET_CHANGE_SECONDS,
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? join(here, "../dist"));
  const {
    frontierPreset,
    frontierConfig,
    historicalFrontierPreset,
    previewRiftGuardBound,
    nativeRules,
    payoutWalletChangeSeconds,
  } = await loadBalanceSources();
  const llm = readFileSync(join(dist, "llm.txt"), "utf8");
  const phrases = [
    ...expectedPhrases(frontierConfig, frontierPreset, previewRiftGuardBound, nativeRules),
    ...historicalChestPhrases(historicalFrontierPreset),
    ...payoutWalletPhrases(payoutWalletChangeSeconds),
  ];
  const missing = [
    ...missingPhrases(dist, phrases),
    ...exportProblems(llm, phrases),
    ...forbiddenValues(dist, llm),
    ...tableSizeOverrides(dist),
  ];
  for (const { page, run } of missing) console.error(`${page}: expected "${run.join(" | ")}"`);
  if (missing.length) process.exit(1);
  console.log("Rendered balance and the text export match each mode's config, with no NaN or u64 maximum shown.");
}
