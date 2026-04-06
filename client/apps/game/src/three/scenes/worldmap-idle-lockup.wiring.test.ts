import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function readQueriesSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "../../dojo/queries.ts"), "utf8");
}

describe("worldmap idle lockup stabilization wiring", () => {
  it("routes same-chunk refreshes through a dedicated background lane", () => {
    const source = readWorldmapSource();
    const branchStart = source.indexOf('if (chunkDecision.action === "refresh_current_chunk")');
    const branchEnd = source.indexOf("\n\n      return false;", branchStart);
    const branchSource = source.slice(branchStart, branchEnd);

    expect(source).toContain("currentChunkRefreshPromise");
    expect(branchSource).toMatch(/startBackgroundCurrentChunkRefresh\(/);
    expect(branchSource).not.toMatch(/isChunkTransitioning\s*=\s*true/);
    expect(branchSource).not.toMatch(/globalChunkSwitchPromise\s*=/);
  });

  it("blocks army selection only for blocking chunk-switch authority", () => {
    const source = readWorldmapSource();
    const methodStart = source.indexOf("  private onArmySelection(");
    const methodEnd = source.indexOf("\n  private queueArmySelectionRecovery(", methodStart);
    const methodSource = source.slice(methodStart, methodEnd);

    expect(methodSource).toMatch(/hasBlockingChunkSwitchInFlight\(\)/);
    expect(methodSource).not.toMatch(/if\s*\(this\.isChunkTransitioning\)/);
  });

  it("exposes chunk-work debug snapshots and query timeout wiring", () => {
    const worldmapSource = readWorldmapSource();
    const queriesSource = readQueriesSource();

    expect(worldmapSource).toContain("getWorldmapChunkWorkSnapshot");
    expect(worldmapSource).toContain("currentChunkRefreshReason");
    expect(worldmapSource).toContain("currentChunkRefreshTargetChunk");
    expect(worldmapSource).toContain("createToriiTimedQuery");
    expect(queriesSource).toContain("createToriiTimedQuery");
  });
});
