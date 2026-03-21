import { describe, expect, test } from "bun:test";
import { resolveVillageSystemsAddress } from "../factory/discovery";
import type { GameManifestLike } from "../shared/manifest-types";

describe("resolveVillageSystemsAddress", () => {
  test("prefers the exact eternum village_systems tag", () => {
    const manifest: GameManifestLike = {
      contracts: [
        { tag: "world-village_systems", address: "0x2" },
        { tag: "s1_eternum-village_systems", address: "0x1" },
      ],
    };

    expect(resolveVillageSystemsAddress(manifest)).toBe("0x1");
  });

  test("falls back to the village_systems suffix when the exact tag is absent", () => {
    const manifest: GameManifestLike = {
      contracts: [{ tag: "custom-village_systems", address: "0xabc" }],
    };

    expect(resolveVillageSystemsAddress(manifest)).toBe("0xabc");
  });
});
