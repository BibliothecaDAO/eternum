// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("game sync setup-timeout wiring", () => {
  it("passes the setup timeout into the one game-wide session", () => {
    const source = readSource("src/dojo/sync.ts");

    expect(source).toContain("createActiveGamewideSyncSession");
    expect(source).toContain("subscriptionSetupTimeoutMs: input.subscriptionSetupTimeoutMs");
    expect(source).not.toContain("GlobalSpatialBootstrap");
  });

  it("applies the timeout to each paginated recovery snapshot", () => {
    const source = readSource("src/dojo/gamewide-sync-adapter.ts");

    expect(source).toContain('"game-wide snapshot page"');
    expect(source).toContain("input.onSubscriptionSetupTimeout");
    expect(source).toContain("GAMEWIDE_SNAPSHOT_PAGE_SIZE");
  });

  it("keeps worldmap free of the removed per-bounds timeout toast path", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).not.toContain("handleToriiSubscriptionSetupTimeout");
    expect(source).not.toContain("SETUP_TIMEOUT_TOAST_THROTTLE_MS");
    expect(source).not.toContain('toast("Map sync delayed"');
  });
});
