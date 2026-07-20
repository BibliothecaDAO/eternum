import type { EnvironmentContext } from "../common/environment";
import { resolveConfiguredAddress } from "../common/address";

export interface BlitzRegistrationAddresses {
  readonly fee_token: string;
  readonly entry_token_class_hash: string;
  readonly collectible_cosmetics_address: string;
  readonly collectible_timelock_address: string;
  readonly collectibles_lootchest_address: string;
  readonly collectibles_elitenft_address: string;
}

export function resolveBlitzRegistrationAddresses(context: EnvironmentContext): BlitzRegistrationAddresses {
  const addresses = context.addresses;
  return {
    fee_token: resolveConfiguredAddress(addresses.lords),
    entry_token_class_hash: resolveConfiguredAddress(addresses.collectiblesClassHash),
    collectible_cosmetics_address: resolveConfiguredAddress(addresses.cosmetics),
    collectible_timelock_address: resolveConfiguredAddress(addresses.collectiblesTimelock),
    collectibles_lootchest_address: resolveConfiguredAddress(addresses.lootChests),
    collectibles_elitenft_address: resolveConfiguredAddress(addresses.eliteInvite),
  };
}
