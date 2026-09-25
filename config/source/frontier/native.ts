import type { NativePreset } from "../common/native-preset";
import { nativeRuleConstants as rule } from "../../../contracts/l3/world-native/schema/client.gen";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import { relicRules } from "../common/native-data";
import { FRONTIER_PRESET_ID } from "../common/native-preset-modes";

export const frontierPreset: NativePreset = {
  ledger: {
    entryFee: 0,
    protocolCutBps: 0,
    swordPrice: 0,
    shieldPrice: 0,
    mmrEnabled: false,
    predictionFeeBps: 0,
    liabilityCap: 0,
    seed: 0,
  },
  bitcoinEnabled: false,
  startingTroops: Array.from({ length: 17 }, () => "Knight" as const),
  realmResources: [],
  relics: relicRules.map((rule, index) => ({
    ...rule,
    essence_cost: 0,
    draw_weight: [0, 1, 2, 3, 4, 5, 8, 9].includes(index) ? rule.draw_weight : 0,
  })),
  supplies: [
    { resource_type: 38, amount: 50, amount_max: 300, weight: 1 },
    { resource_type: 23, amount: 60, amount_max: 450, weight: 1 },
    { resource_type: 26, amount: 30, amount_max: 250, weight: 1 },
  ],
  bridgeResources: [],
  id: FRONTIER_PRESET_ID,
  gameType: "frontier",
  environmentGameType: "frontier",
  settlementMode: "Single",
  modeRules:
    rule.HOME_REWARDS |
    rule.DISCOVER_CAMPS |
    rule.DISCOVER_CHESTS |
    rule.UNOWNED_TARGETS |
    rule.DEPTH_CONTENTS |
    rule.CAPTURE_CHESTS |
    rule.HOME_MINE_PRODUCTION |
    rule.HOME_CAMP_REWARDS |
    rule.REVEAL_SUPPLIES |
    rule.SEASON_CLOSE,
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
      "BuyRealmUpgrade",
      "EnterDepth",
      "ApplyRelic",
      "SetEntityName",
      "MarkGameSettled",
    ] satisfies Array<keyof typeof nativeCommandBits>
  ).reduce((mask, command) => mask | BigInt(nativeCommandBits[command]), 0n),
  spacing: 100,
  epochSeconds: 86400,
  board: {
    demolitionRefundBps: 5000,
    workshopRate: 200 / 3600,
    barracksIICost: 8000,
    barracksIIICost: 45000,
    neighbors: [],
  },
  chests: { looseOneIn: 46, relicProbability: 9000, cosmeticProbability: 900, tokenCap: 1 },
  depths: [
    {
      supplyMultiplier: 1,
      guardLower: 1000,
      guardUpper: 1600,
      mineCapMin: 3000,
      mineCapMax: 5000,
      mineRate: 5000 / 86400,
      mineChest: false,
      revealSiteNeighbors: false,
      entryStamina: 0,
      attunementCost: 0,
      chest: { common: 7800, uncommon: 1800, rare: 350, pity: 400 },
    },
    {
      supplyMultiplier: 4,
      guardLower: 3000,
      guardUpper: 5000,
      mineCapMin: 10000,
      mineCapMax: 16000,
      mineRate: 16000 / 86400,
      mineChest: true,
      revealSiteNeighbors: false,
      entryStamina: 30,
      attunementCost: 150000,
      chest: { common: 6000, uncommon: 3000, rare: 800, pity: 100 },
    },
    {
      supplyMultiplier: 8,
      guardLower: 8000,
      guardUpper: 12000,
      mineCapMin: 20000,
      mineCapMax: 32000,
      mineRate: 32000 / 86400,
      mineChest: true,
      revealSiteNeighbors: false,
      entryStamina: 40,
      attunementCost: 330000,
      chest: { common: 4200, uncommon: 3800, rare: 1500, pity: 40 },
    },
    {
      supplyMultiplier: 16,
      guardLower: 20000,
      guardUpper: 30000,
      mineCapMin: 40000,
      mineCapMax: 64000,
      mineRate: 64000 / 86400,
      mineChest: true,
      revealSiteNeighbors: false,
      entryStamina: 50,
      attunementCost: 850000,
      chest: { common: 2500, uncommon: 4300, rare: 2300, pity: 20 },
    },
  ],
};
