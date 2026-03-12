import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { hydrateFastTravelChunkState } from "./fast-travel-hydration";
import { resolveFastTravelMovement } from "./fast-travel-movement-policy";
import { resolveFastTravelChunkHydrationPlan } from "./fast-travel-chunk-loading-runtime";

function readFastTravelSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const scenePath = resolve(currentDir, "fast-travel.ts");
  return readFileSync(scenePath, "utf8");
}

describe("FastTravelScene chunk loading movement compatibility", () => {
  it("rebuilds chunk switches through a single apply path", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(
      /private applyFastTravelVisibleChunk\(chunkKey: string, startCol: number, startRow: number\)/,
    );
    expect(source).toMatch(/resolveFastTravelChunkHydrationPlan/);
    expect(source).toMatch(/hydrateFastTravelChunkState\(/);
    expect(source).toMatch(/prepareFastTravelRenderState\(/);
    expect(source).toMatch(/this\.currentChunk = chunkKey/);
    expect(source).toMatch(/this\.syncFastTravelSceneVisuals\(\)/);
  });

  it("keeps movement valid anywhere inside the larger render window after a chunk switch", () => {
    const chunkPlan = resolveFastTravelChunkHydrationPlan({
      startCol: 12,
      startRow: 12,
    });
    const armies = [
      {
        entityId: "fast-travel-army",
        hexCoords: { col: 20, row: 20 },
        ownerName: "Warp Vanguard",
      },
    ];
    const hydratedChunk = hydrateFastTravelChunkState({
      chunkKey: chunkPlan.chunkKey,
      startCol: chunkPlan.startCol,
      startRow: chunkPlan.startRow,
      width: chunkPlan.width,
      height: chunkPlan.height,
      armies,
      spires: [],
    });

    const movement = resolveFastTravelMovement({
      selectedArmyEntityId: "fast-travel-army",
      targetHexCoords: { col: 25, row: 20 },
      visibleHexWindow: hydratedChunk.visibleHexWindow,
      armies,
      spireAnchors: [],
    });

    expect(chunkPlan.width).toBeGreaterThan(12);
    expect(movement).not.toBeNull();
    expect(movement?.targetHexCoords).toEqual({ col: 25, row: 20 });
    expect(movement?.pathHexes[0]).toEqual({ col: 20, row: 20 });
    expect(movement?.pathHexes.at(-1)).toEqual({ col: 25, row: 20 });
  });
});
