// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("network status wiring", () => {
  it("mounts NetworkStatusPill in the secondary menu and passes the forceReconnect helper", () => {
    const source = readSource("src/ui/features/world/containers/secondary-menu-items.tsx");

    expect(source).toContain("NetworkStatusPill");
    expect(source).toContain("triggerConnectionForceReconnect");
    expect(source).not.toContain('title={connectionStatus === "degraded"');
  });

  it("mounts NetworkStatusBanner with the same reconnect helper", () => {
    const source = readSource("src/ui/layouts/world.tsx");

    expect(source).toContain("NetworkStatusBanner");
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
