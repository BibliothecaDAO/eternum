import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  finalizePendingChunkFetchOwnership,
  resolvePendingWorldmapChunkFetchPromise,
} from "./worldmap-runtime-lifecycle";

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
    const pendingChunks = new Map<string, { fetchGeneration: number; promise: Promise<boolean> }>([
      [fetchKey, { fetchGeneration: 3, promise: secondOwner }],
    ]);

    const staleDeleted = finalizePendingChunkFetchOwnership({
      pendingChunks,
      fetchKey,
      fetchPromise: firstOwner,
    });

    expect(staleDeleted).toBe(false);
    expect(pendingChunks.get(fetchKey)?.promise).toBe(secondOwner);

    const currentDeleted = finalizePendingChunkFetchOwnership({
      pendingChunks,
      fetchKey,
      fetchPromise: secondOwner,
    });

    expect(currentDeleted).toBe(true);
    expect(pendingChunks.has(fetchKey)).toBe(false);
  });

  it("does not reuse pending owners from invalidated fetch generations", () => {
    const fetchKey = "16,16:render";
    const staleOwner = Promise.resolve(true);
    const pendingChunks = new Map<string, { fetchGeneration: number; promise: Promise<boolean> }>([
      [fetchKey, { fetchGeneration: 4, promise: staleOwner }],
    ]);

    expect(
      resolvePendingWorldmapChunkFetchPromise({
        pendingChunks,
        fetchKey,
        activeFetchGeneration: 5,
      }),
    ).toBeNull();
  });

  it("wires ownership-aware finalizer into executeTileEntitiesFetch", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/finalizePendingChunkFetchOwnership\s*\(/);
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
