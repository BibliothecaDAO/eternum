import { ResourcesIds } from "@bibliothecadao/types";
import type { ConfigPatch } from "../common/merge-config";

const ETERNUM_TRADE_MAX_COUNT = 10;
const ETERNUM_BANK_NAME = "Central Bank";
const ETERNUM_BANK_LORDS_COST = 1000;
const ETERNUM_BANK_LP_FEES_NUMERATOR = 15;
const ETERNUM_BANK_LP_FEES_DENOMINATOR = 100;
const ETERNUM_BANK_OWNER_FEES_NUMERATOR = 15;
const ETERNUM_BANK_OWNER_FEES_DENOMINATOR = 100;
const ETERNUM_MAX_NUM_BANKS = 6;
const ETERNUM_LORDS_LIQUIDITY_PER_RESOURCE = 2_000;
const ETERNUM_ARTIFICER_RESEARCH_COST_FOR_RELIC = 50_000;
const FAITH_PRECISION = 10;
const ETERNUM_FAITH_ENABLED = true;
const ETERNUM_FAITH_WONDER_BASE_FP_PER_SEC = 50 * FAITH_PRECISION;
const ETERNUM_FAITH_HOLY_SITE_FP_PER_SEC = 30 * FAITH_PRECISION;
const ETERNUM_FAITH_REALM_FP_PER_SEC = 10 * FAITH_PRECISION;
const ETERNUM_FAITH_VILLAGE_FP_PER_SEC = 5 * FAITH_PRECISION;
const ETERNUM_FAITH_OWNER_SHARE_PERCENT = 30;

const ETERNUM_AMM_STARTING_LIQUIDITY: { [key in ResourcesIds]?: number } = {
  [ResourcesIds.Wood]: 2_000_000,
  [ResourcesIds.Stone]: 1_600_000,
  [ResourcesIds.Coal]: 1_600_000,
  [ResourcesIds.Copper]: 1_200_000,
  [ResourcesIds.Obsidian]: 1_000_000,
  [ResourcesIds.Silver]: 800_000,
  [ResourcesIds.Ironwood]: 600_000,
  [ResourcesIds.ColdIron]: 500_000,
  [ResourcesIds.Gold]: 400_000,
  [ResourcesIds.Hartwood]: 300_000,
  [ResourcesIds.Diamonds]: 160_000,
  [ResourcesIds.Sapphire]: 140_000,
  [ResourcesIds.Ruby]: 140_000,
  [ResourcesIds.DeepCrystal]: 120_000,
  [ResourcesIds.Ignium]: 120_000,
  [ResourcesIds.EtherealSilica]: 120_000,
  [ResourcesIds.TrueIce]: 80_000,
  [ResourcesIds.TwilightQuartz]: 80_000,
  [ResourcesIds.AlchemicalSilver]: 80_000,
  [ResourcesIds.Adamantine]: 50_000,
  [ResourcesIds.Mithral]: 40_000,
  [ResourcesIds.Dragonhide]: 30_000,
  [ResourcesIds.Donkey]: 120_000,
};

export const eternumEconomyConfig: ConfigPatch = {
  trade: {
    maxCount: ETERNUM_TRADE_MAX_COUNT,
  },
  banks: {
    name: ETERNUM_BANK_NAME,
    lordsCost: ETERNUM_BANK_LORDS_COST,
    lpFeesNumerator: ETERNUM_BANK_LP_FEES_NUMERATOR,
    lpFeesDenominator: ETERNUM_BANK_LP_FEES_DENOMINATOR,
    ownerFeesNumerator: ETERNUM_BANK_OWNER_FEES_NUMERATOR,
    ownerFeesDenominator: ETERNUM_BANK_OWNER_FEES_DENOMINATOR,
    maxNumBanks: ETERNUM_MAX_NUM_BANKS,
    ammStartingLiquidity: ETERNUM_AMM_STARTING_LIQUIDITY,
    lordsLiquidityPerResource: ETERNUM_LORDS_LIQUIDITY_PER_RESOURCE,
  },
  faith: {
    enabled: ETERNUM_FAITH_ENABLED,
    wonder_base_fp_per_sec: ETERNUM_FAITH_WONDER_BASE_FP_PER_SEC,
    holy_site_fp_per_sec: ETERNUM_FAITH_HOLY_SITE_FP_PER_SEC,
    realm_fp_per_sec: ETERNUM_FAITH_REALM_FP_PER_SEC,
    village_fp_per_sec: ETERNUM_FAITH_VILLAGE_FP_PER_SEC,
    owner_share_percent: ETERNUM_FAITH_OWNER_SHARE_PERCENT,
  },
  artificer: {
    research_cost_for_relic: ETERNUM_ARTIFICER_RESEARCH_COST_FOR_RELIC,
  },
};
