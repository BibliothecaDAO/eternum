import { BuildingType } from "../../../packages/types/src/constants";
import {
  nativeResearchConstants as research,
  nativeRuleConstants as rule,
} from "../../../contracts/l3/world-native/schema/balance.gen";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import type { NativePreset } from "../common/native-preset";
import { FRONTIER_PRESET_ID } from "../common/native-preset-modes";
import { FRONTIER_DAY_UNIT_SECONDS } from "./clock";

/** Every building a Frontier board can raise, by its category id. */
export const buildingIds = Object.values(BuildingType).filter(
  (id): id is BuildingType => typeof id === "number" && id !== BuildingType.None,
);

export const FRONTIER_COST_GROWTH_BPS = 10000;

const RESEARCH_RANK_STARTS = [
  { essenceCost: 1000, laborCost: 500 },
  { essenceCost: 2500, laborCost: 1000 },
  { essenceCost: 5000, laborCost: 2500 },
  { essenceCost: 10000, laborCost: 5000 },
] as const;

function researchTierScaleBps(tier: number, growthBps = FRONTIER_COST_GROWTH_BPS): number {
  return 10000 + (tier - 1) ** 2 * growthBps;
}

function buildResearchRow(row: number, rank: number, tiers: number) {
  const start = RESEARCH_RANK_STARTS[rank]!;
  return Array.from({ length: tiers }, (_, index) => {
    const tier = index + 1;
    const scaleBps = researchTierScaleBps(tier);
    return {
      row,
      tier,
      essenceCost: (start.essenceCost * scaleBps) / 10000,
      laborCost: (start.laborCost * scaleBps) / 10000,
    };
  });
}

const researchRows = [
  { row: research.ROW_FARM, rank: 0, tiers: 5 },
  { row: research.ROW_WORKSHOP, rank: 0, tiers: 5 },
  { row: research.ROW_CONSCRIPTION, rank: research.CONSCRIPTION_CAMP_LEVEL, tiers: 5 },
  { row: research.ROW_RATIONS, rank: research.RATIONS_DEPOT_LEVEL, tiers: 5 },
  { row: research.ROW_SUPPLY_YARD, rank: research.SUPPLY_YARD_LEVEL, tiers: 5 },
  { row: research.ROW_KNIGHT_OATHS, rank: 3, tiers: research.OATH_SLOTS_STEPS },
  { row: research.ROW_SCOUT_OATHS, rank: 3, tiers: research.OATH_SLOTS_STEPS },
  { row: research.ROW_CROSSBOW_OATHS, rank: 3, tiers: research.OATH_SLOTS_STEPS },
];

export const frontierPreset = {
  orderAspects: [],
  deep: null,
  race: null,
  dailyQuest: null,
  banes: null,
  startingTroops: Array.from({ length: 17 }, () => "Knight" as const),
  realmResources: [],
  bridgeResources: [],
  id: FRONTIER_PRESET_ID,
  gameType: "frontier",
  environmentGameType: "frontier",
  settlementMode: "Single",
  modeRules: rule.HOME_REWARDS | rule.UNOWNED_TARGETS | rule.DEPTH_CONTENTS | rule.REVEAL_SUPPLIES,
  entryRule: rule.ENTRY_OPEN,
  commandMask: (
    [
      "SettleSeason",
      "CreateExplorer",
      "ManageTroops",
      "Explore",
      "Move",
      "BattleGuard",
      "CreateBuilding",
      "DestroyBuilding",
      "LevelUp",
      "Research",
      "ChooseOath",
      "RerollOath",
      "BuyStamina",
      "BuySeal",
      "EnterDepth",
      "InteractSite",
      "SetEntityName",
      "SetRealmSkin",
      "MarkGameSettled",
    ] satisfies Array<keyof typeof nativeCommandBits>
  ).reduce((mask, command) => mask | BigInt(nativeCommandBits[command]), 0n),
  spacing: 100,
  // Four-hour units: days of 8 to 24 hours, bags of 80 hours, a season of 21 bags in ten weeks.
  dayUnitSeconds: FRONTIER_DAY_UNIT_SECONDS,
  board: {
    demolitionRefundBps: 5000,
    workshopRate: 0.056,
    outputStepBps: 2000,
    storageStepBps: 4000,
    rationStep: 0.2,
    troopStoreDeploys: 2,
    resourceStoreCaps: [6000, 18000, 40000, 80000],
  },
  research: [
    ...researchRows.flatMap(({ row, rank, tiers }) => buildResearchRow(row, rank, tiers)),
    ...[2500, 5000, 10000].map((essenceCost, index) => ({
      row: research.ROW_LORE,
      tier: index + 1,
      essenceCost,
      laborCost: 0,
    })),
  ],
  discovery: {
    beastsBps: 900,
    campBps: 400,
    riftBps: 400,
    ruinBps: 300,
    shrineBps: 300,
    wellBps: 300,
    emptyRevealLimit: 7,
  },
  labor: { amount: 1000, campaignEssence: 0, goldenAmount: 1000, goldenEssence: 0 },
  // Daily chest prices cannot exceed 50 LORDS per share.
  chests: {
    poolBps: 7_000,
    topN: 10,
    priceCeiling: 50,
    shares: { common: 1, uncommon: 2, rare: 4, epic: 10, legendary: 20 },
    claimWindowSeconds: 7 * 86400,
  },
  depths: [
    {
      revealPercent: 10,
      revealCap: 1000,
      riftEssenceBps: 15000,
      siteGuardLower: 1200,
      siteGuardUpper: 1400,
      riftGuardLower: 1400,
      riftGuardUpper: 1600,
      guardStep: 100,
      beastWeakLower: 380,
      beastWeakUpper: 420,
      beastStrongLower: 430,
      beastStrongUpper: 470,
      revealSiteNeighbors: false,
      chest: { common: 5000, uncommon: 2700, rare: 1400, epic: 600, legendary: 300 },
    },
    {
      revealPercent: 10,
      revealCap: 1500,
      riftEssenceBps: 15000,
      siteGuardLower: 2400,
      siteGuardUpper: 2800,
      riftGuardLower: 2800,
      riftGuardUpper: 3200,
      guardStep: 100,
      beastWeakLower: 760,
      beastWeakUpper: 840,
      beastStrongLower: 860,
      beastStrongUpper: 940,
      revealSiteNeighbors: false,
      chest: { common: 0, uncommon: 5000, rare: 2833, epic: 1500, legendary: 667 },
    },
    {
      revealPercent: 10,
      revealCap: 2000,
      riftEssenceBps: 15000,
      siteGuardLower: 4700,
      siteGuardUpper: 5700,
      riftGuardLower: 5400,
      riftGuardUpper: 6600,
      guardStep: 100,
      beastWeakLower: 1520,
      beastWeakUpper: 1680,
      beastStrongLower: 1720,
      beastStrongUpper: 1880,
      revealSiteNeighbors: false,
      chest: { common: 0, uncommon: 0, rare: 5500, epic: 3000, legendary: 1500 },
    },
    {
      revealPercent: 10,
      revealCap: 2500,
      riftEssenceBps: 15000,
      siteGuardLower: 9300,
      siteGuardUpper: 11500,
      riftGuardLower: 10700,
      riftGuardUpper: 13200,
      guardStep: 100,
      beastWeakLower: 3040,
      beastWeakUpper: 3360,
      beastStrongLower: 3440,
      beastStrongUpper: 3760,
      revealSiteNeighbors: false,
      chest: { common: 0, uncommon: 0, rare: 0, epic: 6400, legendary: 3600 },
    },
  ],
} satisfies NativePreset;
