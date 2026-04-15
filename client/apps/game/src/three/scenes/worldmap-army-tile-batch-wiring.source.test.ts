// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relativePath), "utf8");

describe("Worldmap army tile batch wiring", () => {
  it("subscribes to pre-resolved army tile batches from the world update listener", () => {
    const source = readSource("worldmap.tsx");

    const listenerStart = source.indexOf("this.worldUpdateListener.Army.onTileBatchUpdate(async (batch) => {");
    expect(listenerStart).toBeGreaterThan(-1);

    const nextSubscriptionPos = source.indexOf("this.addWorldUpdateSubscription(", listenerStart + 1);
    expect(nextSubscriptionPos).toBeGreaterThan(listenerStart);

    const listenerBody = source.slice(listenerStart, nextSubscriptionPos);
    expect(listenerBody).toContain("await this.applyResolvedArmyTileBatch(batch)");
    expect(listenerBody).not.toContain("this.enqueueArmyTileBatchUpdate(update)");
  });

  it("keeps live and removal application in applyResolvedArmyTileBatch", () => {
    const source = readSource("worldmap.tsx");

    const applyStart = source.indexOf("private async applyResolvedArmyTileBatch(");
    expect(applyStart).toBeGreaterThan(-1);

    const applyBody = source.slice(applyStart, applyStart + 2800);
    expect(applyBody).toContain("this.applyResolvedArmyHexBatch(mutations)");
    expect(applyBody).toContain("await this.armyManager.onTileUpdate(update)");
    expect(applyBody).toContain('this.scheduleArmyRemoval(update.entityId, "tile"');
  });

  it("keeps positive ExplorerTroops updates out of authoritative hex cache mutation", () => {
    const source = readSource("worldmap.tsx");

    const listenerStart = source.indexOf("this.worldUpdateListener.Army.onExplorerTroopsUpdate((update) => {");
    expect(listenerStart).toBeGreaterThan(-1);

    const nextSubscriptionPos = source.indexOf("this.addWorldUpdateSubscription(", listenerStart + 1);
    expect(nextSubscriptionPos).toBeGreaterThan(listenerStart);

    const listenerBody = source.slice(listenerStart, nextSubscriptionPos);
    expect(listenerBody).not.toContain("this.updateArmyHexes(update)");
    expect(listenerBody).toContain("this.armyManager.updateArmyFromExplorerTroopsUpdate(update)");
  });

  it("does not keep a second timed army tile batch queue in worldmap", () => {
    const source = readSource("worldmap.tsx");

    expect(source).not.toContain("private pendingArmyTileBatchByEntity:");
    expect(source).not.toContain("private pendingArmyTileBatchFlushTimeout:");
    expect(source).not.toContain("private readonly armyTileBatchSettleMs");
    expect(source).not.toContain("private enqueueArmyTileBatchUpdate(");
    expect(source).not.toContain("private scheduleArmyTileBatchFlush(");
    expect(source).not.toContain("private async flushArmyTileBatch(");
  });
});
