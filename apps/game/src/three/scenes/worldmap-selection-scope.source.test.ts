// @vitest-environment node
import { readFileSync, existsSync } from "node:fs";
import { expect, it } from "vitest";
const scene = readFileSync(new URL("./worldmap.tsx", import.meta.url), "utf8");
it("keeps action highlights sourced from the selected entity's paths", () => {
  expect(scene).toContain("this.highlightHexManager.highlightHexes(actionPaths.getHighlightDescriptors())");
  expect(scene).toContain("const highlightedHexes = actionPaths.getHighlightDescriptors()");
  expect(scene).not.toContain("showOwnershipPulses");
  expect(scene).toContain('key: "Escape"');
  expect(scene).toContain("this.selectionPulseManager.hideSelection()");
});
it("removes the action banner and its mount", () => {
  const layout = readFileSync(new URL("../../ui/layouts/world.tsx", import.meta.url), "utf8");
  expect(layout).not.toContain("ActionInstructions");
  expect(
    existsSync(new URL("../../ui/features/world/components/actions/action-instructions.tsx", import.meta.url)),
  ).toBe(false);
});
