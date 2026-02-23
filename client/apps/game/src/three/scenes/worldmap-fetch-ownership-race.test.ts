import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { finalizePendingChunkFetchOwnership } from "./worldmap-runtime-lifecycle";

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
    const pendingChunks = new Map<string, Promise<boolean>>([[fetchKey, secondOwner]]);

    const staleDeleted = finalizePendingChunkFetchOwnership({
      pendingChunks,
      fetchKey,
      fetchPromise: firstOwner,
    });

    expect(staleDeleted).toBe(false);
    expect(pendingChunks.get(fetchKey)).toBe(secondOwner);

    const currentDeleted = finalizePendingChunkFetchOwnership({
      pendingChunks,
      fetchKey,
      fetchPromise: secondOwner,
    });

    expect(currentDeleted).toBe(true);
    expect(pendingChunks.has(fetchKey)).toBe(false);
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
