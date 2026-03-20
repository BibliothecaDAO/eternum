import { describe, expect, it } from "vitest";

import { resolveVisibleTerrainReconcileMode } from "./worldmap-visible-terrain-reconcile-policy";

describe("resolveVisibleTerrainReconcileMode", () => {
  it("visible absent tile chooses append_if_absent", () => {
    expect(
      resolveVisibleTerrainReconcileMode({
        isVisibleInCurrentChunk: true,
        currentOwner: null,
        nextBiomeKey: "Ocean",
        canDirectReplace: false,
      }),
    ).toBe("append_if_absent");
  });

  it("visible same-biome tile chooses no-op", () => {
    expect(
      resolveVisibleTerrainReconcileMode({
        isVisibleInCurrentChunk: true,
        currentOwner: { biomeKey: "Ocean" },
        nextBiomeKey: "Ocean",
        canDirectReplace: false,
      }),
    ).toBe("none");
  });

  it("visible different-biome same-hex chooses replace_same_hex when ownership is proven", () => {
    expect(
      resolveVisibleTerrainReconcileMode({
        isVisibleInCurrentChunk: true,
        currentOwner: { biomeKey: "Ocean" },
        nextBiomeKey: "TemperateRainForest",
        canDirectReplace: true,
      }),
    ).toBe("replace_same_hex");
  });

  it("visible different-biome uncertain ownership chooses atomic_chunk_refresh", () => {
    expect(
      resolveVisibleTerrainReconcileMode({
        isVisibleInCurrentChunk: true,
        currentOwner: { biomeKey: "Ocean" },
        nextBiomeKey: "TemperateRainForest",
        canDirectReplace: false,
      }),
    ).toBe("atomic_chunk_refresh");
  });

  it("uncertain same-hex ownership never chooses append_if_absent", () => {
    expect(
      resolveVisibleTerrainReconcileMode({
        isVisibleInCurrentChunk: true,
        currentOwner: { biomeKey: "Ocean" },
        nextBiomeKey: "TemperateRainForest",
        canDirectReplace: false,
      }),
    ).not.toBe("append_if_absent");
  });
});
