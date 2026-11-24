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
import {
  ASPECT_REWARD,
  FRAGMENT_CENTS,
  FRAGMENTS_A_DAY,
  FRIEND_FRAGMENTS,
  FRIEND_GLORY,
  FRIENDS_BONUS_FRAGMENTS,
  FRIENDS_LIMIT,
  FRONTIER_BUILDING_TYPES,
  LAYER_NAMES,
  MIN_FRAGMENTS,
  TIER_WORDS,
  aspects,
  baneQuests,
  beastOf,
  buildingName,
  dailyQuests,
  deepSites,
  getProducedResource,
  orders,
  rankName,
  resourceName,
  worldBanes,
  BuildingType,
} from "@bibliothecadao/types";

const here = fileURLToPath(new URL(".", import.meta.url));

/** Thousands with commas, as the pages write them. */
const n = (value) => value.toLocaleString("en-US");

/** A building's price as the realm page states it: every resource it takes, by the catalog's name. */
const buildingPrice = (config, id) =>
  config.buildings.simpleBuildingCost[id]
    .map(({ resource, amount }) => `${n(amount)} ${resourceName(resource)}`)
    .join(" + ");

/**
 * Frontier's numbers, from its generated config (stamina, tick, start, castle) and its native preset (days' depths,
 * guards, chests), as its four rules pages state them.
 */

export const frontierGuardPhrases = (preset) => {
  const range = (lower, upper) => `${n(lower)}–${n(upper)}`;
  return [
    "Ground Camps Rifts Weaker beasts Stronger beasts Ruins",
    ...preset.depths.map((depth, index) =>
      [
        LAYER_NAMES[index],
        beastOf("camp", index).name,
        range(depth.siteGuardLower, depth.siteGuardUpper),
        beastOf("rift", index).name,
        range(depth.riftGuardLower, depth.riftGuardUpper),
        beastOf("herd", index).name,
        range(depth.beastWeakLower, depth.beastWeakUpper),
        beastOf("band", index).name,
        range(depth.beastStrongLower, depth.beastStrongUpper),
        beastOf("ruin", index).name,
      ].join(" "),
    ),
  ];
};

