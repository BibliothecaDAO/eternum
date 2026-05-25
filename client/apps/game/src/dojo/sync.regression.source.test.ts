// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("network boot-regression guards", () => {
  it("sync.ts resets the global handshake clock after a successful subscription handshake", () => {
    const source = readSource("src/dojo/sync.ts");

    expect(source).toContain("isInitialSyncInFlight");
    // Reset happens after successful await, before the try{}'s catch branch.
    expect(source).toMatch(/entityStreamSubscription = await syncEntitiesDebounced[\s\S]*?recordGlobalHandshake\(\)/);
  });

  it("sync.ts cancelEntityStreamSubscription no-ops while initial sync is in flight", () => {
    const source = readSource("src/dojo/sync.ts");

    expect(source).toMatch(/cancelEntityStreamSubscription[\s\S]*?if \(isInitialSyncInFlight\) return/);
  });

  it("sync.ts keeps Structure owners out of the global spatial bootstrap snapshot", () => {
    const source = readSource("src/dojo/sync.ts");
    const spatialModelsSource = readSource("src/dojo/torii-spatial-models.ts");

    expect(spatialModelsSource).toContain('GLOBAL_SPATIAL_OWNER_MODEL_NAME = "s1_eternum-Structure"');
    expect(spatialModelsSource).toContain("model !== GLOBAL_SPATIAL_OWNER_MODEL_NAME");
    expect(source).toContain("syncGlobalSpatialBootstrapSnapshot");
    expect(source).not.toContain("spatialMapStreamSubscription");
    expect(source).toContain("recordSpatialHandshake()");
  });

  it("connection-health-monitor exposes the boot grace gate", () => {
    const source = readSource("src/dojo/connection-health-monitor.ts");

    expect(source).toContain("hasObservedHealthyStreams");
    expect(source).toContain("startedAtMs");
    expect(source).toContain("exitBootGraceForTests");
  });
});
