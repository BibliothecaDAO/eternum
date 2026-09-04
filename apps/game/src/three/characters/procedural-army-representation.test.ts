import { ModelType } from "@/three/types/army";
import { describe, expect, it, vi } from "vitest";

import {
  reconcileProceduralArmyRepresentations,
  shouldPresentArmyProcedurally,
} from "./procedural-army-representation";

describe("procedural army representation", () => {
  it("routes land units to procedural actors while retaining the boat model", () => {
    expect(shouldPresentArmyProcedurally(ModelType.Knight1)).toBe(true);
    expect(shouldPresentArmyProcedurally(ModelType.Crossbowman2)).toBe(true);
    expect(shouldPresentArmyProcedurally(ModelType.Paladin3)).toBe(true);
    expect(shouldPresentArmyProcedurally(ModelType.Boat)).toBe(true);
    expect(shouldPresentArmyProcedurally(undefined)).toBe(false);
  });

  it("switches model and prop slots atomically and restores removed fallbacks", () => {
    const activeEntityIds = new Set<number>();
    const setLegacyModelVisible = vi.fn();
    const setLegacyAttachmentsVisible = vi.fn();
    const reconcile = (readyEntityIds: ReadonlySet<number>) =>
      reconcileProceduralArmyRepresentations({
        activeEntityIds,
        readyEntityIds,
        setLegacyAttachmentsVisible,
        setLegacyModelVisible,
      });

    reconcile(new Set([11, 12]));
    expect(activeEntityIds).toEqual(new Set([11, 12]));
    expect(setLegacyModelVisible.mock.calls).toEqual([
      [11, false],
      [12, false],
    ]);
    expect(setLegacyAttachmentsVisible.mock.calls).toEqual([
      [11, false],
      [12, false],
    ]);

    reconcile(new Set([12, 13]));
    expect(activeEntityIds).toEqual(new Set([12, 13]));
    expect(setLegacyModelVisible.mock.calls.slice(2)).toEqual([
      [11, true],
      [13, false],
    ]);
    expect(setLegacyAttachmentsVisible.mock.calls.slice(2)).toEqual([
      [11, true],
      [13, false],
    ]);

    reconcile(new Set());
    expect(activeEntityIds).toEqual(new Set());
    expect(setLegacyModelVisible.mock.calls.slice(4)).toEqual([
      [12, true],
      [13, true],
    ]);
  });
});