export const frontierPhrases = (
  config,
  preset,
  nativeRules,
  nativeFragments,
  nativeOaths,
  nativeRace,
  { aspectWords, relicWords, relicKinds, commandBits, calendar, nativeResearch, contract },
) => {
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
  const finishHeight = nativeRace.STAGE_COUNT * preset.race.stageHeight;
  const aspectOrders = orders.filter((order) => order.aspect !== null);
  const aspectOrderCount = aspectOrders.length;
  const rateOf = (buildingId) =>
    n(Math.round(config.resources.productionByComplexRecipeOutputs[getProducedResource(buildingId)] * 3600));
  const castleLaborRate = (level) =>
    n(Math.round(config.resources.productionByComplexRecipeOutputs[23] * contract.castleLaborStep ** level * 3600));
  const questLevelScale = Array.from(
    { length: config.realmMaxLevel },
    (_, level) => `${n(contract.questLevelStep ** level)}x at ${rankName(level)}`,
  ).join(", ");
  const commandOn = (name) => (preset.commandMask & BigInt(commandBits[name])) !== 0n;
  const sealEnabled = commandOn("BuySeal");
  const staminaEnabled = commandOn("BuyStamina");
  const rerollEnabled = commandOn("RerollOath");
  const anySpendEnabled = sealEnabled || staminaEnabled || rerollEnabled;
  const staminaRule = staminaEnabled
    ? `Works on the Surface, Veil, and Hollow`
    : `Turned off while Fragment spending is disabled. When enabled (above the Deep), refills ${n(nativeFragments.STAMINA_PER_FRAGMENT)} stamina per Fragment`;
  const oathSlotPrices = preset.research
    .filter((step) => step.row === nativeResearch.ROW_KNIGHT_OATHS)
    .sort((a, b) => a.tier - b.tier)
    .map(
      (step, index) =>
        `Slot ${n(nativeResearch.OATH_SLOTS_BASE + index + 1)}: ${n(step.essenceCost)} Essence, ${n(step.laborCost)} labor`,
    )
    .join("; ");
  const rerollRule = rerollEnabled
    ? `Spend ${n(nativeFragments.OATH_REROLL_FRAGMENTS)} Fragments to replace one of the 3 drawn cards once per draw`
    : `Turned off while Fragment spending is disabled. When enabled (above the Deep), spending ${n(nativeFragments.OATH_REROLL_FRAGMENTS)} Fragments replaces one of the 3 drawn cards once per draw.`;
  return [
    {
      page: "frontier",
      phrases: [
        calendar.testnetDates,
        `Opens ${calendar.seasonStart}`,
        `one of the ${aspects.length} Aspects.`,
        `the ${aspects.length} Aspects, ${aspectOrderCount} Orders`,
        `all ${FRONTIER_BUILDING_TYPES.length} buildings`,
        `${deepSites.length} site kinds`,
        `all ${aspectOrderCount} Oaths from shrines and all ${relicKinds.length} relic kinds from ruins.`,
      ],
    },
    {
      page: "frontier/armies",
      phrases: [
        `An army holds ${n(stamina.staminaKnightMax)} stamina and recovers ${stamina.staminaGainPerTick} every ${tick / 60} minutes, so an empty bar fills in ${((stamina.staminaKnightMax / stamina.staminaGainPerTick) * tick) / 3600} hours.`,
        `Revealing a tile costs ${stamina.staminaExploreStaminaCost} for Knights and ${nativeRules.SCOUT_EXPLORE_STAMINA} for Scouts, a step over known ground ${stamina.staminaTravelStaminaCost}, and an attack needs ${stamina.staminaAttackReq}.`,
        staminaRule,
      ],
    },
    {
      page: "frontier/expedition",
      phrases: [
        ...frontierGuardPhrases(preset),
        ...preset.depths.map((depth, index) => `${LAYER_NAMES[index]} ${depth.revealPercent}%`),
        `${nativeFragments.SURFACE_CACHE_PERCENT}% chance`,
      ],
    },
    {
      page: "frontier/realm",
      phrases: [
        `A new realm starts with ${start(26)} troops, ${start(35)} wheat and ${start(23)} labor.`,
        `Your castle makes ${castleLaborRate(0)} labor per hour at Settlement, multiplying by ${n(contract.castleLaborStep)} at each castle level up to ${castleLaborRate(3)}/h at Empire.`,
        `receive ${n(preset.dailyQuest.labor)} Labor and ${n(preset.dailyQuest.essence)} Essence`,
        ...FRONTIER_BUILDING_TYPES.map((id) => buildingName(id, true)),
        ...armies.map(
          (count, index) =>
            `${index + 1} ${n(count)} ${n(caps[index])} ${castleLaborRate(index)} ${n(preset.board.resourceStoreCaps[index])} ${n(preset.board.laborStoreCaps[index])}`,
        ),
        `Farm Wheat (${rateOf(BuildingType.ResourceWheat)}/h) Settlement ${buildingPrice(config, BuildingType.ResourceWheat)}`,
        `Barracks Knights (${rateOf(BuildingType.ResourceKnightT1)}/h) Settlement ${buildingPrice(config, BuildingType.ResourceKnightT1)}`,
        `Range Crossbowmen (${rateOf(BuildingType.ResourceCrossbowmanT1)}/h) City ${buildingPrice(config, BuildingType.ResourceCrossbowmanT1)}`,
        `Scouts' lodge Scouts (${rateOf(BuildingType.ScoutsLodge)}/h) City ${buildingPrice(config, BuildingType.ScoutsLodge)}`,
        `Supply yard Logistics training Kingdom ${buildingPrice(config, BuildingType.SupplyYard)}`,
        `Price per troop kind: ${oathSlotPrices}.`,
      ],
    },
    {
      page: "frontier/aspects",
      phrases: [
        `The ${aspects.length} Aspects and their ${aspectOrderCount} Orders`,
        ...aspects.map((aspect) => aspect.name),
        ...aspectOrders.map((order) => order.orderName),
        `${n(finishHeight)} height wins the season.`,
        `${n(ASPECT_REWARD.lordsPerHeight)} LORDS per height point reached.`,
        `+${n(ASPECT_REWARD.finishBonus)} LORDS`,
        `at least ${n(ASPECT_REWARD.gloryToShare)} Glory`,
        `${aspectWords.triumph[nativeRace.CLEAR_MIST_STAGE]} Sites are found at ${n(preset.race.clearMistPercent)}%`,
        `${aspectWords.triumph[nativeRace.SECOND_WIND_STAGE]} Stamina recovers at ${n(preset.race.secondWindPercent)}%`,
        `${aspectWords.triumph[nativeRace.PALE_MOON_STAGE]} Guarded sites have ${n(preset.race.paleMoonPercent)}%`,
        `${aspectWords.triumph[nativeRace.SPOILS_STAGE]} Site rewards pay ${n(preset.race.spoilsPercent)}%`,
      ],
    },
    {
      page: "frontier/deep",
      phrases: [
        `The Deep has ${preset.deep.rings.length} concentric rings`,
        ...preset.deep.rings.map((ring, index) => `Ring ${index + 1} ${n(ring.radius)} tiles ${n(ring.realms)}`),
        `The ${deepSites.length} site kinds`,
        ...deepSites.map((site) => site.name),
        `Up to ${n(nativeRules.DEEP_GUARD_SLOTS)} armies from the same Aspect can guard one site together.`,
        `every army in the Deep loses ${n(preset.deep.lossPerTick)} troops`,
        `Sends ${n(preset.deep.corePerTick)} Essence per tick`,
        `Sends ${n(preset.deep.minePerTick)} labor per tick`,
        `reaches ${n(preset.deep.altarThreshold)}`,
        `${n(preset.deep.beasts.foundation.count)} troops`,
      ],
    },
    {
      page: "frontier/oaths-and-relics",
      phrases: [
        `All ${aspectOrderCount} Oaths`,
        ...aspectOrders.map((order) => order.orderName),
        `gives that army +${n(nativeOaths.PASS_STAMINA)} stamina`,
        rerollRule,
        `Deals +${n(nativeOaths.POWER_DAMAGE_PERCENT)}% damage.`,
        `Takes ${n(nativeOaths.GIANTS_REDUCTION_PERCENT)}% less damage.`,
        `Relics come in ${TIER_WORDS.length} tiers`,
        `All ${relicKinds.length} relic kinds`,
        ...relicKinds.map((kind) => relicWords.kinds[kind]),
        `+${n(nativeRules.RELIC_BLADE_BPS / 100)}% damage dealt`,
        ...preset.depths.map((depth, index) => {
          const tiers = ["common", "uncommon", "rare", "epic", "legendary"];
          const odds = tiers
            .map((tier, tierIndex) => ({ name: TIER_WORDS[tierIndex], bps: depth.chest[tier] }))
            .filter(({ bps }) => bps > 0)
            .map(({ name, bps }) => `${name} (${n(bps / 100)}%)`)
            .join(", ");
          return `${LAYER_NAMES[index]}: ${odds}`;
        }),
      ],
    },
    {
      page: "frontier/quests-and-banes",
      phrases: [
        `The ${dailyQuests.length} daily quests are dealt in shuffled ${dailyQuests.length}-day bags`,
        ...dailyQuests.map((quest) => `${quest.name} ${quest.objective}`),
        `Rewards multiply by ${n(contract.questLevelStep)} at each castle level (${questLevelScale}).`,
        `${n(preset.dailyQuest.labor)} Labor and ${n(preset.dailyQuest.essence)} Essence.`,
        `to ${n(preset.dailyQuest.bonusPercent)}%.`,
        `+${n(nativeFragments.WONDER_QUEST_FRAGMENTS)} Fragments`,
        `Guarded sites have ${n(preset.banes.beastPercent)}% strength.`,
        `Once ${n(preset.banes.quorumPercent)}% of your Aspect's active members`,
        ...worldBanes.map((entry) => entry.name),
        ...worldBanes.map((entry) => {
          const q = baneQuests.find((item) => item.id === entry.quest);
          return `${q.name}: ${q.objective}`;
        }),
      ],
    },
    {
      page: "frontier/shop-and-referrals",
      phrases: [
        ...(anySpendEnabled ? [] : [calendar.testnetDates]),
        `${n(FRAGMENT_CENTS)} cent per Fragment.`,
        `from ${n(MIN_FRAGMENTS)} up to ${n(FRAGMENTS_A_DAY)} Fragments per day.`,
        `${n(nativeFragments.SEAL_FRAGMENTS)} Fragments`,
        sealEnabled ? `Lasts the whole season.` : `Turned off while Fragment spending is disabled.`,
        staminaRule,
        rerollRule,
        `reaches ${n(FRIEND_GLORY)} Glory in the Deep pays you ${n(FRIEND_FRAGMENTS)} Fragments.`,
        `Up to ${n(FRIENDS_LIMIT)} friends count per season.`,
        `+${n(FRIENDS_BONUS_FRAGMENTS)} Fragment bonus.`,
      ],
    },
  ];
};

