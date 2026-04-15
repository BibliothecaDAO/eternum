import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("worldmap army tile-sync recovery", () => {
  it("tracks authoritative tile sync timestamps separately from generic army updates", () => {
    const src = readSource("worldmap.tsx");
    expect(src).toContain("private armyLastTileSyncAt: Map<ID, number> = new Map()");
  });

  it("records tile sync after ArmyManager applies resolved live tile batch updates", () => {
    const src = readSource("worldmap.tsx");

    const methodStart = src.indexOf("private async applyResolvedArmyTileBatch(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 2600);
    const applyPos = methodBody.indexOf("await this.armyManager.onTileUpdate(update)");
    const syncPos = methodBody.indexOf("this.armyLastTileSyncAt.set(entityId, Date.now())");

    expect(applyPos).toBeGreaterThan(-1);
    expect(syncPos).toBeGreaterThan(-1);
    expect(syncPos).toBeGreaterThan(applyPos);
  });

  it("does not advance tile-sync recovery from troop updates", () => {
    const src = readSource("worldmap.tsx");

    const listenerStart = src.indexOf("this.worldUpdateListener.Army.onExplorerTroopsUpdate((update) => {");
    expect(listenerStart).toBeGreaterThan(-1);

    const listenerBody = src.slice(listenerStart, listenerStart + 1400);
    expect(listenerBody).not.toContain("this.armyLastTileSyncAt.set(update.entityId");
  });

  it("uses tile-sync timestamps for scheduled removal cancellation and deferred retry", () => {
    const src = readSource("worldmap.tsx");

    const scheduleStart = src.indexOf("private scheduleArmyRemoval(");
    const retryStart = src.indexOf("private retryDeferredChunkRemovals()");
    expect(scheduleStart).toBeGreaterThan(-1);
    expect(retryStart).toBeGreaterThan(-1);

    const scheduleBody = src.slice(scheduleStart, scheduleStart + 3800);
    const retryBody = src.slice(retryStart, retryStart + 900);

    expect(scheduleBody).toContain("this.armyLastTileSyncAt.get(entityId)");
    expect(retryBody).toContain("this.armyLastTileSyncAt.get(entityId)");
  });
});
