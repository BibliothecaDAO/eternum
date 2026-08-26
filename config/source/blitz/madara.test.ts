import { describe, expect, test } from "bun:test";
import generatedMadaraBlitzConfig from "../../generated/blitz.madara.json";

describe("generated Madara Blitz config", () => {
  test("keeps the phase-one game fee-free and collectible-free", () => {
    const config = generatedMadaraBlitzConfig.configuration;

    expect(config.blitz.registration.fee_amount).toBe("0");
    expect(config.blitz.registration.registration_count_max).toBe(96);
    expect(config.blitz.registration.entry_token_class_hash).toBe("0x0");
    expect(config.blitz.registration.collectible_cosmetics_address).toBe("0x0");
    expect(config.blitz.registration.collectible_timelock_address).toBe("0x0");
    expect(config.blitz.registration.collectibles_lootchest_address).toBe("0x0");
    expect(config.blitz.registration.collectibles_elitenft_address).toBe("0x0");
    expect(config.agent.controller_address).toBe("0x0");
    expect(config.vrf.vrfProviderAddress).toBe("0x0");
  });
});
