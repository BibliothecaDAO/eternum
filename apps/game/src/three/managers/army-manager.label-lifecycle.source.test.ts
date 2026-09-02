// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The compact label (the tier glyph in the mid band) rides the army model's visible-slot reconcile: whatever hides
 * or evicts the model leaves no label behind on an empty hex.
 */
describe("army label lifecycle", () => {
  it("the visible-slot sync retains only the labels of placed armies", () => {
    const source = readFileSync(resolve(process.cwd(), "src/three/managers/army-manager.ts"), "utf8");
    const sync = source.slice(source.indexOf("private syncVisibleSlots(): void {"));
    const body = sync.slice(0, sync.indexOf("\n  }\n"));
    expect(body).toContain("this.armyModel.setVisibleSlots(this.visibleArmyIndices.values())");
    expect(body).toContain("this.compactLabelRenderer.retainOnly(this.visibleArmyIndices.keys())");
  });
});
