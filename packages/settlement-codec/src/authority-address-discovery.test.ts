import { describe, expect, test } from "vitest";
import { discoverDynamicAddressInputUses, isDynamicAddressInputSourcePath } from "./authority-address-discovery";

describe("A20 dynamic address-input discovery", () => {
  test("classifies workflow, CLI, and runtime-field address inputs", () => {
    const source = `
      factoryAddress: "GAME_LAUNCH_FACTORY_ADDRESS",
      append_optional_arg args --vrf-provider-address "\${VRF_PROVIDER_ADDRESS:-}"
      const world = request.worldAddress;
    `;

    expect(discoverDynamicAddressInputUses(source)).toEqual(
      expect.arrayContaining([
        { semanticKey: "factory", sourceKey: "GAME_LAUNCH_FACTORY_ADDRESS", inputKind: "environment" },
        { semanticKey: "factory", sourceKey: "factoryAddress", inputKind: "runtime-field" },
        { semanticKey: "vrfProvider", sourceKey: "--vrf-provider-address", inputKind: "cli" },
        { semanticKey: "vrfProvider", sourceKey: "VRF_PROVIDER_ADDRESS", inputKind: "environment" },
        { semanticKey: "world", sourceKey: "request.worldAddress", inputKind: "runtime-field" },
      ]),
    );
  });

  test("scans the full executable-source universe and rejects generated or test paths", () => {
    for (const path of [
      "runtime/input.mts",
      "runtime/input.cts",
      "runtime/input.py",
      "runtime/input.rs",
      "runtime/input.cjs",
      "runtime/input.yml",
    ]) {
      expect(isDynamicAddressInputSourcePath(path), path).toBe(true);
    }
    expect(isDynamicAddressInputSourcePath("runtime/input.test.ts")).toBe(false);
    expect(isDynamicAddressInputSourcePath("runtime/generated/input.ts")).toBe(false);
  });

  test("does not misclassify pinned canonical defaults as dynamic inputs", () => {
    expect(discoverDynamicAddressInputUses("const DEFAULT_MAINNET_FACTORY_ADDRESS = '0x1';")).toEqual([]);
  });
});
