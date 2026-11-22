import { frontierPreset as historicalFrontierPreset } from "../../../../config/source/frontier/native";
import { nativePresetForId, nativePresetIdFor } from "../../../../config/source/native";
import { seasonDayUnitSeconds } from "../../../../config/source/common/season-clock";
import {
  RELICS_PER_LAYER,
  previewRiftGuardBound,
  previewRuinGuardBounds,
} from "../../../../contracts/l3/world-native/schema/site-previews.gen";
import {
  nativeResearchConstants as research,
  nativeRuleConstants as rule,
} from "../../../../contracts/l3/world-native/schema/balance.gen";
import { LAYER_NAMES, beastOf, TIER_WORDS, resourceName } from "@bibliothecadao/types";
import { ETERNUM_CONFIG } from "./config";
import { playableDepths } from "./playable-depths.mjs";
import { CONTRACT } from "./contract-constants";

/**
 * Frontier's rules as its pages state them, read from the preset the game is launched with (the generated config for
 * the board, troops and stamina; the active native preset for days, sites and research) and the contract's rule
 * constants. A page never writes one of these numbers by hand.
 */
const frontierPreset = nativePresetForId(nativePresetIdFor("frontier"));
const config = ETERNUM_CONFIG("frontier");
const stamina = config.troop.stamina;
const limit = config.troop.limit;

/** Thousands with commas, as every page writes them. */
const n = (value: number) => value.toLocaleString("en-US");
/** Basis points as a percentage: 600 → "6%". */
const pct = (bps: number) => `${n(bps / 100)}%`;
const range = (lower: number, upper: number) => `${n(lower)}–${n(upper)}`;

const TIERS = ["common", "uncommon", "rare", "epic", "legendary"] as const;
const hoursOf = (units: number) => (units * seasonDayUnitSeconds(frontierPreset)) / 3600;

// A bag of days holds one day of each length, 2 to 6 units (contracts/l3/world-native/src/days.cairo).
export const SHORT_DAY_UNITS = 2;
export const LONG_DAY_UNITS = 6;
const DAYS_PER_BAG = CONTRACT.daysPerBag;
const UNITS_PER_BAG = CONTRACT.unitsPerBag;

const tickMinutes = config.tick.armiesTickIntervalInSeconds / 60;

// What one troop costs to deploy, in wheat: the Knight recipe's wheat over its output (Scouts have the same base price).
// Each Rations pick takes the preset's rationStep off it, in whole wheat (resources_domain.cairo `ration_cut`).
const KNIGHT = 26;
const WHEAT = 35;
const knightWheat = config.resources.productionBySimpleRecipe[KNIGHT]?.find(
  (input: { resource: number }) => input.resource === WHEAT,
);
if (!knightWheat) throw new Error("Frontier's Knight recipe takes no wheat");
const wheatPerTroop = knightWheat.amount / config.resources.productionBySimpleRecipeOutputs[KNIGHT];

/** A building's price as the pages write it: each resource it takes, by its catalog name ("6,000 Essence + 1,500 Labor"). */
const priceOf = (costs: readonly { resource: number; amount: number }[]) =>
  costs.map(({ resource, amount }) => `${n(amount)} ${resourceName(resource)}`).join(" + ");

/** One research row's tiers, uncommon up, each with its Essence and labor price. */
const researchRow = (row: number) =>
  frontierPreset.research
    .filter((step) => step.row === row)
    .sort((a, b) => a.tier - b.tier)
    .map((step) => ({ essence: n(step.essenceCost), labor: n(step.laborCost) }));

