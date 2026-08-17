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

  it("mounts NetworkStatusBanner and wires onRecovery toast in the world layout", () => {
    const source = readSource("src/ui/layouts/world.tsx");

    expect(source).toContain("NetworkStatusBanner");
    expect(source).toContain("triggerConnectionForceReconnect");
    expect(source).toContain("onRecovery:");
    expect(source).toContain('toast.success("Back online"');
  });

  it("lets the active worldmap clear stuck map loading when stream reconnect fails", () => {
    const source = readSource("src/ui/layouts/world.tsx");

    expect(source).toContain("recoverAfterConnectionFailure");
    expect(source).toMatch(/getActiveWorldmapRecoveryHandle\(\)\?\.recoverAfterConnectionFailure\(\)/);
  });

  it("exposes a module-level getConnectionHealthMonitor for UI retry callbacks", () => {
    const source = readSource("src/dojo/connection-health-monitor.ts");

    expect(source).toContain("export const getConnectionHealthMonitor");
    expect(source).toContain("forceReconnect");
    expect(source).toContain('setSpatialStatus("reconnecting")');
    expect(source).toContain('setGlobalStatus("reconnecting")');
  });

  it("routes reconnect through the one game sync recovery session", () => {
    const worldSource = readSource("src/ui/layouts/world.tsx");
    const worldmapSource = readSource("src/three/scenes/worldmap.tsx");

    expect(worldSource).toContain("await recoverGameSyncSession()");
    expect(worldSource).toContain("await initialSync(setup, state");
    expect(worldmapSource).not.toContain("forceResubscribe()");
    expect(worldmapSource).not.toContain("toriiStreamManager");
    expect(worldmapSource).not.toContain("SETUP_TIMEOUT_TOAST_THROTTLE_MS");
    expect(worldmapSource).not.toContain("handleToriiSubscriptionSetupTimeout");
  });
});
