// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("global spatial setup-timeout wiring", () => {
  it("routes global spatial snapshot timeout reporting through initial sync", () => {
    const source = readSource("src/dojo/sync.ts");
    const start = source.indexOf("async function hydrateGlobalSpatialMapSnapshot");
    const end = source.indexOf("async function subscribeGlobalSpatialMapStream", start);
    expect(start).toBeGreaterThan(-1);
    const methodSource = source.slice(start, end);

    expect(methodSource).toContain('label: "global spatial map snapshot"');
    expect(methodSource).toContain("onTimeout: input.onTimeout");
    expect(methodSource).toContain("recordGameEntryDuration");
  });

  it("routes global spatial subscription setup timeout reporting through initial sync", () => {
    const source = readSource("src/dojo/sync.ts");
    const start = source.indexOf("async function subscribeGlobalSpatialMapStream");
    const end = source.indexOf("async function syncGlobalSpatialMapStream", start);
    expect(start).toBeGreaterThan(-1);
    const methodSource = source.slice(start, end);

    expect(methodSource).toContain('streamType: "spatial"');
    expect(methodSource).toContain("onSubscriptionSetupTimeout: input.onSubscriptionSetupTimeout");
    expect(methodSource).toContain("readyOnSubscriptionsReady: true");
  });

  it("keeps worldmap free of the removed per-bounds timeout toast path", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).not.toContain("handleToriiSubscriptionSetupTimeout");
    expect(source).not.toContain("SETUP_TIMEOUT_TOAST_THROTTLE_MS");
    expect(source).not.toContain('toast("Map sync delayed"');
  });
});
