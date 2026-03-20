import type { ConfigPatch } from "../common/merge-config";
import { buildCommonBaseConfig } from "../common/base-config";
import { mergeConfigPatches } from "../common/merge-config";
import { eternumBuildingConfig } from "./building";
import { eternumEconomyConfig } from "./economy";
import { eternumExplorationConfig } from "./exploration";
import { eternumHyperstructureConfig } from "./hyperstructures";
import { eternumRealmLevelConfig } from "./levels";
import { eternumVictoryPointConfig } from "./points";
import { eternumResourceConfig } from "./resources";
import { eternumTroopConfig } from "./troop";

const ETERNUM_SPIRES_LAYER_DISTANCE = 6;
const ETERNUM_SPIRES_MAX_COUNT = 1;
const ETERNUM_SPIRES_SETTLED_COUNT = 0;

const eternumVillageConfig: ConfigPatch = {
  village: {
    village_pass_nft_address: "0x0",
  },
};

const eternumBlitzModeConfig: ConfigPatch = {
  blitz: {
    mode: {
      on: false,
    },
    registration: {
      fee_token: "0x0",
      fee_recipient: "0x0",
      fee_amount: 0n,
      registration_count_max: 0,
      registration_delay_seconds: 0,
      registration_period_seconds: 0,
      entry_token_class_hash: "0x0",
      entry_token_ipfs_cid: "",
      collectible_cosmetics_max_items: 0,
      collectible_cosmetics_address: "0x0",
      collectible_timelock_address: "0x0",
      collectibles_lootchest_address: "0x0",
      collectibles_elitenft_address: "0x0",
    },
  },
};

const eternumSettlementConfig: ConfigPatch = {
  settlement: {
    spires_layer_distance: ETERNUM_SPIRES_LAYER_DISTANCE,
    spires_max_count: ETERNUM_SPIRES_MAX_COUNT,
    spires_settled_count: ETERNUM_SPIRES_SETTLED_COUNT,
  },
};

export const eternumBaseConfig: ConfigPatch = mergeConfigPatches(
  buildCommonBaseConfig(),
  eternumExplorationConfig,
  eternumResourceConfig,
  eternumTroopConfig,
  eternumBuildingConfig,
  eternumHyperstructureConfig,
  eternumRealmLevelConfig,
  eternumVictoryPointConfig,
  eternumVillageConfig,
  eternumBlitzModeConfig,
  eternumSettlementConfig,
  eternumEconomyConfig,
);
