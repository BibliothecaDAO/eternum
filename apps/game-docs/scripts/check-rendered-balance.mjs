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
  DEEP_BEASTS,
  FRAGMENT_CENTS,
  FRAGMENT_SPEND_COMMANDS,
  FRAGMENTS_A_DAY,
  FRIEND_FRAGMENTS,
  FRIEND_GLORY,
  FRONTIER_BUILDING_TYPES,
  FRONTIER_TROOP_NAMES,
  LAYER_NAMES,
  MIN_FRAGMENTS,
  TIER_WORDS,
  TroopType,
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
    "Layer Camps Rifts Herds Bands Ruins",
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
  {
    aspectWords,
    relicWords,
    relicKinds,
    commandBits,
    calendar,
    seasonDayUnitSeconds,
    nativeBane,
    nativeQuest,
    nativeResearch,
    contract,
    buildablePlotCount,
    buildingCopyCost,
    buildingCopyMultiplier,
    isOnePerRealm,
    oathAttackStamina,
    oathFuryRefund,
    oathSitePay,
    relicsPerLayer,
    previewRuinGuardBounds,
    depthRewardPercent,
    logisticsStamina,
    mainnetTokens,
    oathEffectDescription,
    relicEffect,
    triumphHead,
    worldBaneHead,
  },
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
    (_, level) => `${n(contract.questLevelStep ** level)}x at castle level ${level + 1} (${rankName(level)})`,
  ).join(", ");
  const commandOn = (name) => (preset.commandMask & BigInt(commandBits[name])) !== 0n;
  const anySpendEnabled = FRAGMENT_SPEND_COMMANDS.some((name) => commandOn(name));
  const logisticsBonus = logisticsStamina(stamina.staminaKnightMax, nativeRules.ATTRIBUTE_CAP);
  const listAnd = (items) =>
    items.length > 1 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : (items[0] ?? "");
  const listOr = (items) =>
    items.length > 1 ? `${items.slice(0, -1).join(", ")}, or ${items.at(-1)}` : (items[0] ?? "");
  const personalLayers = LAYER_NAMES.slice(0, 3);
  const personalLayersAnd = listAnd(personalLayers);
  const personalLayersOr = listOr(personalLayers);
  const staminaRule = `Refills ${n(nativeFragments.STAMINA_PER_FRAGMENT)} stamina per Fragment on the ${personalLayersAnd}`;
  const oathSlotPrices = preset.research
    .filter((step) => step.row === nativeResearch.ROW_KNIGHT_OATHS)
    .sort((a, b) => a.tier - b.tier)
    .map(
      (step, index) =>
        `Slot ${n(nativeResearch.OATH_SLOTS_BASE + index + 1)}: ${n(step.essenceCost)} Essence, ${n(step.laborCost)} labor`,
    )
    .join("; ");
  const allPayTokens = listOr(Object.values(mainnetTokens).map((token) => token.symbol));
  const swapPayTokens = listOr(
    Object.entries(mainnetTokens)
      .filter(([key]) => key !== "lords")
      .map(([, token]) => token.symbol),
  );
  const rerollRule = `Spend ${n(nativeFragments.OATH_REROLL_FRAGMENTS)} Fragments to reroll one offered Oath once per pick on the ${personalLayersAnd}.`;
  const staminaPerMinute = `+${Number(((stamina.staminaGainPerTick * 60) / tick).toFixed(2))}/min`;
  const bit = (id) => 1 << (id - 1);
  const angerAttack = oathAttackStamina(bit(nativeOaths.ANGER), stamina.staminaAttackReq);
  const furyBase = oathFuryRefund(bit(nativeOaths.FURY), stamina.staminaAttackReq);
  const furyAnger = oathFuryRefund(bit(nativeOaths.FURY) | bit(nativeOaths.ANGER), angerAttack);
  const skillAfter = Math.floor(nativeOaths.SKILL_BELOW_STAMINA / 2);
  const pickBase = {
    attackStamina: stamina.staminaAttackReq,
    revealStamina: stamina.staminaExploreStaminaCost,
    maxStamina: stamina.staminaKnightMax,
    staminaPerSecond: stamina.staminaGainPerTick / tick,
    deepLossPerTick: preset.deep.lossPerTick,
  };
  const baneRules = {
    beast_percent: preset.banes.beastPercent,
    stamina_percent: preset.banes.staminaPercent,
    production_percent: preset.banes.productionPercent,
  };
  return [
    {
      page: "frontier",
      phrases: [
        calendar.testnetDates,
        `Opens ${calendar.seasonStart}`,
        (() => {
          const perHour = Math.round((stamina.staminaGainPerTick * 3600) / tick);
          const shortHours = Math.round((2 * seasonDayUnitSeconds(preset)) / 3600);
          const longHours = Math.round((6 * seasonDayUnitSeconds(preset)) / 3600);
          return `An ${n(shortHours)}-hour day gives an army ${n(stamina.staminaKnightMax + shortHours * perHour)} total stamina; a ${n(longHours)}-hour day gives ${n(stamina.staminaKnightMax + longHours * perHour)}.`;
        })(),
        `all ${FRONTIER_BUILDING_TYPES.length} buildings`,
        `the ${aspects.length} Aspects`,
        `${deepSites.length} site kinds`,
        `all ${aspectOrderCount} Oaths`,
        `all ${relicKinds.length} relic kinds`,
      ],
    },
    {
      page: "frontier/armies",
      phrases: [
        `${FRONTIER_TROOP_NAMES[TroopType.Knight].many} ${buildingName(nativeResearch.BARRACKS, true)} Blade`,
        `${FRONTIER_TROOP_NAMES[TroopType.Crossbowman].many} ${buildingName(nativeResearch.RANGE, true)} (castle level ${nativeResearch.RANGE_LEVEL + 1} (${rankName(nativeResearch.RANGE_LEVEL)})) Bow`,
        `${FRONTIER_TROOP_NAMES[TroopType.Paladin].many} ${buildingName(nativeResearch.SCOUTS_LODGE, true)} (castle level ${nativeResearch.SCOUTS_LODGE_LEVEL + 1} (${rankName(nativeResearch.SCOUTS_LODGE_LEVEL)})) Blade`,
        `An army holds ${n(stamina.staminaKnightMax)} stamina and recovers ${stamina.staminaGainPerTick} every ${tick / 60} minutes (${staminaPerMinute}), so an empty bar fills in ${((stamina.staminaKnightMax / stamina.staminaGainPerTick) * tick) / 3600} hours.`,
        `Revealing a tile costs ${stamina.staminaExploreStaminaCost} for ${FRONTIER_TROOP_NAMES[TroopType.Knight].many} and ${FRONTIER_TROOP_NAMES[TroopType.Crossbowman].many}, and ${nativeRules.SCOUT_EXPLORE_STAMINA} for ${FRONTIER_TROOP_NAMES[TroopType.Paladin].many}. A step on an explored tile costs ${stamina.staminaTravelStaminaCost}, and an attack needs ${stamina.staminaAttackReq}.`,
        `adding +${n(logisticsBonus)} bonus stamina at rank V for ${n(stamina.staminaKnightMax + logisticsBonus)} max stamina total.`,
        `The Titans Oath adds a flat +${n(nativeOaths.TITANS_STAMINA)} on top of Logistics (${n(stamina.staminaKnightMax + nativeOaths.TITANS_STAMINA)} max stamina at Logistics 0 up to ${n(stamina.staminaKnightMax + logisticsBonus + nativeOaths.TITANS_STAMINA)} at Logistics V`,
        `A slot's first army of the day starts with a full bar (${n(stamina.staminaKnightMax)} stamina, plus your Logistics bonus).`,
        `Two adjacent armies of the same troop kind can merge, moving troops only.`,
        `beside any camp your realm cleared today (supply post) on the ${personalLayersOr}`,
        staminaRule,
      ],
    },
    {
      page: "frontier/combat",
      phrases: [
        `Each attack costs ${stamina.staminaAttackReq} stamina (${angerAttack} with the Anger Oath). Extra stamina above ${stamina.staminaAttackReq} adds no damage; defenders need ${stamina.staminaDefenseReq} stamina and take no low-stamina penalty.`,
        `round(${n(Number(BigInt(config.troop.damage.damageScalingFactor) / 2n ** 64n))} × troops ÷ (both sides' troops)^${(contract.combatBetaTenths / 10).toFixed(1)})`,
        deepSites
          .filter((site) => !preset.deep.beasts[site.key].bow)
          .map((site) => DEEP_BEASTS[site.key].name)
          .join(", "),
        deepSites
          .filter((site) => preset.deep.beasts[site.key].bow)
          .map((site) => DEEP_BEASTS[site.key].name)
          .join(", "),
      ],
    },
    {
      page: "frontier/expedition",
      phrases: [
        ...preset.depths.map((depth, index) => `${LAYER_NAMES[index]} ${depth.revealPercent}%`),
        `${n(contract.herdGuardMultiplier)}x its starting guard on the ${LAYER_NAMES[0]}`,
        `${n(100 / contract.campGuardDivisor)}% of its starting guard on the ${LAYER_NAMES[0]}, ${n(depthRewardPercent(1))}% of that in the ${LAYER_NAMES[1]}, ${n(depthRewardPercent(2))}% in the ${LAYER_NAMES[2]}`,
        `${n(100 * contract.riftGuardMultiplier)}% of its starting guard on the ${LAYER_NAMES[0]}`,
        `Immediately opens an Oath pick of ${n(contract.oathDrawCount)} Oaths for the revealing army, or lets you pass for +${n(nativeOaths.PASS_STAMINA)} stamina.`,
        `Each ruin holds either a relic or a Fragment cache, never both.`,
        `${nativeFragments.SURFACE_CACHE_PERCENT}% on the ${LAYER_NAMES[0]}`,
      ],
    },
    {
      page: "frontier/beasts",
      phrases: [
        ...frontierGuardPhrases(preset),
        ...[0, 1, 2].map((depth) => {
          const low = previewRuinGuardBounds(depth + 1, depth);
          const high = previewRuinGuardBounds(depth + relicsPerLayer, depth);
          return `${beastOf("ruin", depth).name} (${n(low[0])}–${n(low[1])} to ${n(high[0])}–${n(high[1])})`;
        }),
      ],
    },
    {
      page: "frontier/realm",
      phrases: [
        `A new realm starts with ${start(26)} ${FRONTIER_TROOP_NAMES[TroopType.Knight].many} waiting at home (no army is deployed yet), ${start(35)} wheat, and ${start(23)} labor.`,
        `receive ${n(preset.dailyQuest.labor)} labor and ${n(preset.dailyQuest.essence)} Essence at castle level 1 (${rankName(0)}), multiplying by ${n(contract.questLevelStep)} at each higher castle level.`,
        ...armies.map(
          (count, index) =>
            `Level ${index + 1} (${rankName(index)}) ${n(buildablePlotCount(index))} ${n(count)} ${n(caps[index])} ${castleLaborRate(index)} ${n(preset.board.resourceStoreCaps[index])} ${n(preset.board.laborStoreCaps[index])}`,
        ),
        `Price per troop kind: ${oathSlotPrices}.`,
      ],
    },
    {
      page: "frontier/buildings",
      phrases: [
        `Your castle makes ${castleLaborRate(0)} labor per hour at castle level 1 (${rankName(0)}), multiplying by ${n(contract.castleLaborStep)} at each castle level up to ${castleLaborRate(3)}/h at castle level 4 (${rankName(3)}).`,
        ...FRONTIER_BUILDING_TYPES.map((id) => buildingName(id, true)),
        [1, 2, 3, 4, 5, 6]
          .map(
            (copy) =>
              `${Number(buildingCopyMultiplier(copy - 1, config.buildings.buildingFixedCostScalePercent).toFixed(2))}x`,
          )
          .join(", "),
        ...[
          ...new Map(
            FRONTIER_BUILDING_TYPES.filter((id) => !isOnePerRealm(id)).reduce((groups, id) => {
              const base = config.buildings.simpleBuildingCost[id][0].amount;
              return groups.set(base, [...(groups.get(base) ?? []), buildingName(id, true)]);
            }, new Map()),
          ).entries(),
        ].map(
          ([base, names]) =>
            `${names.join(", ")} ${[1, 2, 3, 4, 5, 6]
              .map((copy) =>
                n(Math.floor(buildingCopyCost(base, copy - 1, config.buildings.buildingFixedCostScalePercent))),
              )
              .join(" ")}`,
        ),
        `Farm Wheat (${rateOf(BuildingType.ResourceWheat)}/h) Level 1 (${rankName(0)}) ${buildingPrice(config, BuildingType.ResourceWheat)}`,
        `${buildingName(BuildingType.ResourceKnightT1, true)} ${FRONTIER_TROOP_NAMES[TroopType.Knight].many} (${rateOf(BuildingType.ResourceKnightT1)}/h) Level 1 (${rankName(0)}) ${buildingPrice(config, BuildingType.ResourceKnightT1)}`,
        `${buildingName(BuildingType.ResourceCrossbowmanT1, true)} ${FRONTIER_TROOP_NAMES[TroopType.Crossbowman].many} (${rateOf(BuildingType.ResourceCrossbowmanT1)}/h) Level 2 (${rankName(1)}) ${buildingPrice(config, BuildingType.ResourceCrossbowmanT1)}`,
        `${buildingName(BuildingType.ScoutsLodge, true)} ${FRONTIER_TROOP_NAMES[TroopType.Paladin].many} (${rateOf(BuildingType.ScoutsLodge)}/h) Level 2 (${rankName(1)}) ${buildingPrice(config, BuildingType.ScoutsLodge)}`,
        `Supply yard Max stamina (Logistics) Level 3 (${rankName(2)}) ${buildingPrice(config, BuildingType.SupplyYard)}`,
      ],
    },
    {
      page: "frontier/aspects",
      phrases: [
        `The ${aspects.length} Aspects and their ${aspectOrderCount} Orders`,
        ...aspects.map((aspect) => aspect.name),
        ...aspectOrders.map((order) => order.orderName),
        `${n(finishHeight)} height wins the season immediately.`,
        `${n(ASPECT_REWARD.lordsPerHeight)} LORDS per height point reached`,
        `+${n(ASPECT_REWARD.finishBonus)} LORDS`,
        `at least ${n(ASPECT_REWARD.gloryToShare)} Glory`,
        `Essence cores, Ethereal mines, and beaten troops give no Glory.`,
      ],
    },
    {
      page: "frontier/deep",
      phrases: [
        `The Deep has ${preset.deep.rings.length} concentric rings`,
        `once enough realms have sent an army into the Deep that day:`,
        ...preset.deep.rings.map((ring, index) => `Ring ${index + 1} ${n(ring.radius)} tiles ${n(ring.realms)}`),
        `The ${deepSites.length} site kinds and their beasts`,
        `The army that clears a Deep site's beast or last rival guard moves onto the site and becomes its guard`,
        ...deepSites.map((site) => site.name),
        `has ${n(nativeRules.DEEP_GUARD_SLOTS)} guard slots for up to ${n(nativeRules.DEEP_GUARD_SLOTS)} different players of the same Aspect (1 army per player).`,
        `including an Essence core's ${n(preset.deep.corePerTick)} Essence and an Ethereal mine's ${n(preset.deep.minePerTick)} labor — is one pool for the whole site, split among its surviving guards by troop count.`,
        `counting open Archives across the Deep, not rings unlocked. That Glory goes only to the guards holding that Archive (split by troop count), while the whole Aspect gains the same amount of hyperstructure height.`,
        `loses ${n(preset.deep.lossPerTick)} troops`,
        `${n(preset.deep.corePerTick)} Essence per tick (no Glory)`,
        `${n(preset.deep.minePerTick)} labor per tick (no Glory)`,
        `reaches ${n(preset.deep.altarThreshold)}`,
        ...deepSites.map((site) => `${DEEP_BEASTS[site.key].name} (${n(preset.deep.beasts[site.key].count)})`),
      ],
    },
    {
      page: "frontier/oaths",
      phrases: [
        `Revealing a shrine opens a pick of ${n(contract.oathDrawCount)} Oaths immediately for that army.`,
        `award a pick of ${n(contract.oathDrawCount)} Oaths to the army that lands the last hit.`,
        `All ${aspectOrderCount} Oaths`,
        ...aspectOrders.map(
          (order) =>
            `${order.orderName} ${aspects.find((a) => a.id === order.aspect).name} ${oathEffectDescription(order.orderId, pickBase)}.`,
        ),
        `refunds ${n(nativeOaths.FURY_REFUND_PERCENT)}% of the winning attack's cost only — ${n(furyBase)} stamina on a normal attack, or ${n(furyAnger)} stamina with Anger.`,
        `An army attacking from ${n(stamina.staminaAttackReq + skillAfter)} stamina drops to ${n(skillAfter)} (below ${n(nativeOaths.SKILL_BELOW_STAMINA)}), gains Skill's +${n(nativeOaths.SKILL_DAMAGE_PERCENT)}% damage, and if that attack clears the target, Fury refunds ${n(furyBase)} stamina so the army ends on ${n(skillAfter + furyBase)}.`,
        `so an army with Titans holds ${n(stamina.staminaKnightMax + nativeOaths.TITANS_STAMINA)} max stamina at Logistics 0 up to ${n(stamina.staminaKnightMax + logisticsBonus + nativeOaths.TITANS_STAMINA)} at Logistics V`,
        `gives that army +${n(nativeOaths.PASS_STAMINA)} stamina`,
        rerollRule,
        `Strong Oath pairs`,
        (() => {
          const net = (mask) => {
            const cost = oathAttackStamina(mask, stamina.staminaAttackReq);
            return cost - oathFuryRefund(mask, cost);
          };
          const anger = orders.find((o) => o.orderId === nativeOaths.ANGER).orderName;
          const fury = orders.find((o) => o.orderId === nativeOaths.FURY).orderName;
          return `Stamina spent across 7 won attacks ${n(7 * net(0))} stamina ${anger}: ${n(7 * net(bit(nativeOaths.ANGER)))} stamina ${fury}: ${n(7 * net(bit(nativeOaths.FURY)))} stamina ${n(7 * net(bit(nativeOaths.ANGER) | bit(nativeOaths.FURY)))} stamina`;
        })(),
        (() => {
          const rage = orders.find((o) => o.orderId === nativeOaths.RAGE).orderName;
          const perfection = orders.find((o) => o.orderId === nativeOaths.PERFECTION).orderName;
          const both = (
            Number(oathSitePay(bit(nativeOaths.RAGE) | bit(nativeOaths.PERFECTION), 1000n, true)) / 10
          ).toFixed(1);
          return `${rage}: ${n(Number(oathSitePay(bit(nativeOaths.RAGE), 1000n, true)) / 10)}% ${perfection}: ${n(Number(oathSitePay(bit(nativeOaths.PERFECTION), 1000n, true)) / 10)}% ${both}%`;
        })(),
      ],
    },
    {
      page: "frontier/relics",
      phrases: [
        `Relics come in ${TIER_WORDS.length} tiers`,
        `All ${relicKinds.length} relic kinds`,
        `These are the only ${relicKinds.length} relic kinds in Season 1. No relic or Oath reveals more than 1 tile at a time.`,
        ...relicKinds.map(
          (kind) =>
            `${relicWords.kinds[kind]} ${relicEffect({ kind, rank: 1 }, pickBase)} ${relicEffect({ kind, rank: nativeRules.ATTRIBUTE_CAP }, pickBase)}`,
        ),
        ...preset.depths.map((depth, index) => {
          const odds = Object.entries(depth.chest)
            .filter(([, bps]) => bps > 0)
            .map(([key, bps]) => {
              const name = TIER_WORDS.find((word) => word.toLowerCase() === key);
              if (!name) throw new Error(`Missing TIER_WORDS entry for chest tier "${key}"`);
              return `${name} (${n(bps / 100)}%)`;
            })
            .join(", ");
          return `${LAYER_NAMES[index]}: ${odds}`;
        }),
      ],
    },
    {
      page: "frontier/quests",
      phrases: [
        `Each of the ${dailyQuests.length} daily quests comes once every ${dailyQuests.length} days`,
        ...dailyQuests.map((quest) => `${quest.name} ${quest.objective}`),
        `up to ${n(config.realmMaxLevel)}x at castle level ${n(config.realmMaxLevel)} (${rankName(config.realmMaxLevel - 1)})`,
        `multiply by ${n(contract.questLevelStep)} at each castle level (${questLevelScale}).`,
        `${n(preset.dailyQuest.labor)} labor and ${n(preset.dailyQuest.essence)} Essence`,
        `to ${n(preset.dailyQuest.bonusPercent)}%.`,
        `+${n(nativeFragments.WONDER_QUEST_FRAGMENTS)} Fragments`,
      ],
    },
    {
      page: "frontier/banes",
      phrases: [
        `The first ${n(preset.banes.quietDays)} game days never have a World Bane. From day ${n(preset.banes.quietDays + 1)} onward`,
        `adds +${n(preset.banes.chanceStep)}% to the chance of one on the next day.`,
        `${worldBaneHead(nativeBane.ASH_FALL, baneRules).name} applies to all realm building production (wheat, labor, and troop training).`,
        `Once ${n(preset.banes.quorumPercent)}% of your Aspect's members who deployed at least one army on the previous game day finish theirs, the World Bane ends for your Aspect`,
        `Archive guards still earn their full Glory (${n(preset.deep.buildingPay.alone)} / ${n(preset.deep.buildingPay.pair)} / ${n(preset.deep.buildingPay.crowd)} per tick, split by troop count) during a Team Bane.`,
        `World Banes stop for the rest of the season.`,
        ...worldBanes.map((entry) => {
          const head = worldBaneHead(entry.id, baneRules);
          const q = baneQuests.find((item) => item.id === entry.quest);
          const offset = (entry.quest - nativeQuest.STAND) * config.realmMaxLevel;
          const targets = preset.banes.questCounts
            .slice(offset, offset + config.realmMaxLevel)
            .map(n)
            .join(" / ");
          return `${head.name} ${head.rule}. ${q.name}: ${q.objective} ${targets}`;
        }),
        ...Object.entries(aspectWords.triumph).map(([stageKey]) => {
          const stage = Number(stageKey);
          const percent = {
            [nativeRace.CLEAR_MIST_STAGE]: preset.race.clearMistPercent,
            [nativeRace.SECOND_WIND_STAGE]: preset.race.secondWindPercent,
            [nativeRace.PALE_MOON_STAGE]: preset.race.paleMoonPercent,
            [nativeRace.SPOILS_STAGE]: preset.race.spoilsPercent,
          }[stage];
          if (percent === undefined) throw new Error(`Missing Triumph check for stage ${stageKey}`);
          const head = triumphHead(stage, percent);
          return `${head.name} ${head.rule}.`;
        }),
      ],
    },
    {
      page: "frontier/shop-and-referrals",
      phrases: [
        anySpendEnabled
          ? `Spending Fragments is on.`
          : `Spending Fragments is turned off during the final testnet (${calendar.testnetDates} UTC).`,
        `Custom amounts cost $${(FRAGMENT_CENTS / 100).toFixed(2)} per Fragment, from ${n(MIN_FRAGMENTS)} up to ${n(FRAGMENTS_A_DAY)} Fragments per day.`,
        `You pay with ${allPayTokens} from your linked`,
        `${n(nativeFragments.SEAL_FRAGMENTS)} Fragments`,
        `Lasts the whole season.`,
        staminaRule,
        rerollRule,
        `Nothing sold adds Glory:`,
        `reaches ${n(FRIEND_GLORY)} Glory in the Deep pays you ${n(FRIEND_FRAGMENTS)} Fragments, with no cap per season.`,
      ],
    },
    {
      page: "account/lords",
      phrases: [
        `The Shop takes ${mainnetTokens.lords.symbol} (or swaps ${swapPayTokens} into ${mainnetTokens.lords.symbol} through AVNU) for Fragments.`,
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
    phrases: [`link one within ${claimWindowSeconds / 86400} days after the results are posted`],
  },
];

/** The phrases every rules page that states a stamina, guard, chest or points number must show. */
export const publicDataPhrases = (release, heraldLimits, dashboardOrigins, publicData) => {
  const aspectMapLiteral = `{ ${aspects.map((aspect) => `${aspect.id}: "${aspect.name}"`).join(", ")} }`;
  const routeChecks = publicData.routes.map((route) =>
    route.base === "herald"
      ? `${route.method} ${release.public_herald_url}${route.path}`
      : `${route.method} ${release.public_rpc_url}`,
  );
  return [
    {
      page: "data/dashboard",
      phrases: [
        dashboardOrigins.heraldUrl,
        dashboardOrigins.rpcUrl,
        dashboardOrigins.identityOrigin,
        `Player actions count confirmed transactions that recorded a timed story or battle once each.`,
      ],
    },
    {
      page: "data/get-the-data",
      phrases: [
        `Copy-paste agent prompt`,
        `Herald base URL is ${release.public_herald_url}`,
        `Shard Starknet JSON-RPC URL is ${release.public_rpc_url}`,
        `Read-only only: never send write calls, transactions, or mutations.`,
        `Show the top Glory earners per Aspect this season.`,
        publicData.leaderboardRule,
        publicData.snapshotModelsList,
        ...publicData.rateEtiquette,
        ...routeChecks,
        ...publicData.routes.map((route) => `${route.method} ${route.path}`),
        `curl -sS ${release.public_herald_url}/games`,
        `curl -sS -X POST ${release.public_rpc_url}`,
        `const ASPECTS = ${aspectMapLiteral};`,
        `Page size limit defaults to ${heraldLimits.ROSTER_PAGE_DEFAULT} and accepts 1 to ${heraldLimits.ROSTER_PAGE_LIMIT}.`,
        `Page size limit defaults to ${heraldLimits.HISTORY_PAGE_DEFAULT} and accepts 0 to ${heraldLimits.HISTORY_PAGE_LIMIT}.`,
        `limit=${heraldLimits.ROSTER_PAGE_LIMIT}&offset=`,
        `limit=${heraldLimits.HISTORY_PAGE_LIMIT}&offset=`,
        ...aspects.map((aspect) => `${aspect.id} ${aspect.name}`),
      ],
    },
  ];
};

export const expectedPhrases = (
  frontier,
  frontierPreset,
  nativeRules,
  nativeFragments,
  nativeOaths,
  nativeRace,
  extra,
) => [...frontierPhrases(frontier, frontierPreset, nativeRules, nativeFragments, nativeOaths, nativeRace, extra)];

export const expectedPageIcons = ({
  aspectMeaning,
  buildingMeaning,
  frontierPreset,
  iconUrl,
  relicKinds,
  relicMeaning,
  worldBaneHead,
}) => {
  const baneRules = {
    beast_percent: frontierPreset.banes.beastPercent,
    stamina_percent: frontierPreset.banes.staminaPercent,
    production_percent: frontierPreset.banes.productionPercent,
  };
  return [
    {
      page: "frontier/buildings",
      icons: FRONTIER_BUILDING_TYPES.map((id) => iconUrl(buildingMeaning(id, true), 128)),
    },
    {
      page: "frontier/relics",
      icons: relicKinds.map((kind) => iconUrl(relicMeaning(kind), 128)),
    },
    {
      page: "frontier/banes",
      icons: worldBanes.map((entry) => iconUrl(worldBaneHead(entry.id, baneRules).icon, 128)),
    },
    {
      page: "data/dashboard",
      icons: aspects.map((aspect) => iconUrl(aspectMeaning(aspect.id), 128)),
    },
  ];
};

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
      nativeBaneConstants: nativeBane,
      nativeFragmentConstants: nativeFragments,
      nativeOathConstants: nativeOaths,
      nativeQuestConstants: nativeQuest,
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
    const { RELICS_PER_LAYER: relicsPerLayer, previewRuinGuardBounds } = await server.ssrLoadModule(
      join(here, "../../../contracts/l3/world-native/schema/site-previews.gen.ts"),
    );
    const { ASPECT_PAGE_WORDS: aspectWords, RELIC_WORDS: relicWords } = await server.ssrLoadModule(
      join(here, "../../game/src/ui/design-system/kit/words.ts"),
    );
    const { aspectMeaning, iconUrl } = await server.ssrLoadModule(
      join(here, "../../game/src/ui/design-system/icon-meaning.ts"),
    );
    const {
      buildingMeaning,
      RELIC_KINDS: relicKinds,
      relicMeaning,
    } = await server.ssrLoadModule(join(here, "../../game/src/ui/design-system/domain-icon-meaning.ts"));
    const { SEASON_ONE_CALENDAR: calendar } = await server.ssrLoadModule(
      join(here, "../docs/utils/season-calendar.ts"),
    );
    const { seasonDayUnitSeconds } = await server.ssrLoadModule(
      join(here, "../../../config/source/common/season-clock.ts"),
    );
    const { CONTRACT: contract, depthRewardPercent } = await server.ssrLoadModule(
      join(here, "../docs/utils/contract-constants.ts"),
    );
    const { buildablePlotCount } = await server.ssrLoadModule(
      join(here, "../../../packages/core/src/utils/castle-reach.ts"),
    );
    const { buildingCopyCost, buildingCopyMultiplier } = await server.ssrLoadModule(
      join(here, "../../../packages/core/src/utils/building-cost-mode.ts"),
    );
    const { isOnePerRealm } = await server.ssrLoadModule(
      join(here, "../../../packages/core/src/utils/realm-research.ts"),
    );
    const { oathAttackStamina, oathFuryRefund, oathSitePay } = await server.ssrLoadModule(
      join(here, "../../../packages/core/src/utils/oaths.ts"),
    );
    const { logisticsStamina } = await server.ssrLoadModule(
      join(here, "../../../packages/core/src/utils/attribute-tiers.ts"),
    );
    const { MAINNET_TOKENS: mainnetTokens } = await server.ssrLoadModule(
      join(here, "../../../packages/chain/src/tokens.ts"),
    );
    const { oathEffectDescription } = await server.ssrLoadModule(
      join(here, "../../game/src/ui/features/frontier/army/oath-details.ts"),
    );
    const { relicEffect } = await server.ssrLoadModule(
      join(here, "../../game/src/ui/features/frontier/relics/relic-catalog.ts"),
    );
    const { triumphHead, worldBaneHead } = await server.ssrLoadModule(join(here, "../docs/utils/bane-faces.ts"));
    const devRelease = JSON.parse(readFileSync(join(here, "../../../deploy/release/dev.json"), "utf8"));
    const productionRelease = JSON.parse(readFileSync(join(here, "../../../deploy/release/production.json"), "utf8"));
    const environments = JSON.parse(readFileSync(join(here, "../../../deploy/first/environments.json"), "utf8"));
    const { isDevEnvironment } = await server.ssrLoadModule(join(here, "../../game/src/shell/frame/environment.ts"));
    const devBuild = isDevEnvironment(process.env.VITE_PUBLIC_ENVIRONMENT);
    const dashboardOrigins = {
      heraldUrl: (devBuild ? devRelease : productionRelease).public_herald_url,
      rpcUrl: (devBuild ? devRelease : productionRelease).public_rpc_url,
      identityOrigin: (devBuild ? environments.dev : environments.production).origin,
    };
    const heraldLimits = await server.ssrLoadModule(join(here, "../../herald/src/http-limits.ts"));
    const {
      LEADERBOARD_RULE: leaderboardRule,
      PUBLIC_ROUTES: publicRoutes,
      RATE_ETIQUETTE: rateEtiquette,
      SNAPSHOT_MODELS: snapshotModels,
    } = await server.ssrLoadModule(join(here, "../docs/utils/public-data.ts"));
    const publicData = {
      routes: publicRoutes,
      leaderboardRule,
      rateEtiquette,
      snapshotModelsList: snapshotModels.join(", "),
    };
    return {
      frontierPreset,
      frontierConfig,
      historicalFrontierPreset,
      nativeBane,
      nativeFragments,
      nativeOaths,
      nativeQuest,
      nativeRace,
      nativeResearch,
      nativeRules,
      aspectWords,
      relicWords,
      relicKinds,
      commandBits,
      aspectMeaning,
      buildingMeaning,
      iconUrl,
      relicMeaning,
      calendar,
      seasonDayUnitSeconds,
      contract,
      buildablePlotCount,
      buildingCopyCost,
      buildingCopyMultiplier,
      isOnePerRealm,
      oathAttackStamina,
      oathFuryRefund,
      oathSitePay,
      relicsPerLayer,
      previewRuinGuardBounds,
      depthRewardPercent,
      logisticsStamina,
      mainnetTokens,
      oathEffectDescription,
      relicEffect,
      triumphHead,
      worldBaneHead,
      productionRelease,
      devBuild,
      productionPlayOrigin: environments.production.origin,
      dashboardOrigins,
      heraldLimits,
      publicData,
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
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
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
        .replace(/\\(.)/g, "$1")
        .replace(/<\/?[A-Za-z][^>]*>/g, " ")
        .replace(/\*\*|\||`/g, " ")
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

export const FORBIDDEN_RETIRED_HUD_TERMS = [
  /\bnext\s+up\b/i,
  /\bup\s+next\b/i,
  /\bwar\s+hall\b/i,
  /\bworkers\s+hut\b/i,
  /\bwhat\s+you\s+can'?t\s+do\b/i,
  /\bwhat\s+you\s+can\s+do\b/i,
  /\bfar-eye\b/i,
];

const FORBIDDEN_PLAYER_MODE_TERMS = [...FORBIDDEN_MODE_TERMS, /\beternum\b/i, ...FORBIDDEN_RETIRED_HUD_TERMS];

const isDeveloperPath = (file) => file.startsWith("development/") || file.startsWith("docs/pages/development/");

export const forbiddenModeMatches = (text, allowEternumName = false) =>
  (allowEternumName ? FORBIDDEN_MODE_TERMS : FORBIDDEN_PLAYER_MODE_TERMS).flatMap((pattern) => {
    const match = text.match(pattern);
    return match ? [`forbidden term: …${text.slice(Math.max(0, match.index - 40), match.index + 30)}…`] : [];
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
    ...publicDataPhrases(sources.productionRelease, sources.heraldLimits, sources.dashboardOrigins, sources.publicData),
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
