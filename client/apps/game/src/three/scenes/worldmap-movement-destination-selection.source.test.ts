// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

const extractMethod = (source: string, startMarker: string, endMarker: string): string => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  return source.slice(start, end);
};

describe("worldmap movement destination selection", () => {
  it("keeps the submitted movement destination selected after clearing action paths", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const movementMethod = extractMethod(source, "  private onArmyMovement", "  private onArmyAttack");

    expect(movementMethod).toContain("const targetHex = actionPath[actionPath.length - 1].hex;");
    expect(movementMethod).toContain("this.keepMovementDestinationSelected(targetHex);");

    const destinationSelectionIndex = movementMethod.indexOf("this.keepMovementDestinationSelected(targetHex);");
    const commandCompleteIndex = movementMethod.lastIndexOf(
      "this.state.updateEntityActionHoveredHex(null);",
      destinationSelectionIndex,
    );
    const commandSuccessCleanup = movementMethod.slice(commandCompleteIndex, destinationSelectionIndex);
    expect(destinationSelectionIndex).toBeGreaterThan(0);
    expect(commandSuccessCleanup).not.toContain("this.clearSelection();");
  });

  it("updates the selected tile panel from the movement destination without replaying click audio", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const helper = extractMethod(source, "  private keepMovementDestinationSelected", "  private clearSelection");

    expect(helper).toContain("this.clearEntitySelection();");
    expect(helper).toContain("this.selectedHexManager.setPosition");
    expect(helper).toContain("this.state.setSelectedHex");
    expect(helper).not.toContain("this.interactionAdapter.selectHex");
  });
});
