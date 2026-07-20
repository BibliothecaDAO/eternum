import { describe, expect, test } from "bun:test";
import { assertLegacyLaunchEnvironmentIsMutable } from "../launch/environment-policy";

describe("legacy launch environment policy", () => {
  test("permits provider-neutral non-production environments", () => {
    expect(() => assertLegacyLaunchEnvironmentIsMutable("sepolia.blitz")).not.toThrow();
  });

  test("keeps historical Slot read-only and mainnet Blitz on the game-stack API", () => {
    expect(() => assertLegacyLaunchEnvironmentIsMutable("slot.blitz")).toThrow("read-only");
    expect(() => assertLegacyLaunchEnvironmentIsMutable("slottest.eternum")).toThrow("read-only");
    expect(() => assertLegacyLaunchEnvironmentIsMutable("mainnet.blitz")).toThrow("game-stack API");
    expect(() => assertLegacyLaunchEnvironmentIsMutable("mainnet.eternum")).toThrow("creation is retired");
  });
});
