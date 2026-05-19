import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("worldmap Torii bounds debug overlay wiring", () => {
  it("imports and controls the Torii bounds debug overlay behind its env flag", () => {
    const source = readWorldmapSource();

    expect(source).toContain("upsertToriiBoundsDebugOverlay");
    expect(source).toContain("removeToriiBoundsDebugOverlay");
    expect(source).toContain("VITE_PUBLIC_TORII_BOUNDS_DEBUG_OVERLAY");
  });

  it("keeps the console snapshot hook available when the overlay flag is enabled outside dev", () => {
    const source = readWorldmapSource();

    expect(source).toContain("private installToriiBoundsDebugHook");
    expect(source).toContain("!import.meta.env.DEV && !TORII_BOUNDS_DEBUG_OVERLAY");
    expect(source).toContain("debugWindow.getToriiBoundsDebugSnapshot = () => this.getToriiBoundsDebugSnapshot()");
  });

  it("updates the overlay when global spatial sync marks bounds locally ready", () => {
    const source = readWorldmapSource();
    const methodStart = source.indexOf("private async updateToriiBoundsSubscription");
    expect(methodStart).toBeGreaterThan(0);
    const methodEnd = source.indexOf("\n  private addWorldUpdateSubscription", methodStart);
    const body = source.slice(methodStart, methodEnd);

    expect(body).toContain("this.refreshToriiBoundsDebugOverlay");
    expect(body).toContain("const requestedAreaKey = this.getToriiSubscriptionAreaKeyForChunk(chunkKey)");
    expect(body).toContain("requestedAreaKey,");
    expect(body).toContain("subscribedAreaKey: requestedAreaKey");
    expect(body).toContain('lastOutcome: "global_spatial_sync"');
    expect(body).toContain("subscriptionBounds");
  });
});
