// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("network boot-regression guards", () => {
  it("sync.ts resets the global handshake clock after a successful subscription handshake", () => {
    const source = readSource("src/dojo/sync.ts");

    expect(source).toMatch(/const subscription = await syncEntitiesDebounced[\s\S]*?recordGlobalHandshake\(\)/);
    expect(source).toContain("startSession");
  });

  it("the session runtime owns the bootstrap cancellation guard", () => {
    const source = readSource("src/dojo/sync.ts");
    const runtimeSource = readSource("../../../packages/core/src/sync/game-sync-runtime.ts");

    expect(source).toContain("getActiveGameSyncRuntime()?.cancelGlobalWriter()");
    expect(runtimeSource).toMatch(/cancelGlobalWriter\(\)[\s\S]*?if \(this\.isStarting\(\)\)/);
  });

  it("sync.ts keeps Structure owners out of the global spatial bootstrap snapshot", () => {
    const source = readSource("src/dojo/sync.ts");
    const spatialModelsSource = readSource("src/dojo/torii-spatial-models.ts");
    const manifestSource = readSource("../../../packages/core/src/sync/model-manifest.ts");

    expect(spatialModelsSource).toContain('getGameSyncModelsForChannel("spatial-bootstrap")');
    expect(manifestSource).toContain('spatial("Structure", "base.coord_x", "base.coord_y", { bootstrap: false');
    expect(source).toContain("syncGlobalSpatialBootstrapSnapshot");
    expect(source).not.toContain("spatialMapStreamSubscription");
    expect(source).toContain("recordSpatialHandshake()");
  });

  it("the active path owns every current fact with one game-wide recovery session", () => {
    const source = readSource("src/dojo/sync.ts");

    expect(source).toContain('getGameSyncModelsForChannel("gamewide-entity"');
    expect(source).toContain("createGamewideSyncSession");
    expect(source).toContain("await runtime.recover()");
    expect(source).toContain("shouldUseLegacyBoundedSpatialSync()");
  });

  it("connection-health-monitor exposes the boot grace gate", () => {
    const source = readSource("src/dojo/connection-health-monitor.ts");

    expect(source).toContain("hasObservedHealthyStreams");
    expect(source).toContain("startedAtMs");
    expect(source).toContain("exitBootGraceForTests");
  });
});
