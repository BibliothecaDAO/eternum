// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const readSource = (relativePath: string) => readFileSync(resolve(currentDir, relativePath), "utf8");
const readRepoSource = (relativePath: string) =>
  readFileSync(resolve(currentDir, "..", "..", "..", "..", "..", "..", relativePath), "utf8");

describe("Worldmap movement latency tracing wiring", () => {
  it("records tx, visual movement, and completion phases from worldmap", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toContain('"move_requested"');
    expect(source).toContain('"explore_intent_queued"');
    expect(source).toContain('"explore_submit_started"');
    expect(source).toContain('"explore_tx_hash_received"');
    expect(source).toContain('"tx_response_received"');
    expect(source).toContain('"tx_confirmed"');
    expect(source).toContain('"movement_started"');
    expect(source).toContain('"movement_completed"');
  });

  it("uses an authoritative world-sync timeout longer than the old 10 second stale cutoff", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toContain("authoritativePendingArmyMovementMs = 30_000");
  });

  it("records raw TileOpt stream delivery from the torii sync layer", () => {
    const source = readRepoSource("client/apps/game/src/dojo/sync.ts");

    expect(source).toContain('"tileopt_stream_received"');
  });

  it("records TileOpt processing phases in the world update listener", () => {
    const source = readRepoSource("packages/core/src/systems/world-update-listener.ts");

    expect(source).toContain('"tileopt_component_received"');
    expect(source).toContain('"tileopt_component_ready"');
  });

  it("records explore reconcile and next-safe-unblocked phases when authoritative position catches up", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toContain('"explore_authoritative_reconcile_complete"');
    expect(source).toContain('"explore_next_safe_unblocked"');
  });

  it("gates explore-only reconcile tracing behind an explicit explore flag", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toContain("isExploreAction");
    expect(source).toContain("if (isExploreAction)");
  });

  it("exposes debug hooks for reading and clearing movement latency traces", () => {
    const source = readSource("worldmap-debug-hooks.ts");

    expect(source).toContain("getArmyMovementLatencyTrace");
    expect(source).toContain("clearArmyMovementLatencyTrace");
  });
});
