import type { RpcProvider } from "starknet";
import { createMadaraAccount } from "../../config/deployer/clean/shared/madara-account";

export function fixtureAdmin(provider: RpcProvider) {
  return createMadaraAccount(
    provider,
    "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d",
    "0x077e56c6dc32d40a67f6f7e6625c8dc5e570abe49c0a24e9202e4ae906abcc07",
  );
}
