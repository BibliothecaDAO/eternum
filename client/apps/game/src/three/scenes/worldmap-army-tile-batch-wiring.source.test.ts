// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap army tile batch wiring", () => {
  it("enqueues army tile updates instead of applying them inline from the TileOpt listener", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const listenerStart = source.indexOf(
      "this.worldUpdateListener.Army.onTileUpdate(async (update: ExplorerTroopsTileSystemUpdate) => {",
    );
    expect(listenerStart).toBeGreaterThan(-1);

    const nextSubscriptionPos = source.indexOf("this.addWorldUpdateSubscription(", listenerStart + 1);
    expect(nextSubscriptionPos).toBeGreaterThan(listenerStart);

    const listenerBody = source.slice(listenerStart, nextSubscriptionPos);
    expect(listenerBody).toContain("this.enqueueArmyTileBatchUpdate(update)");
    expect(listenerBody).not.toContain("this.updateArmyHexes(update)");
    expect(listenerBody).not.toContain("await this.armyManager.onTileUpdate(update)");
    expect(listenerBody).not.toContain('this.scheduleArmyRemoval(update.entityId, "tile"');
  });

  it("routes live and removal application through the batch flush path", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const flushStart = source.indexOf("private async flushArmyTileBatch()");
    expect(flushStart).toBeGreaterThan(-1);

    const flushBody = source.slice(flushStart, flushStart + 2400);
    expect(flushBody).toContain("resolveArmyTileBatch(");
    expect(flushBody).toContain("await this.applyResolvedArmyTileBatch(");
  });

  it("keeps positive ExplorerTroops updates out of authoritative hex cache mutation", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const listenerStart = source.indexOf("this.worldUpdateListener.Army.onExplorerTroopsUpdate((update) => {");
    expect(listenerStart).toBeGreaterThan(-1);

    const nextSubscriptionPos = source.indexOf("this.addWorldUpdateSubscription(", listenerStart + 1);
    expect(nextSubscriptionPos).toBeGreaterThan(listenerStart);

    const listenerBody = source.slice(listenerStart, nextSubscriptionPos);
    expect(listenerBody).not.toContain("this.updateArmyHexes(update)");
    expect(listenerBody).toContain("this.armyManager.updateArmyFromExplorerTroopsUpdate(update)");
  });
});