export const FRONTIER = {
  day: {
    shortestHours: hoursOf(SHORT_DAY_UNITS),
    longestHours: hoursOf(LONG_DAY_UNITS),
    daysPerBag: DAYS_PER_BAG,
    bagHours: hoursOf(UNITS_PER_BAG),
  },
  realm: {
    troops: n(config.startingResources.find((r: { resource: number }) => r.resource === 26).amount),
    wheat: n(config.startingResources.find((r: { resource: number }) => r.resource === 35).amount),
    labor: n(config.startingResources.find((r: { resource: number }) => r.resource === 23).amount),
    armies: [limit.settlementArmies, limit.cityArmies, limit.kingdomArmies, limit.empireArmies].map(n),
    deployCaps: [
      limit.settlementDeploymentCap,
      limit.cityDeploymentCap,
      limit.kingdomDeploymentCap,
      limit.empireDeploymentCap,
    ].map(n),
    castleLabor: [1, 2, 3].map((level) => n(config.realmUpgradeCosts[level][0].amount)),
    demolitionRefund: pct(frontierPreset.board.demolitionRefundBps),
    hutHouses: n(config.buildings.buildingCapacity[1]),
    deployWheat: n(config.resources.productionBySimpleRecipe[26][0].amount),
    /** The wheat and labor a realm stores at each castle level, before Granary and Storeroom research. */
    storage: frontierPreset.board.resourceStoreCaps.map(n),
  },
  stamina: {
    max: n(stamina.staminaKnightMax),
    perTick: n(stamina.staminaGainPerTick),
    tickMinutes: n(tickMinutes),
    fullHours: n(((stamina.staminaKnightMax / stamina.staminaGainPerTick) * tickMinutes) / 60),
    reveal: n(stamina.staminaExploreStaminaCost),
    scoutReveal: n(rule.SCOUT_EXPLORE_STAMINA),
    step: n(stamina.staminaTravelStaminaCost),
    attack: n(stamina.staminaAttackReq),
    wheatPerTroop: n(stamina.staminaExploreWheatCost),
    well: `${n(rule.WELL_REFILL_PERCENT)}% of its maximum`,
    logisticsMax: n((stamina.staminaKnightMax * rule.LOGISTICS_STEP_PERCENT * rule.ATTRIBUTE_CAP) / 100),
  },
  discovery: {
    beasts: pct(frontierPreset.discovery.beastsBps),
    bandsPerHerd: n(rule.BEAST_BAND_SHARE / rule.BEAST_HERD_SHARE),
    camp: pct(frontierPreset.discovery.campBps),
    rift: pct(frontierPreset.discovery.riftBps),
    ruin: pct(frontierPreset.discovery.ruinBps),
    shrine: pct(frontierPreset.discovery.shrineBps),
    well: pct(frontierPreset.discovery.wellBps),
    emptyRevealLimit: n(frontierPreset.discovery.emptyRevealLimit),
  },
  depths: playableDepths(frontierPreset).map((depth, index) => ({
    name: LAYER_NAMES[index],
    revealPercent: `${depth.revealPercent}%`,
    campGuard: `${beastOf("camp", index).name} ${range(depth.siteGuardLower, depth.siteGuardUpper)}`,
    riftGuard: `${beastOf("rift", index).name} ${range(
      previewRiftGuardBound(depth.siteGuardLower, depth.guardStep),
      previewRiftGuardBound(depth.siteGuardUpper, depth.guardStep),
    )}`,
    beastWeak: `${beastOf("herd", index).name} ${range(depth.beastWeakLower, depth.beastWeakUpper)}`,
    beastStrong: `${beastOf("band", index).name} ${range(depth.beastStrongLower, depth.beastStrongUpper)}`,
    ruinGuard: beastOf("ruin", index).name,
  })),
  ruinGuards: LAYER_NAMES.slice(0, 3).flatMap((layer, depth) =>
    TIER_WORDS.slice(depth, depth + RELICS_PER_LAYER).map((name, place) => ({
      layer,
      name,
      count: range(...previewRuinGuardBounds(depth + place + 1, depth)),
    })),
  ),
  buildings: [
    ["Farm", research.FARM, "Wheat"],
    ["Barracks", research.BARRACKS, "Troops"],
    ["Workshop", research.WORKSHOP, "Labor"],
    ["Workers' hut", research.HUT, "Population"],
    ["Supply yard", research.SUPPLY_YARD, "Logistics training"],
    ["Scouts' lodge", research.SCOUTS_LODGE, "Scouts"],
  ].map(([name, id, makes]) => ({
    name: name as string,
    makes: makes as string,
    price: priceOf(config.buildings.simpleBuildingCost[id as number]),
    // A hut takes no population: a page says so in words rather than as a zero.
    population:
      config.buildings.buildingPopulation[id as number] === 0
        ? "None"
        : n(config.buildings.buildingPopulation[id as number]),
  })),
  research: {
    farm: researchRow(research.ROW_FARM),
    workshop: researchRow(research.ROW_WORKSHOP),
    hut: researchRow(research.ROW_HUT),
    training: researchRow(research.ROW_SUPPLY_YARD),
    lore: researchRow(research.ROW_LORE),
    outputStep: pct(frontierPreset.board.outputStepBps),
    storageStep: pct(frontierPreset.board.storageStepBps),
    troopWheat: n(wheatPerTroop),
    populationStep: pct(frontierPreset.board.populationStepBps),
  },
  attributes: {
    lightDamageReduction: `${100 - rule.FRONTIER_LIGHT_DAMAGE_PERCENT}%`,
    knightGuardReduction: `${100 - rule.FRONTIER_KNIGHT_GUARD_DAMAGE_PERCENT}%`,
  },
  quest: {
    labor: n(frontierPreset.dailyQuest.labor),
    essence: n(frontierPreset.dailyQuest.essence),
  },
};

/** Retired paying seasons; only the historical chest page reads these values. */
export const HISTORICAL_FRONTIER_CHESTS = {
  depths: historicalFrontierPreset.depths.map((depth, index) => ({
    name: LAYER_NAMES[index],
    chest: TIERS.map((tier) => pct(depth.chest[tier])),
  })),
  shares: TIERS.map((tier) => n(historicalFrontierPreset.chests.shares[tier])),
  priceCeiling: n(historicalFrontierPreset.chests.priceCeiling),
  claimDays: n(Math.floor(historicalFrontierPreset.chests.claimWindowSeconds / 86400)),
};
