import { describe, expect, test } from "bun:test";
import generatedMadaraBlitzConfig from "../../generated/blitz.madara.json";
import { getSeasonAddresses } from "@contracts";
import { resolveConfiguredAddress } from "../common/environment";

describe("generated Madara Blitz config", () => {
  test("keeps the phase-one game collectible-free", () => {
    const config = generatedMadaraBlitzConfig.configuration;

    expect(config.blitz.registration.registration_count_max).toBe(96);
    expect(config.blitz.registration.collectible_cosmetics_address).toBe("0x0");
    expect(config.blitz.registration.collectible_timelock_address).toBe("0x0");
    expect(config.blitz.registration.collectibles_lootchest_address).toBe("0x0");
    expect(config.blitz.registration.collectibles_elitenft_address).toBe("0x0");
    expect(config.agent.controller_address).toBe("0x0");
    expect(config.vrf.vrfProviderAddress).toBe("0x0");
    expect(config.setup.addresses).toEqual({
      strk: "0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    });
  });

  test("rejects a missing configured address instead of writing zero", () => {
    expect(() => resolveConfiguredAddress(undefined, "lords")).toThrow("lords address is not configured");
  });

  test("rejects an address key that the Madara table does not define", () => {
    expect(() => getSeasonAddresses("madara").lords).toThrow("madara address table does not define lords");
  });
});