export const payoutWalletPhrases = (changeHoldSeconds, claimWindowSeconds) => [
  {
    page: "account/payout-wallet",
    phrases: [`the first Frontier payout to the new wallet waits ${changeHoldSeconds / 3600} hours`],
  },
  {
    page: "account/lords",
    phrases: [`link one within ${claimWindowSeconds / 86400} days of posting`],
  },
];

/** The phrases every rules page that states a stamina, guard, chest or points number must show. */
export const expectedPhrases = (
  frontier,
  frontierPreset,
  nativeRules,
  nativeFragments,
  nativeOaths,
  nativeRace,
  extra,
) => [...frontierPhrases(frontier, frontierPreset, nativeRules, nativeFragments, nativeOaths, nativeRace, extra)];

export const expectedPageIcons = ({ buildingMeaning, iconUrl, relicKinds, relicMeaning }) => [
  {
    page: "frontier/realm",
    icons: FRONTIER_BUILDING_TYPES.map((id) => iconUrl(buildingMeaning(id, true), 128)),
  },
  {
    page: "frontier/oaths-and-relics",
    icons: relicKinds.map((kind) => iconUrl(relicMeaning(kind), 128)),
  },
];

export const missingIcons = (dist, pages) =>
  pages.flatMap(({ page, icons }) => {
    const html = readFileSync(join(dist, page, "index.html"), "utf8");
    return icons.filter((src) => !html.includes(`src="${src}"`)).map((src) => ({ page, run: [`missing icon ${src}`] }));
  });

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
    const {
      nativeFragmentConstants: nativeFragments,
      nativeOathConstants: nativeOaths,
      nativeRaceConstants: nativeRace,
      nativeResearchConstants: nativeResearch,
      nativeRuleConstants: nativeRules,
    } = await server.ssrLoadModule(join(here, "../../../contracts/l3/world-native/schema/balance.gen.ts"));
    const { PAYOUT_WALLET_CHANGE_SECONDS } = await server.ssrLoadModule(
      join(here, "../../../packages/value-ledger/src/payout-wallet.ts"),
    );
    const { RACE_CLAIM_WINDOW_SECONDS } = await server.ssrLoadModule(
      join(here, "../../../packages/value-ledger/src/codecs.ts"),
    );
    const { nativeCommandBits: commandBits } = await server.ssrLoadModule(
      join(here, "../../../contracts/l3/world-native/schema/commands.gen.ts"),
    );
    const { ASPECT_PAGE_WORDS: aspectWords, RELIC_WORDS: relicWords } = await server.ssrLoadModule(
      join(here, "../../game/src/ui/design-system/kit/words.ts"),
    );
    const { iconUrl } = await server.ssrLoadModule(join(here, "../../game/src/ui/design-system/icon-meaning.ts"));
    const {
      buildingMeaning,
      RELIC_KINDS: relicKinds,
      relicMeaning,
    } = await server.ssrLoadModule(join(here, "../../game/src/ui/design-system/domain-icon-meaning.ts"));
    const { SEASON_ONE_CALENDAR: calendar } = await server.ssrLoadModule(
      join(here, "../docs/utils/season-calendar.ts"),
    );
    const { CONTRACT: contract } = await server.ssrLoadModule(join(here, "../docs/utils/contract-constants.ts"));
    return {
      frontierPreset,
      frontierConfig,
      historicalFrontierPreset,
      nativeFragments,
      nativeOaths,
      nativeRace,
      nativeResearch,
      nativeRules,
      aspectWords,
      relicWords,
      relicKinds,
      commandBits,
      buildingMeaning,
      iconUrl,
      relicMeaning,
      calendar,
      contract,
      payoutWalletChangeSeconds: PAYOUT_WALLET_CHANGE_SECONDS,
      raceClaimWindowSeconds: RACE_CLAIM_WINDOW_SECONDS,
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
      section.match(/^file: docs\/pages\/(\S+)\.mdx/)?.[1]?.replace(/\/index$/, ""),
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

export const FORBIDDEN_MODE_TERMS = [/\bblitz\b/i, /\bdevcon\b/i, /\bseason\s*0\b/i];

const FORBIDDEN_PLAYER_MODE_TERMS = [...FORBIDDEN_MODE_TERMS, /\beternum\b/i];

const isDeveloperPath = (file) => file.startsWith("development/") || file.startsWith("docs/pages/development/");

export const forbiddenModeMatches = (text, allowEternumName = false) =>
  (allowEternumName ? FORBIDDEN_MODE_TERMS : FORBIDDEN_PLAYER_MODE_TERMS).flatMap((pattern) => {
    const match = text.match(pattern);
    return match ? [`forbidden mode name: …${text.slice(Math.max(0, match.index - 40), match.index + 30)}…`] : [];
  });

export const forbiddenModePages = (dist, llm) => [
  ...fg.sync("**/index.html", { cwd: dist }).flatMap((file) =>
    forbiddenModeMatches(pageLine(readFileSync(join(dist, file), "utf8")), isDeveloperPath(file)).map((found) => ({
      page: file,
      run: [found],
    })),
  ),
  ...llm.split("\n\n---\n\n").flatMap((section) => {
    const file = section.match(/^file: (\S+)/)?.[1] ?? "llm.txt";
    return forbiddenModeMatches(section, isDeveloperPath(file)).map((found) => ({
      page: `llm.txt ${file}`,
      run: [found],
    }));
  }),
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? join(here, "../dist"));
  const sources = await loadBalanceSources();
  const {
    frontierPreset,
    frontierConfig,
    nativeFragments,
    nativeOaths,
    nativeRace,
    nativeRules,
    payoutWalletChangeSeconds,
    raceClaimWindowSeconds,
  } = sources;
  const llm = readFileSync(join(dist, "llm.txt"), "utf8");
  const phrases = [
    ...expectedPhrases(frontierConfig, frontierPreset, nativeRules, nativeFragments, nativeOaths, nativeRace, sources),
    ...payoutWalletPhrases(payoutWalletChangeSeconds, raceClaimWindowSeconds),
  ];
  const missing = [
    ...missingPhrases(dist, phrases),
    ...missingIcons(dist, expectedPageIcons(sources)),
    ...exportProblems(llm, phrases),
    ...forbiddenValues(dist, llm),
    ...forbiddenModePages(dist, llm),
    ...tableSizeOverrides(dist),
  ];
  for (const { page, run } of missing) console.error(`${page}: expected "${run.join(" | ")}"`);
  if (missing.length) process.exit(1);
  console.log("Rendered balance and the text export match each mode's config, with no NaN or u64 maximum shown.");
}
