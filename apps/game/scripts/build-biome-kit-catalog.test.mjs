// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  BIOME_KIT_MAX_GLB_BYTES,
  BIOME_KIT_PROPS,
  getBiomeKitTriangleBudgets,
  validateBiomeKitCatalog,
  resolveBiomeKitWindWeight,
} from "./terrain-props/biome-kit-catalog.mjs";

describe("Biome kit terrain prop catalog", () => {
  it("animates foliage without bending woody or stone vertices", () => {
    expect(resolveBiomeKitWindWeight("foliage", [0.03, 0.15, 0.05, 1])).toBe(1);
    expect(resolveBiomeKitWindWeight("foliage", [0.16, 0.08, 0.05, 1])).toBe(0);
    expect(resolveBiomeKitWindWeight("none", [0.2, 0.5, 0.2, 1])).toBe(0);
    expect(resolveBiomeKitWindWeight("all", [0.4, 0.2, 0.3, 1])).toBe(1);
  });
  it("keeps the curated allowlist unique and internally valid", () => {
    expect(validateBiomeKitCatalog()).toEqual([]);
    expect(BIOME_KIT_PROPS).toHaveLength(15);
    expect(new Set(BIOME_KIT_PROPS.map((prop) => prop.id)).size).toBe(15);
    expect(new Set(BIOME_KIT_PROPS.map((prop) => prop.sourceId)).size).toBe(15);
  });

  it("pins authored LOD counts and keeps the existing transfer budget", () => {
    expect(getBiomeKitTriangleBudgets()).toEqual({ near: 8_535, far: 3_133 });
    expect(BIOME_KIT_MAX_GLB_BYTES).toBe(768_000);
  });

  it("rejects duplicate, inverted, and invalid-source catalog entries", () => {
    const invalid = [
      ...BIOME_KIT_PROPS,
      {
        ...BIOME_KIT_PROPS[0],
        sourceId: "not-fbx.obj",
        nearTriangles: 20,
        farTriangles: 30,
      },
    ];

    expect(validateBiomeKitCatalog(invalid)).toEqual(
      expect.arrayContaining([
        "duplicate prop id: broadleaf",
        "broadleaf source must be a biome kit prop id",
        "broadleaf far triangle budget must be positive and no larger than near",
      ]),
    );
  });
});
