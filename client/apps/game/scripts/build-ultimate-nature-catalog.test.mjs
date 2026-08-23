// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  ULTIMATE_NATURE_MAX_GLB_BYTES,
  ULTIMATE_NATURE_PROPS,
  getUltimateNatureTriangleBudgets,
  validateUltimateNatureCatalog,
} from "./terrain-props/ultimate-nature-catalog.mjs";

describe("Ultimate Nature terrain prop catalog", () => {
  it("keeps the curated allowlist unique and internally valid", () => {
    expect(validateUltimateNatureCatalog()).toEqual([]);
    expect(ULTIMATE_NATURE_PROPS).toHaveLength(11);
    expect(new Set(ULTIMATE_NATURE_PROPS.map((prop) => prop.id)).size).toBe(11);
    expect(new Set(ULTIMATE_NATURE_PROPS.map((prop) => prop.sourceFile)).size).toBe(11);
  });

  it("stays within the source triangle and transfer budgets from the terrain brief", () => {
    expect(getUltimateNatureTriangleBudgets()).toEqual({ near: 4_900, far: 1_280 });
    expect(ULTIMATE_NATURE_MAX_GLB_BYTES).toBe(768_000);
  });

  it("rejects duplicate, inverted, and non-FBX catalog entries", () => {
    const invalid = [
      ...ULTIMATE_NATURE_PROPS,
      {
        ...ULTIMATE_NATURE_PROPS[0],
        sourceFile: "not-fbx.obj",
        nearTriangles: 20,
        farTriangles: 30,
      },
    ];

    expect(validateUltimateNatureCatalog(invalid)).toEqual(
      expect.arrayContaining([
        "duplicate prop id: broadleaf",
        "broadleaf source must be FBX",
        "broadleaf far triangle budget must be positive and no larger than near",
      ]),
    );
  });
});
