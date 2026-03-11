import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveArmyActionPathOrigin } from "./worldmap-action-path-origin";

const TEST_FELT_CENTER = 100;

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const worldmapPath = resolve(currentDir, "worldmap.tsx");
  return readFileSync(worldmapPath, "utf8");
}

describe("resolveArmyActionPathOrigin", () => {
  it("prefers current worldmap army position and flags ECS divergence", () => {
    const result = resolveArmyActionPathOrigin({
      feltCenter: TEST_FELT_CENTER,
      worldmapArmyPosition: { col: 42, row: -7 },
      explorerTroopsCoord: { x: 100, y: 100 },
    });

    expect(result).toEqual({
      startPositionOverride: { col: 142, row: 93 },
      hasDivergentOrigin: true,
    });
  });

  it("returns no override when worldmap army position is unavailable", () => {
    const result = resolveArmyActionPathOrigin({
      feltCenter: TEST_FELT_CENTER,
      worldmapArmyPosition: undefined,
      explorerTroopsCoord: { x: 100, y: 100 },
    });

    expect(result).toEqual({
      startPositionOverride: undefined,
      hasDivergentOrigin: false,
    });
  });

  it("stays anchored to latest worldmap position across chunk churn even while ECS lags", () => {
    const beforeMove = resolveArmyActionPathOrigin({
      feltCenter: TEST_FELT_CENTER,
      worldmapArmyPosition: { col: 0, row: 0 },
      explorerTroopsCoord: { x: 100, y: 100 },
    });

    const afterRapidChunkChurn = resolveArmyActionPathOrigin({
      feltCenter: TEST_FELT_CENTER,
      worldmapArmyPosition: { col: 4, row: -3 },
      explorerTroopsCoord: { x: 100, y: 100 },
    });

    const afterEcsCatchesUp = resolveArmyActionPathOrigin({
      feltCenter: TEST_FELT_CENTER,
      worldmapArmyPosition: { col: 4, row: -3 },
      explorerTroopsCoord: { x: 104, y: 97 },
    });

    expect(beforeMove).toEqual({
      startPositionOverride: { col: 100, row: 100 },
      hasDivergentOrigin: false,
    });
    expect(afterRapidChunkChurn).toEqual({
      startPositionOverride: { col: 104, row: 97 },
      hasDivergentOrigin: true,
    });
    expect(afterEcsCatchesUp).toEqual({
      startPositionOverride: { col: 104, row: 97 },
      hasDivergentOrigin: false,
    });
  });
});

describe("worldmap action-path origin wiring", () => {
  it("wires startPositionOverride into army action-path generation", () => {
    const source = readWorldmapSource();
    const armySelectionStart = source.indexOf("private onArmySelection");
    const findActionPathsCallStart = source.indexOf("armyActionManager.findActionPaths", armySelectionStart);
    const findActionPathsSnippet =
      findActionPathsCallStart >= 0 ? source.slice(findActionPathsCallStart, findActionPathsCallStart + 700) : "";

    expect(source).toMatch(/resolveArmyActionPathOrigin/);
    expect(findActionPathsSnippet).toMatch(/startPositionOverride/);
  });
});
