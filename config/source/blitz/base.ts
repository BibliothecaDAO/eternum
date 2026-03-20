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

const BLITZ_REGISTRATION_FEE_RECIPIENT = "0x040DB150844Dc372928b3B47e23CB6E240E2c99ddC5381680aFd73d777Cbd6C8";
const BLITZ_REGISTRATION_FEE_AMOUNT = 10n * 10n ** 18n;
const BLITZ_REGISTRATION_COUNT_MAX = 24;
const BLITZ_REGISTRATION_DELAY_SECONDS = 10;
const BLITZ_REGISTRATION_PERIOD_SECONDS = 60 * 60 * 3;
const BLITZ_ENTRY_TOKEN_IPFS_CID = "Qm123idkmaybe";
const BLITZ_COLLECTIBLE_COSMETICS_MAX_ITEMS = 5;
const BLITZ_DISABLED_BANK_NAME = "Disabled Bank";

const blitzModeConfig: ConfigPatch = {
  blitz: {
    mode: {
      on: true,
    },
    registration: {
      fee_token: "0x0",
      fee_recipient: BLITZ_REGISTRATION_FEE_RECIPIENT,
      fee_amount: BLITZ_REGISTRATION_FEE_AMOUNT,
      registration_count_max: BLITZ_REGISTRATION_COUNT_MAX,
      registration_delay_seconds: BLITZ_REGISTRATION_DELAY_SECONDS,
      registration_period_seconds: BLITZ_REGISTRATION_PERIOD_SECONDS,
      entry_token_class_hash: "0x0",
      entry_token_ipfs_cid: BLITZ_ENTRY_TOKEN_IPFS_CID,
      collectible_cosmetics_max_items: BLITZ_COLLECTIBLE_COSMETICS_MAX_ITEMS,
      collectible_cosmetics_address: "0x0",
      collectible_timelock_address: "0x0",
      collectibles_lootchest_address: "0x0",
      collectibles_elitenft_address: "0x0",
    },
  },
};

const blitzMatchmakingConfig: ConfigPatch = {
  mmr: {
    enabled: true,
    mmr_token_address: "0x0",
    distribution_mean: 1500,
    spread_factor: 450,
    max_delta: 45,
    k_factor: 50,
    lobby_split_weight_scaled: 2500,
    mean_regression_scaled: 150,
    min_players: 6,
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
  blitzMatchmakingConfig,
  blitzVillageConfig,
  blitzTradeConfig,
  blitzSettlementConfig,
);
