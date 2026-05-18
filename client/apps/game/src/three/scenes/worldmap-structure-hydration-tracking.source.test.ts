import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function extractCallbackBody(source: string, listenerCall: string): string {
  const listenerStart = source.indexOf(listenerCall);
  expect(listenerStart).toBeGreaterThanOrEqual(0);
  const nextRegistration = source.indexOf("this.addWorldUpdateSubscription", listenerStart + listenerCall.length);
  return source.slice(listenerStart, nextRegistration === -1 ? undefined : nextRegistration);
}

describe("worldmap structure hydration tracking wiring", () => {
  it("tracks async structure model updates before structure hydration is allowed to drain", () => {
    const source = readWorldmapSource();
    const body = extractCallbackBody(source, "this.worldUpdateListener.Structure.onStructureUpdate((update) => {");

    expect(body).toContain("void this.trackStructureHydrationUpdate(update,");
    expect(body).toContain("this.structureManager.updateStructureLabelFromStructureUpdate(update)");
  });

  it("tracks async structure-building model updates before structure hydration is allowed to drain", () => {
    const source = readWorldmapSource();
    const body = extractCallbackBody(
      source,
      "this.worldUpdateListener.Structure.onStructureBuildingsUpdate((update) => {",
    );

    expect(body).toContain("void this.trackStructureHydrationUpdate(update,");
    expect(body).toContain("this.structureManager.updateStructureLabelFromBuildingUpdate(update)");
  });
});
