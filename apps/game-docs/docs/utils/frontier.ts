import { frontierPreset } from "../../../../config/source/frontier/native";
import { FRONTIER_DAY_UNIT_SECONDS } from "../../../../config/source/frontier/clock";
import {
  nativeResearchConstants as research,
  nativeRuleConstants as rule,
} from "../../../../contracts/l3/world-native/schema/client.gen";
import { BEAST_NAMES, FALLEN_REALM_DEPTHS, ROAMING_BEASTS, SITE_GUARDS } from "@bibliothecadao/types";
import { ETERNUM_CONFIG } from "./config";
import { CONTRACT } from "./contract-constants";

/**
 * Frontier's rules as its pages state them, read from the preset the game is launched with (the generated config for
 * the board, troops and stamina; the native preset for days, sites, chests and research) and the contract's rule
 * constants. A page never writes one of these numbers by hand.
 */
const config = ETERNUM_CONFIG("frontier");
const stamina = config.troop.stamina;
const limit = config.troop.limit;

/** Thousands with commas, as every page writes them. */
const n = (value: number) => value.toLocaleString("en-US");
/** Basis points as a percentage: 600 → "6%". */
const pct = (bps: number) => `${n(bps / 100)}%`;
const range = (lower: number, upper: number) => `${n(lower)}–${n(upper)}`;

const DEPTH_NAMES = ["Surface", "Ethereal I", "Ethereal II", "Ethereal III"] as const;
const TIERS = ["common", "uncommon", "rare", "epic", "legendary"] as const;
const hoursOf = (units: number) => (units * FRONTIER_DAY_UNIT_SECONDS) / 3600;

// A bag of days holds one day of each length, 2 to 6 units (contracts/l3/world-native/src/days.cairo).
const SHORT_DAY_UNITS = 2;
const LONG_DAY_UNITS = 6;
const DAYS_PER_BAG = CONTRACT.daysPerBag;
const UNITS_PER_BAG = CONTRACT.unitsPerBag;

const EXPLORE_CHEST_ONE_IN = 10_000 / CONTRACT.frontierChestFindBps;
// Refill's price, from logic/relics.cairo: 1 LORDS per missing point.
const REFILL_LORDS_PER_POINT = 1;

const tickMinutes = config.tick.armiesTickIntervalInSeconds / 60;

