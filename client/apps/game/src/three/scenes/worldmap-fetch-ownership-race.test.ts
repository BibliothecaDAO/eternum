import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  createWorldmapRenderAreaHydrationState,
  finalizePendingRenderAreaHydrationOwnership,
  getPendingRenderAreaHydrationPromise,
  registerPendingRenderAreaHydration,
} from "./worldmap-render-area-hydration-state";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const worldmapPath = resolve(currentDir, "worldmap.tsx");
  return readFileSync(worldmapPath, "utf8");
}

describe("worldmap fetch ownership race hardening", () => {
  it("does not let stale fetch finalizers delete newer pending owners", () => {
    const fetchKey = "16,16:render";
    const firstOwner = Promise.resolve(true);
    const secondOwner = Promise.resolve(true);
    const state = createWorldmapRenderAreaHydrationState();
    registerPendingRenderAreaHydration(state, fetchKey, ["tileOpt", "explorerTroops"], secondOwner);

    const staleDeleted = finalizePendingRenderAreaHydrationOwnership(
      state,
      fetchKey,
      ["tileOpt", "explorerTroops"],
      firstOwner,
    );

    expect(staleDeleted).toBe(false);
    expect(getPendingRenderAreaHydrationPromise(state, fetchKey, ["tileOpt", "explorerTroops"])).toBe(secondOwner);

    const currentDeleted = finalizePendingRenderAreaHydrationOwnership(
      state,
      fetchKey,
      ["tileOpt", "explorerTroops"],
      secondOwner,
    );

    expect(currentDeleted).toBe(true);
    expect(getPendingRenderAreaHydrationPromise(state, fetchKey, ["tileOpt", "explorerTroops"])).toBe(null);
  });

  it("wires ownership-aware finalizer into executeTileEntitiesFetch", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/finalizePendingRenderAreaHydrationOwnership\s*\(/);
  });

  it("keeps executeTileEntitiesFetch finalizer free of out-of-scope promise references", () => {
    const source = readWorldmapSource();
    const methodStart = source.indexOf("private async executeTileEntitiesFetch");
    const nextMethodStart = source.indexOf("private touchMatrixCache", methodStart);
    const executeMethodSource =
      methodStart >= 0 && nextMethodStart > methodStart ? source.slice(methodStart, nextMethodStart) : "";

    expect(executeMethodSource).not.toMatch(/fetchPromise/);
  });
});
