// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveHoverVisualPalette, type HoverVisualPalette } from "../managers/worldmap-interaction-palette";
import {
  shouldReconcileWorldmapHover,
  type WorldmapHoverReconciliationSnapshot,
} from "./worldmap-hover-reconciliation";

const snapshot = (
  col: number | null,
  row: number | null,
  palette: HoverVisualPalette = resolveHoverVisualPalette({ hasSelection: false }),
): WorldmapHoverReconciliationSnapshot => ({
  hex: col === null || row === null ? null : { col, row },
  palette,
});

describe("worldmap hover reconciliation", () => {
  it("reconciles the first resolved hover", () => {
    expect(shouldReconcileWorldmapHover(null, snapshot(4, 7))).toBe(true);
  });

  it("skips a stationary hex while its hover mode is unchanged", () => {
    const outlinePalette = resolveHoverVisualPalette({ hasSelection: false, preserveOutlineOnly: true });

    expect(shouldReconcileWorldmapHover(snapshot(4, 7, outlinePalette), snapshot(4, 7, outlinePalette))).toBe(false);
  });

  it("reconciles when the resolved hex, intensity, or hover mode changes", () => {
    const genericPalette = resolveHoverVisualPalette({ hasSelection: false });
    const actionPalette = resolveHoverVisualPalette({ hasSelection: true, actionType: "move" });
    const outlinePalette = resolveHoverVisualPalette({ hasSelection: false, preserveOutlineOnly: true });

    expect(shouldReconcileWorldmapHover(snapshot(4, 7), snapshot(5, 7))).toBe(true);
    expect(shouldReconcileWorldmapHover(snapshot(4, 7, genericPalette), snapshot(4, 7, actionPalette))).toBe(true);
    expect(shouldReconcileWorldmapHover(snapshot(4, 7, outlinePalette), snapshot(4, 7, genericPalette))).toBe(true);
  });

  it("does not repeat leave reconciliation while the pointer remains off-map", () => {
    expect(shouldReconcileWorldmapHover(snapshot(null, null), snapshot(null, null))).toBe(false);
  });
});
