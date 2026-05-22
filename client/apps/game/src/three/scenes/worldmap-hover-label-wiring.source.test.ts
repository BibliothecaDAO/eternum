import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readWorldmapSource(): string {
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function readRendererSceneBootstrapSource(): string {
  return readFileSync(resolve(currentDir, "../renderer-scene-bootstrap.ts"), "utf8");
}

function extractSourceBetween(source: string, startSignature: string, endSignature: string): string {
  const start = source.indexOf(startSignature);
  const end = source.indexOf(endSignature, start + startSignature.length);
  if (start === -1 || end === -1) {
    return "";
  }

  return source.slice(start, end);
}

describe("worldmap hover label wiring", () => {
  it("refreshes current hover after entity caches catch up", () => {
    const source = readWorldmapSource();

    expect(extractSourceBetween(source, "public updateArmyHexes(", "public updateStructureHexes(")).toContain(
      "this.refreshCurrentHoverLabels()",
    );
    expect(extractSourceBetween(source, "public updateStructureHexes(", "public updateChestHexes(")).toContain(
      "this.refreshCurrentHoverLabels()",
    );
    expect(extractSourceBetween(source, "public updateChestHexes(", "public async updateExploredHex(")).toContain(
      "this.refreshCurrentHoverLabels()",
    );
  });

  it("resolves hover labels with direct army raycast fallback", () => {
    const source = readWorldmapSource();

    expect(source).toContain("resolveWorldmapHoverLabelTargets");
    expect(source).toContain("resolveRaycastArmyHoverTarget");
  });

  it("passes markLabelsDirty into WorldmapScene construction", () => {
    const source = readRendererSceneBootstrapSource();

    expect(source).toContain("markLabelsDirty");
    expect(source).toMatch(/new WorldmapScene\([\s\S]*markLabelsDirty/);
  });

  it("refreshes current hover labels after manager labels are reattached", () => {
    const source = readWorldmapSource();

    expect(
      extractSourceBetween(source, "private attachWorldmapManagerLabels()", "private detachWorldmapManagerLabels()"),
    ).toContain("this.refreshCurrentHoverLabels()");
  });
});
