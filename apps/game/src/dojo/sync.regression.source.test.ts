// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("network boot-regression guards", () => {
  it("sync.ts resets the global handshake clock after a successful subscription handshake", () => {
    const source = readSource("src/dojo/sync.ts");

    expect(source).toMatch(/const recordGamewideSubscriptionActive[\s\S]*?recordGlobalHandshake\(\)/);
    expect(source).toContain("startSession");
  });

  it("the session runtime owns the bootstrap cancellation guard", () => {
    const source = readSource("src/dojo/sync.ts");
    const runtimeSource = readSource("../../packages/core/src/sync/game-sync-runtime.ts");

    expect(source).toContain("getActiveGameSyncRuntime()?.cancelGlobalWriter()");
    expect(runtimeSource).toMatch(/cancelGlobalWriter\(\)[\s\S]*?if \(this\.isStarting\(\)\)/);
  });

  it("has no legacy spatial bootstrap ownership path", () => {
    const source = readSource("src/dojo/sync.ts");
    const manifestSource = readSource("../../packages/core/src/sync/model-manifest.ts");

    expect(manifestSource).toContain('spatial("Structure", "base.coord_x", "base.coord_y")');
    expect(manifestSource).not.toContain("spatial-bootstrap");
    expect(source).not.toContain("syncGlobalSpatialBootstrapSnapshot");
    expect(source).not.toContain("startLegacySession");
  });

  it("the active path owns every current fact with one game-wide recovery session", () => {
    const source = readSource("src/dojo/sync.ts");

    expect(source).toContain('getGameSyncModelsForChannel("gamewide-entity"');
    expect(source).toContain("createGamewideSyncSession");
    expect(source).toContain("requireActiveGameSyncRuntime().recover()");
    expect(source).not.toContain("LegacyBounded");
    expect(source).toContain("installActiveWorldSpatialProjection(setup)");
  });

  it("routes stream failures through the connection recovery owner", () => {
    const source = readSource("src/dojo/sync.ts");

    expect(source).toContain("requestConnectionRecovery");
    expect(source).toContain("onStreamClose: (stream, reason)");
    expect(source).toContain('kind: "stream_close"');
    expect(source).not.toContain("onEventStreamLost");
    expect(source).not.toContain("onEventStreamRestored");
  });

  it("connection-health-monitor exposes the boot grace gate", () => {
    const source = readSource("src/dojo/connection-health-monitor.ts");

    expect(source).toContain("hasObservedHealthyStreams");
    expect(source).toContain("startedAtMs");
    expect(source).toContain("exitBootGraceForTests");
  });
});
