// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineContractComponents } from "@bibliothecadao/types";
import { createWorld, type Entity, getComponentValue } from "@dojoengine/recs";
import { describe, expect, it } from "vitest";

import { createRecsGameSyncStore } from "./recs-game-sync-store";

interface ParityFixture {
  capturedFrom: string;
  deviationsFromLegacy: string;
  entities: Array<{ hashed_keys: string; models: Record<string, unknown> }>;
  partials: Array<{ hashed_keys: string; models: Record<string, unknown> }>;
  expected: Record<string, unknown>;
}

const reviveBigInt = (_key: string, value: unknown): unknown =>
  typeof value === "object" && value !== null && "$bigint" in value
    ? BigInt((value as { $bigint: string }).$bigint)
    : value;

// 50 real herald rows across 20 models captured from game 11 (lab-mthy45g3); `expected` is what the
// legacy `@dojoengine/state` path wrote into RECS for them, minus the NumberArray envelope bug the
// fixture header names. Any coercion change shows up here before it reaches a player.
const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/sync/recs-game-sync-store.parity.json"), "utf8"),
  reviveBigInt,
) as ParityFixture;

describe("Herald RECS adapter parity", () => {
  it("writes the captured 96-player rows exactly as the legacy path did", () => {
    const world = createWorld();
    const components = defineContractComponents(world, "s2");
    const models = [...new Set(fixture.entities.flatMap((entity) => Object.keys(entity.models)))];
    const store = createRecsGameSyncStore({ network: { contractComponents: components, world } } as never, models);

    store.applyEntityOperations([{ type: "upsert", entities: fixture.entities }]);
    store.applyEntityOperations([{ type: "upsert", entities: fixture.partials }]);

    for (const [rowId, expected] of Object.entries(fixture.expected)) {
      const [model, key] = rowId.split(":") as [string, string];
      const component = (components as unknown as Record<string, never>)[model];
      expect(getComponentValue(component, key as Entity), rowId).toEqual(expected);
    }
    expect(Object.keys(fixture.expected)).toHaveLength(50);
  });

  it("preserves tuple spans instead of coercing each tuple to NaN", () => {
    const world = createWorld();
    const components = defineContractComponents(world, "s2");
    const store = createRecsGameSyncStore({ network: { contractComponents: components, world } } as never, [
      "HyperstructureShareholders",
    ]);
    const shareholders = [["0xa", "0x1388"], { value: [{ value: "0xb" }, { value: 2_500 }] }];

    store.applyEntityOperations([
      {
        type: "upsert",
        entities: [
          {
            hashed_keys: "shareholder-row",
            models: {
              HyperstructureShareholders: {
                game_id: "0x7",
                hyperstructure_id: "0x2a",
                start_at: "0x64",
                shareholders,
              },
            },
          },
        ],
      },
    ]);

    expect(getComponentValue(components.HyperstructureShareholders, "shareholder-row" as Entity)).toEqual({
      game_id: 7,
      hyperstructure_id: 42,
      start_at: 100,
      shareholders,
    });
  });
});