// What one troop costs to deploy, in wheat: the Knight recipe's wheat over its output (Frontier deploys Knights only).
// Each Rations pick takes the preset's rationStep off it, in whole wheat (resources_domain.cairo `ration_cut`).
const KNIGHT = 26;
const WHEAT = 35;
const knightWheat = config.resources.productionBySimpleRecipe[KNIGHT]?.find(
  (input: { resource: number }) => input.resource === WHEAT,
);
if (!knightWheat) throw new Error("Frontier's Knight recipe takes no wheat");
const wheatPerTroop = knightWheat.amount / config.resources.productionBySimpleRecipeOutputs[KNIGHT];

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
  },
  stamina: {
    max: n(stamina.staminaKnightMax),
    perTick: n(stamina.staminaGainPerTick),
    tickMinutes: n(tickMinutes),
    fullHours: n(((stamina.staminaKnightMax / stamina.staminaGainPerTick) * tickMinutes) / 60),
    reveal: n(stamina.staminaExploreStaminaCost),
    step: n(stamina.staminaTravelStaminaCost),
    attack: n(stamina.staminaAttackReq),
    wheatPerTroop: n(stamina.staminaExploreWheatCost),
    well: n(rule.WELL_STAMINA),
    tierBought: n(rule.TIER_STAMINA_REFILL),
    refillLords: n(REFILL_LORDS_PER_POINT),
    logisticsMax: n(rule.LOGISTICS_LEGENDARY_STAMINA),
  },
  discovery: {
    beasts: pct(frontierPreset.discovery.beastsBps),
    camp: pct(frontierPreset.discovery.campBps),
    rift: pct(frontierPreset.discovery.riftBps),
    ruin: pct(frontierPreset.discovery.ruinBps),
    shrine: pct(frontierPreset.discovery.shrineBps),
    well: pct(frontierPreset.discovery.wellBps),
    emptyRevealLimit: n(frontierPreset.discovery.emptyRevealLimit),
    exploreChestOneIn: n(EXPLORE_CHEST_ONE_IN),
  },
  depths: frontierPreset.depths.map((depth, index) => ({
    name: DEPTH_NAMES[index],
    ruinGuardName: BEAST_NAMES[FALLEN_REALM_DEPTHS[index]!.beast],
    revealPercent: `${depth.revealPercent}%`,
    entryStamina: n(depth.entryStamina),
    siteGuard: range(depth.siteGuardLower, depth.siteGuardUpper),
    ruinGuard: range(depth.ruinGuardLower, depth.ruinGuardUpper),
    beastWeak: range(depth.beastWeakLower, depth.beastWeakUpper),
    beastStrong: range(depth.beastStrongLower, depth.beastStrongUpper),
    chest: TIERS.map((tier) => pct(depth.chest[tier])),
  })),
  guards: {
    camp: BEAST_NAMES[SITE_GUARDS.camp.beast],
    rift: BEAST_NAMES[SITE_GUARDS.rift.beast],
    weakBeast: BEAST_NAMES[ROAMING_BEASTS.lowly.beast],
    strongBeast: BEAST_NAMES[ROAMING_BEASTS.stronger.beast],
  },
  xp: {
    reveal: n(frontierPreset.progression.revealXp),
    shrine: n(frontierPreset.progression.fixedXp),
    tierPrices: [
      frontierPreset.progression.uncommonXp,
      frontierPreset.progression.rareXp,
      frontierPreset.progression.epicXp,
      frontierPreset.progression.legendaryXp,
    ].map(n),
  },
  chests: {
    shares: TIERS.map((tier) => n(frontierPreset.chests.shares[tier])),
    priceCeiling: n(frontierPreset.chests.priceCeiling),
  },
  buildings: [
    ["Farm", research.FARM, "Wheat"],
    ["Barracks", research.BARRACKS, "Troops"],
    ["Workshop", research.WORKSHOP, "Labor"],
    ["Workers' hut", research.HUT, "Population"],
    ["War hall, Supply yard, Scouts' lodge, Hearth", research.WAR_HALL, "A tier for every new army"],
  ].map(([name, id, makes]) => ({
    name: name as string,
    makes: makes as string,
    labor: n(config.buildings.simpleBuildingCost[id as number][0].amount),
    // A hut takes no population: a page says so in words rather than as a zero.
    population:
      config.buildings.buildingPopulation[id as number] === 0
        ? "None"
        : n(config.buildings.buildingPopulation[id as number]),
  })),
  research: {
    farm: researchRow(research.ROW_FARM),
    workshop: researchRow(research.ROW_WORKSHOP),
    barracks: researchRow(research.ROW_BARRACKS),
    hut: researchRow(research.ROW_HUT),
    training: researchRow(research.ROW_WAR_HALL),
    shrine: researchRow(research.ROW_SHRINE)[0],
    well: researchRow(research.ROW_WELL)[0],
    depths: researchRow(research.ROW_DEPTH),
    trainingGate: TIERS[frontierPreset.board.trainingGateTier],
    outputStep: pct(frontierPreset.board.outputStepBps),
    rationWheat: n(frontierPreset.board.rationStep),
    troopWheat: n(wheatPerTroop),
    populationStep: pct(frontierPreset.board.populationStepBps),
  },
  attributes: {
    battleMax: pct(rule.BATTLE_LEGENDARY_BPS),
    scouting: [
      rule.SCOUTING_UNCOMMON_BPS,
      rule.SCOUTING_RARE_BPS,
      rule.SCOUTING_EPIC_BPS,
      rule.SCOUTING_LEGENDARY_BPS,
    ].map(pct),
    scoutingOneKind: pct(
      rule.SCOUTING_UNCOMMON_BPS + rule.SCOUTING_RARE_BPS + rule.SCOUTING_EPIC_BPS + rule.SCOUTING_LEGENDARY_BPS,
    ),
  },
  claimWindow: {
    days: n(Math.floor(frontierPreset.chests.claimWindowSeconds / 86400)),
    graceHours: n(rule.FRONTIER_REPORT_GRACE_SECONDS / 3600),
  },
  labor: { perRealm: n(frontierPreset.labor.amount) },
  homecoming: [
    rule.HOMECOMING_UNCOMMON_BPS,
    rule.HOMECOMING_RARE_BPS,
    rule.HOMECOMING_EPIC_BPS,
    rule.HOMECOMING_LEGENDARY_BPS,
  ].map(pct),
};
