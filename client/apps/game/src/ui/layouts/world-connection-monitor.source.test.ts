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

  it("uses runDeadEndRecovery and records a stream reconnect on success", () => {
    expect(source).toContain("runDeadEndRecovery");
    expect(source).toContain("recordStreamReconnect");
  });

  it("reopens the heartbeat as part of the dead-end recovery success path", () => {
    const start = source.indexOf("triggerDeadEndRecovery");
    const end = source.indexOf("const monitor = new ConnectionHealthMonitor", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);
    expect(block).toMatch(/heartbeat[A-Za-z]*\.reopenWith\(\(\) =>/);
    expect(block).toContain("result.setupResult.network.toriiClient");
  });

  it("resolves the torii client lazily so it picks up the post-dead-end-recovery client", () => {
    expect(source).not.toMatch(/subscribe:\s*\(\)\s*=>\s*subscribeToToriiHeartbeat\(setup\.network\.toriiClient\)/);
    expect(source).toContain("setupRef");
  });
});
