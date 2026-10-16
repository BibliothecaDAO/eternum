import { describe, expect, test } from "bun:test";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import { buildConfig } from "../../../source/build-config";
import { buildNativePreset } from "../config/native-preset";
import { buildTroopLimitConfig } from "../registrar/preset";

describe("inclusive discovery guard presets", () => {
  test.each([
    ["blitz", 999, 1499, 1499, 1999],
    ["eternum", 800, 1499, 800, 1499],
    ["duel", 800, 1599, 800, 1599],
    ["frontier", 800, 1599, 800, 1599],
  ] as const)(
    "%s encodes its exact reachable endpoints",
    async (gameType, lightLower, lightUpper, heavyLower, heavyUpper) => {
      const config = await buildConfig({ chain: "madara", gameType });
      expect(config.troop.limit).toMatchObject({
        lightGuardLowerBound: lightLower,
        lightGuardUpperBound: lightUpper,
        heavyGuardLowerBound: heavyLower,
        heavyGuardUpperBound: heavyUpper,
      });
      expect(buildTroopLimitConfig(config)).toMatchObject({
        light_guard_lower_bound: lightLower,
        light_guard_upper_bound: lightUpper,
        heavy_guard_lower_bound: heavyLower,
        heavy_guard_upper_bound: heavyUpper,
      });
    },
  );

  test("Blitz enables neither banks nor bitcoin mines", async () => {
    const config = await buildConfig({ chain: "madara", gameType: "blitz" });
    const preset = buildNativePreset(config, 2);
    expect(config.banks.maxNumBanks).toBe(0);
    expect(preset.rules.command_mask & BigInt(nativeCommandBits.CreateBanks)).toBe(0n);
    expect(preset.rules.bitcoin_mine_config.enabled).toBe(false);
    expect(preset.rules.map_config.bitcoin_mine_win_probability).toBe(0);
  });
});
