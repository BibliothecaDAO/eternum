import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { resolveWorldmapCameraStoreSyncPlan } from "./worldmap-camera-store-sync";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("resolveWorldmapCameraStoreSyncPlan", () => {
  it("suppresses camera-distance store churn during scripted zoom transitions", () => {
    expect(
      resolveWorldmapCameraStoreSyncPlan({
        currentDistance: 20,
        currentHex: { col: 8, row: 12 },
        isScriptedTransitionActive: true,
        nextDistance: 21,
        nextHex: { col: 8, row: 12 },
      }),
    ).toEqual({
      shouldUpdateDistance: false,
      shouldUpdateHex: false,
    });
  });

  it("still updates the camera target hex during scripted zoom when the target moves", () => {
    expect(
      resolveWorldmapCameraStoreSyncPlan({
        currentDistance: 20,
        currentHex: { col: 8, row: 12 },
        isScriptedTransitionActive: true,
        nextDistance: 21,
        nextHex: { col: 9, row: 12 },
      }),
    ).toEqual({
      shouldUpdateDistance: false,
      shouldUpdateHex: true,
    });
  });

  it("commits the settled camera distance once the scripted zoom is idle", () => {
    expect(
      resolveWorldmapCameraStoreSyncPlan({
        currentDistance: 20,
        currentHex: { col: 8, row: 12 },
        isScriptedTransitionActive: false,
        nextDistance: 21,
        nextHex: { col: 8, row: 12 },
      }),
    ).toEqual({
      shouldUpdateDistance: true,
      shouldUpdateHex: false,
    });
  });
});

describe("worldmap camera store sync wiring", () => {
  it("routes camera target store updates through the sync plan helper", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/resolveWorldmapCameraStoreSyncPlan\(/);
  });
});
