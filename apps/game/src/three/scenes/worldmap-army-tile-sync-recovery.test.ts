import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const readWorldmap = () => readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
const readProjection = () =>
  readFileSync(resolve(currentDir, "../../../../../packages/core/src/sync/world-spatial-projection.ts"), "utf8");
const readWorldUpdateListener = () =>
  readFileSync(resolve(currentDir, "../../../../../packages/core/src/systems/world-update-listener.ts"), "utf8");

describe("worldmap army projection recovery", () => {
  it("derives army existence and position from ExplorerTroops", () => {
    const source = readProjection();

    expect(source).toContain("explorerTroopsComponent.update$.subscribe");
    expect(source).toContain("resolveArmyRenderable(explorerTroops)");
    expect(source).toContain("this.armyIndex.replace(nextArmies)");
  });

  it("routes worldmap side effects through projection changes", () => {
    const source = readWorldmap();
    const lifecycleStart = source.indexOf("private bindWorldSpatialProjectionLifecycle()");
    const lifecycleEnd = source.indexOf("private bindWorldmapCameraViewLifecycle()", lifecycleStart);
    const lifecycle = source.slice(lifecycleStart, lifecycleEnd);

    expect(lifecycle).toContain("this.worldSpatialProjection.subscribeArmies");
    expect(lifecycle).toContain("this.syncProjectedArmyPathfinding(changes)");
    expect(lifecycle).toContain("this.handleProjectedArmyChanges(changes)");
  });

  it("does not keep desktop TileOpt army subscriptions or removal timestamps", () => {
    const source = readWorldmap();

    expect(source).not.toContain("this.worldUpdateListener.Army.onTileUpdate");
    expect(source).not.toContain("this.worldUpdateListener.Army.onExplorerTroopsUpdate");
    expect(source).not.toContain("armyLastProjectionSyncAt");
    expect(source).not.toContain("scheduleArmyRemoval");
  });

  it("deletes the shared TileOpt army listener and death heuristic", () => {
    const source = readWorldUpdateListener();

    expect(source).not.toContain("public get Army()");
    expect(source).not.toContain("Army.onDeadArmy");
    expect(source).not.toContain('processSequentialUpdate("army-tile"');
  });
});
