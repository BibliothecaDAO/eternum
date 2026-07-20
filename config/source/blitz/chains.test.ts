import { describe, expect, test } from "vitest";
import type { EnvironmentContext } from "../common/environment";
import { resolveBlitzRegistrationAddresses } from "./addresses";

describe("Blitz authoritative address resolution", () => {
  test("the deprecated zero loot-chest alias cannot shadow the canonical mainnet address", () => {
    const config = resolveBlitzRegistrationAddresses(mainnetContext());

    expect(config.collectibles_lootchest_address).toBe("0x1234");
  });
});

function mainnetContext(): EnvironmentContext {
  return {
    chain: "mainnet",
    addresses: {
      lootChests: "0x1234",
      "Collectibles: Realms: Loot Chest": "0x0",
    },
    manifest: {},
    startMainAt: 0,
    startSettlingAt: 0,
    vrfProviderAddress: "0x0",
  };
}
