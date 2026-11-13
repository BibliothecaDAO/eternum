import { FRONTIER_DAY_UNIT_SECONDS } from "./clock";
import type { NativePreset } from "../common/native-preset";
import {
  nativeResearchConstants as research,
  nativeRuleConstants as rule,
} from "../../../contracts/l3/world-native/schema/client.gen";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import { FRONTIER_PRESET_ID } from "../common/native-preset-modes";

/** Every building a Frontier board can raise, by its category id. */
export const buildingIds = Array.from({ length: research.HEARTH }, (_, index) => index + 1);

// Common I is half the old first price; II–V retain the four established prices.
const essenceLadder = [0.5, 1, 4, 12, 30];
const laborLadder = [0.5, 1, 3, 8, 20];
const buildingRows = [
  { row: research.ROW_FARM, essence: 1000, labor: 1000 },
  { row: research.ROW_WORKSHOP, essence: 2000, labor: 2000 },
  { row: research.ROW_BARRACKS, essence: 4000, labor: 3000 },
  { row: research.ROW_HUT, essence: 500, labor: 500 },
  ...[research.ROW_WAR_HALL, research.ROW_SUPPLY_YARD, research.ROW_SCOUTS_LODGE, research.ROW_HEARTH].map((row) => ({
    row,
    essence: 12000,
    labor: 3000,
  })),
];

export const frontierPreset = {
  ledger: {
    protocolCutBps: 0,
    mmrEnabled: false,
  },
  orderAspects: [],
  startingArmyCount: 0,
  dailyQuest: null,
  worldBanes: null,
  bitcoinEnabled: false,
  startingTroops: Array.from({ length: 17 }, () => "Knight" as const),
  realmResources: [],
  relics: [],
  supplies: [],
  bridgeResources: [],
  id: FRONTIER_PRESET_ID,
  gameType: "frontier",
  environmentGameType: "frontier",
  settlementMode: "Single",
  modeRules:
    rule.HOME_REWARDS |
    rule.UNOWNED_TARGETS |
    rule.DEPTH_CONTENTS |
    rule.REVEAL_SUPPLIES |
    rule.SEASON_CLOSE |
    rule.DISCOVER_CHESTS,
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
      "EnterDepth",
      "SpendSkillPoint",
      "InteractSite",
      "OpenRelicChest",
      "RefillStamina",
      "WithdrawLords",
      "SetEntityName",
      "MarkGameSettled",
    ] satisfies Array<keyof typeof nativeCommandBits>
  ).reduce((mask, command) => mask | BigInt(nativeCommandBits[command]), 0n),
  spacing: 100,
  // Four-hour units: days of 8 to 24 hours, bags of 80 hours, a season of 21 bags in ten weeks.
  dayUnitSeconds: FRONTIER_DAY_UNIT_SECONDS,
  board: {
    town: null,
    demolitionRefundBps: 5000,
    workshopRate: 0.056,
    outputStepBps: 2000,
    storageStepBps: 4000,
    populationStepBps: 2000,
    rationStep: 0.2,
    trainingGateTier: 2,
    troopStoreDeploys: 2,
    resourceStoreCaps: [6000, 18000, 40000, 80000],
  },
  research: [
    ...buildingRows.flatMap(({ row, essence, labor }) =>
      essenceLadder.map((factor, index) => ({
        row,
        tier: index + 1,
        essenceCost:
          row >= research.ROW_WAR_HALL && row <= research.ROW_HEARTH && index === 1 ? 16000 : essence * factor,
        laborCost: labor * laborLadder[index]!,
      })),
    ),
    { row: research.ROW_SHRINE, tier: 1, essenceCost: 2000, laborCost: 0 },
    { row: research.ROW_WELL, tier: 1, essenceCost: 6000, laborCost: 0 },
    ...[100000, 250000, 500000].map((essenceCost, index) => ({
      row: research.ROW_DEPTH,
      tier: index + 1,
      essenceCost,
      laborCost: 0,
    })),
  ],
  deep: null,
  discovery: {
    beastsBps: 600,
    campBps: 400,
    riftBps: 400,
    ruinBps: 300,
    shrineBps: 300,
    wellBps: 300,
    emptyRevealLimit: 7,
  },
  progression: {
    revealXp: 2,
    revealXpPerDepth: 1,
    commonXp: 75,
    uncommonXp: 200,
    rareXp: 400,
    epicXp: 800,
    legendaryXp: 1500,
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
      siteGuardLower: 1200,
      siteGuardUpper: 1400,
      ruinGuardLower: 2700,
      ruinGuardUpper: 3300,
      guardStep: 100,
      beastWeakLower: 380,
      beastWeakUpper: 420,
      beastStrongLower: 430,
      beastStrongUpper: 470,
      revealSiteNeighbors: false,
      chest: { common: 5000, uncommon: 2700, rare: 1400, epic: 600, legendary: 300 },
    },
    {
      revealPercent: 15,
      siteGuardLower: 2400,
      siteGuardUpper: 2800,
      ruinGuardLower: 4900,
      ruinGuardUpper: 6100,
      guardStep: 100,
      beastWeakLower: 760,
      beastWeakUpper: 840,
      beastStrongLower: 860,
      beastStrongUpper: 940,
      revealSiteNeighbors: false,
      chest: { common: 0, uncommon: 5000, rare: 2833, epic: 1500, legendary: 667 },
    },
    {
      revealPercent: 20,
      siteGuardLower: 4700,
      siteGuardUpper: 5700,
      ruinGuardLower: 9800,
      ruinGuardUpper: 12200,
      guardStep: 100,
      beastWeakLower: 1520,
      beastWeakUpper: 1680,
      beastStrongLower: 1720,
      beastStrongUpper: 1880,
      revealSiteNeighbors: false,
      chest: { common: 0, uncommon: 0, rare: 5500, epic: 3000, legendary: 1500 },
    },
    {
      revealPercent: 25,
      siteGuardLower: 9300,
      siteGuardUpper: 11500,
      ruinGuardLower: 19600,
      ruinGuardUpper: 24400,
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
