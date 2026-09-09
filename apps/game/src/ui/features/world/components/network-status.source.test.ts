// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("network status wiring", () => {
  it("keeps the header to identity, view, clock, attention and settings", () => {
    const source = readSource("src/ui/features/world/containers/secondary-menu-items.tsx");

    expect(source).not.toContain("NetworkStatusPill");
    expect(source).not.toContain("transactions-selector");
    expect(existsSync("src/ui/features/world/components/network-status-pill.tsx")).toBe(false);
    expect(existsSync("src/ui/features/world/components/network-status-banner.tsx")).toBe(false);
    expect(readSource("src/ui/layouts/world.tsx")).not.toContain("NetworkStatusBanner");
  });

  it("reports connection state in the quick feed with the same reconnect helper", () => {
    const source = readSource("src/ui/features/event-feed/quick-feed.tsx");

    expect(source).toContain("useConnectionStore.subscribe");
    expect(source).toContain('toast.success("Back online"');
    expect(source).toContain('toast.warning("Reconnecting…"');
    expect(source).toContain("triggerConnectionForceReconnect");
  });

  it("routes retry through the active game sync recovery session", () => {
    const retrySource = readSource("src/ui/features/world/components/network-status-retry.ts");
    const worldmapSource = readSource("src/three/scenes/worldmap.tsx");

    expect(retrySource).toContain("await recoverGameSyncSession()");
    expect(retrySource).not.toContain("connection-health-monitor");
    expect(worldmapSource).not.toContain("forceResubscribe()");
    expect(worldmapSource).not.toContain("toriiStreamManager");
  });
});
