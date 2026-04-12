// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");
const readRepoSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), "..", "..", "..", relativePath), "utf8");

describe("Worldmap movement latency tracing wiring", () => {
  it("records tx, visual movement, and completion phases from worldmap", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain('"move_requested"');
    expect(source).toContain('"tx_response_received"');
    expect(source).toContain('"tx_confirmed"');
    expect(source).toContain('"movement_started"');
    expect(source).toContain('"movement_completed"');
  });

  it("uses an authoritative world-sync timeout longer than the old 10 second stale cutoff", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("authoritativePendingArmyMovementMs = 30_000");
  });

  it("records raw TileOpt stream delivery from the torii sync layer", () => {
    const source = readSource("src/dojo/sync.ts");

    expect(source).toContain('"tileopt_stream_received"');
  });

  it("records TileOpt processing phases in the world update listener", () => {
    const source = readRepoSource("packages/core/src/systems/world-update-listener.ts");

    expect(source).toContain('"tileopt_component_received"');
    expect(source).toContain('"tileopt_component_ready"');
  });

  it("exposes debug hooks for reading and clearing movement latency traces", () => {
    const source = readSource("src/three/scenes/worldmap-debug-hooks.ts");

    expect(source).toContain("getArmyMovementLatencyTrace");
    expect(source).toContain("clearArmyMovementLatencyTrace");
  });
});
