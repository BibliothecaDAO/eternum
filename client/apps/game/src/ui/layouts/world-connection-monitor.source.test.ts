// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/ui/layouts/world.tsx"), "utf8");

describe("ConnectionMonitor heartbeat lifecycle wiring", () => {
  it("uses createToriiHeartbeatLifecycle for the heartbeat subscription", () => {
    expect(source).toContain("createToriiHeartbeatLifecycle");
  });

  it("does not retain the ad-hoc heartbeatSubscription closure pattern", () => {
    expect(source).not.toContain("let heartbeatSubscription:");
  });

  it("reopens the heartbeat in onReconnectComplete", () => {
    const start = source.indexOf("onReconnectComplete");
    const end = source.indexOf("healthCheckFn", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const reconnectComplete = source.slice(start, end);
    expect(reconnectComplete).toMatch(/heartbeat[A-Za-z]*\.reopen\(\)/);
  });

  it("disposes the heartbeat lifecycle on cleanup", () => {
    expect(source).toMatch(/heartbeat[A-Za-z]*\.dispose\(\)/);
  });

  it("requests route-level rebootstrap instead of running in-place dead-end bootstrap", () => {
    expect(source).toContain("requestGameRebootstrap");
    expect(source).not.toContain("runDeadEndRecovery");
    expect(source).not.toContain("recordStreamReconnect");
  });

  it("keeps dead-end recovery inside the monitor onDeadEnd callback", () => {
    const start = source.indexOf("onDeadEnd");
    const end = source.indexOf("});", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);
    expect(block).toContain("shouldRunDeadEndRecovery");
    expect(block).toContain("requestGameRebootstrap");
  });

  it("resolves the torii client lazily for normal heartbeat reopen", () => {
    expect(source).not.toMatch(/subscribe:\s*\(\)\s*=>\s*subscribeToToriiHeartbeat\(setup\.network\.toriiClient\)/);
    expect(source).toContain("setupRef");
  });
});
