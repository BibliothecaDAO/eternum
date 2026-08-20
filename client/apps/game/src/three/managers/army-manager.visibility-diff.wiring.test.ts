import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readArmyManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "army-manager.ts"), "utf8");
}

describe("army manager visibility diff wiring", () => {
  it("preserves explicit refresh ownership through the coalesced render queue", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/private pendingRenderOptions: ManagerChunkUpdateOptions \| null/);
    expect(source).toMatch(/private renderVisibleArmies\(chunkKey: string, options\?: ManagerChunkUpdateOptions\)/);
    expect(source).toMatch(
      /this\.reconcileVisibleArmies\(sortedVisibleArmies, modelTypesByEntity, options\?\.refreshExisting\)/,
    );
  });

  it("hydrates and preloads only projected IDs outside existing visible ownership", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/const currentVisibleIds = new Set\(this\.visibleArmyOrder\)/);
    expect(source).toMatch(/\.filter\(\s*\(\{ entityId \}\) => !currentVisibleIds\.has\(entityId\)/);
    expect(source).toMatch(/preloadMissingProjectedArmyModels\(enteringRenderables\)/);
  });

  it("keeps projection-triggered deferred work behind winning transition ownership", () => {
    const source = readArmyManagerSource();
    const transitionFinally = source.slice(
      source.indexOf("} finally {", source.indexOf("private async executeRenderForChunk")),
      source.indexOf('recordWorldmapRenderDuration("executeRenderForChunk"'),
    );

    expect(transitionFinally).toMatch(/finalizeArmyChunkTransition\(\{/);
    expect(transitionFinally).toMatch(/isWinningTransition: shouldRunManagerChunkUpdate\(\{/);
    expect(transitionFinally).toMatch(/drainDeferredQueue: \(\) => this\.drainDeferredArmyQueue\(\)/);
  });
});
