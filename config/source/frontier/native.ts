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

export const frontierPreset: NativePreset = {
  ledger: {
    protocolCutBps: 0,
    mmrEnabled: false,
  },
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
  discovery: {
    beastsBps: 600,
    campBps: 400,
    riftBps: 400,
    ruinBps: 100,
    shrineBps: 300,
    wellBps: 300,
    emptyRevealLimit: 7,
  },
  progression: {
    revealXp: 2,
    fixedXp: 200,
    commonXp: 100,
    uncommonXp: 250,
    rareXp: 500,
    epicXp: 900,
    legendaryXp: 1500,
  },
  labor: { amount: 1000 },
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
      siteGuardLower: 1000,
      siteGuardUpper: 1600,
      ruinGuardLower: 2000,
      ruinGuardUpper: 4000,
      guardStep: 100,
      beastWeakLower: 300,
      beastWeakUpper: 350,
      beastStrongLower: 450,
      beastStrongUpper: 550,
      revealSiteNeighbors: false,
      entryStamina: 0,
      chest: { common: 5000, uncommon: 2700, rare: 1400, epic: 600, legendary: 300 },
    },
    {
      revealPercent: 15,
      siteGuardLower: 3000,
      siteGuardUpper: 5000,
      ruinGuardLower: 6000,
      ruinGuardUpper: 10500,
      guardStep: 100,
      beastWeakLower: 900,
      beastWeakUpper: 1050,
      beastStrongLower: 1350,
      beastStrongUpper: 1650,
      revealSiteNeighbors: false,
      entryStamina: 30,
      chest: { common: 0, uncommon: 5000, rare: 2833, epic: 1500, legendary: 667 },
    },
    {
      revealPercent: 20,
      siteGuardLower: 8000,
      siteGuardUpper: 12000,
      ruinGuardLower: 18000,
      ruinGuardUpper: 22500,
      guardStep: 100,
      beastWeakLower: 2400,
      beastWeakUpper: 2800,
      beastStrongLower: 3600,
      beastStrongUpper: 4400,
      revealSiteNeighbors: false,
      entryStamina: 40,
      chest: { common: 0, uncommon: 0, rare: 5500, epic: 3000, legendary: 1500 },
    },
    {
      revealPercent: 25,
      siteGuardLower: 20000,
      siteGuardUpper: 30000,
      ruinGuardLower: 52500,
      ruinGuardUpper: 76000,
      guardStep: 100,
      beastWeakLower: 6000,
      beastWeakUpper: 7000,
      beastStrongLower: 9000,
      beastStrongUpper: 11000,
      revealSiteNeighbors: false,
      entryStamina: 50,
      chest: { common: 0, uncommon: 0, rare: 0, epic: 6400, legendary: 3600 },
    },
  ],
};
