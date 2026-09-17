import type { ConfigPatch } from "../common/merge-config";

export const madaraBlitzConfig: ConfigPatch = {
  blitz: {
    registration: {
      registration_count_max: 96,
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
