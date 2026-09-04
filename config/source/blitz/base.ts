import type { ConfigPatch } from "../common/merge-config";
import { buildCommonBaseConfig } from "../common/base-config";
import { mergeConfigPatches } from "../common/merge-config";
import { blitzBuildingConfig } from "./building";
import { blitzExplorationConfig } from "./exploration";
import { blitzHyperstructureConfig } from "./hyperstructures";
import { blitzRealmLevelConfig } from "./levels";
import { blitzVictoryPointConfig } from "./points";
import { blitzResourceConfig } from "./resources";
import { blitzTroopConfig } from "./troop";

type BlitzRegistrarConfigPatch = ConfigPatch & {
  season?: {
    endGraceSeconds?: number;
  };
};

const BLITZ_REGISTRATION_COUNT_MAX = 24;
const BLITZ_REGISTRATION_DELAY_SECONDS = 10;
const BLITZ_END_GRACE_SECONDS = 60 * 60 * 24;
const BLITZ_COLLECTIBLE_COSMETICS_MAX_ITEMS = 5;
const BLITZ_DISABLED_BANK_NAME = "Disabled Bank";

const blitzModeConfig: ConfigPatch = {
  blitz: {
    mode: {
      on: true,
    },
    registration: {
      registration_count_max: BLITZ_REGISTRATION_COUNT_MAX,
      registration_delay_seconds: BLITZ_REGISTRATION_DELAY_SECONDS,
      collectible_cosmetics_max_items: BLITZ_COLLECTIBLE_COSMETICS_MAX_ITEMS,
      collectible_cosmetics_address: "0x0",
      collectible_timelock_address: "0x0",
      collectibles_lootchest_address: "0x0",
      collectibles_elitenft_address: "0x0",
    },
  },
};

const blitzSeasonConfig: BlitzRegistrarConfigPatch = {
  season: {
    endGraceSeconds: BLITZ_END_GRACE_SECONDS,
  },
};

const blitzVillageConfig: ConfigPatch = {
  village: {
    village_pass_nft_address: "0x0",
  },
};

const blitzTradeConfig: ConfigPatch = {
  trade: {
    maxCount: 0,
  },
  banks: {
    name: BLITZ_DISABLED_BANK_NAME,
    lordsCost: 0,
    lpFeesNumerator: 0,
    lpFeesDenominator: 100,
    ownerFeesNumerator: 0,
    ownerFeesDenominator: 100,
    maxNumBanks: 0,
    ammStartingLiquidity: {},
    lordsLiquidityPerResource: 0,
  },
};

const blitzSettlementConfig: ConfigPatch = {
  settlement: {
    spires_layer_distance: 0,
    spires_max_count: 0,
    spires_settled_count: 0,
  },
};

export const blitzBaseConfig: ConfigPatch = mergeConfigPatches(
  buildCommonBaseConfig(),
  blitzExplorationConfig,
  blitzResourceConfig,
  blitzTroopConfig,
  blitzBuildingConfig,
  blitzHyperstructureConfig,
  blitzRealmLevelConfig,
  blitzVictoryPointConfig,
  blitzModeConfig,
  blitzSeasonConfig,
  blitzVillageConfig,
  blitzTradeConfig,
  blitzSettlementConfig,
);
