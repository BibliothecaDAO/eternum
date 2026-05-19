// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("global spatial setup-timeout wiring", () => {
  it("routes global spatial bootstrap snapshot timeout reporting through initial sync", () => {
    const source = readSource("src/dojo/sync.ts");
    const start = source.indexOf("async function hydrateGlobalSpatialBootstrapSnapshot");
    const end = source.indexOf("async function syncGlobalSpatialBootstrapSnapshot", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const methodSource = source.slice(start, end);

    expect(methodSource).toContain('label: "global spatial map bootstrap snapshot"');
    expect(methodSource).toContain("onTimeout: input.onTimeout");
    expect(methodSource).toContain("recordGameEntryDuration");
  });

  it("keeps live global spatial updates owned by the all-entity stream", () => {
    const source = readSource("src/dojo/sync.ts");
    const start = source.indexOf("async function syncGlobalSpatialBootstrapSnapshot");
    const end = source.indexOf("// initial sync runs before the game is playable", start);
    expect(start).toBeGreaterThan(-1);
    const methodSource = source.slice(start, end);

    expect(source).not.toContain("async function subscribeGlobalSpatialMapStream");
    expect(methodSource).toContain("hydrateGlobalSpatialBootstrapSnapshot");
    expect(methodSource).not.toContain("syncEntitiesDebounced");
  });

  it("keeps worldmap free of the removed per-bounds timeout toast path", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).not.toContain("handleToriiSubscriptionSetupTimeout");
    expect(source).not.toContain("SETUP_TIMEOUT_TOAST_THROTTLE_MS");
    expect(source).not.toContain('toast("Map sync delayed"');
  });
});
