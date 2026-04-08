import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readArmyManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "army-manager.ts"), "utf8");
}

describe("army manager delta pipeline wiring", () => {
  it("stops using quadratic visible-order array membership and removal operations", () => {
    const source = readArmyManagerSource();

    expect(source).not.toMatch(/visibleArmyOrder\.includes/);
    expect(source).not.toMatch(/visibleArmyOrder\.indexOf/);
    expect(source).toMatch(/visibleArmyOrderIndices/);
    expect(source).toMatch(/addVisibleArmyOrderEntry/);
    expect(source).toMatch(/removeVisibleArmyOrderEntry/);
    expect(source).toMatch(/replaceVisibleArmyOrder/);
  });

  it("patches visible adds and ownership changes without routing through full visible rerenders", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/await this\.renderArmyIntoCurrentChunkIfVisible\(params\.entityId\)/);
    expect(source).not.toMatch(/await this\.renderVisibleArmies\(this\.currentChunkKey\)/);
    expect(source).toMatch(/slot !== undefined[\s\S]*this\.refreshArmyInstance\(army, slot, modelType\)/);
  });

  it("routes pending explorer deltas through shared reconciliation helpers", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/takeFreshPendingExplorerTroopsUpdate\(/);
    expect(source).toMatch(/queuePendingExplorerTroopsUpdate\(/);
    expect(source).toMatch(/calculateArmyCurrentStamina\(/);
  });

  it("routes instance presentation through shared position and cosmetic helpers", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/resolveArmyPresentationPosition\(/);
    expect(source).toMatch(/resolveArmyCosmeticPresentation\(/);
  });

  it("routes auxiliary presentation through dedicated sync helpers", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/syncArmyAuxiliaryPresentation\(/);
    expect(source).toMatch(/syncArmyIndicatorPresentation\(/);
    expect(source).toMatch(/syncArmyLabelPresentation\(/);
    expect(source).toMatch(/syncArmyPointPresentation\(/);
  });

  it("routes label visibility and label retirement through shared helpers", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/syncArmyLabelVisibility\(/);
    expect(source).toMatch(/removeArmyLabels\(/);
  });

  it("routes attachment lifecycle through shared helpers", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/syncArmyAttachmentState\(/);
    expect(source).toMatch(/removeArmyAttachmentsIfTracked\(/);
  });

  it("routes point icon lifecycle through shared helpers", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/resolveArmyPointRendererKey\(/);
    expect(source).toMatch(/syncArmyPointIconState\(/);
    expect(source).toMatch(/removeArmyPointIconState\(/);
    expect(source).toMatch(/setArmyPointHoverState\(/);
    expect(source).toMatch(/clearArmyPointHoverState\(/);
  });
});
