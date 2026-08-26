import type { ConfigPatch } from "../common/merge-config";

export const MADARA_STRK_ADDRESS = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

export const madaraBlitzConfig: ConfigPatch = {
  agent: {
    controller_address: "0x0",
  },
  blitz: {
    registration: {
      fee_amount: 0n,
      fee_token: MADARA_STRK_ADDRESS,
      registration_count_max: 96,
      entry_token_class_hash: "0x0",
      collectible_cosmetics_address: "0x0",
      collectible_timelock_address: "0x0",
      collectibles_lootchest_address: "0x0",
      collectibles_elitenft_address: "0x0",
    },
  },
  vrf: {
    vrfProviderAddress: "0x0",
  },
};
