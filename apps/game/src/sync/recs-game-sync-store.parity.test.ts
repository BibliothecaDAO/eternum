// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineContractComponents } from "@bibliothecadao/types";
import { createWorld, type Entity, getComponentValue } from "@dojoengine/recs";
import { describe, expect, it } from "vitest";

import { createRecsGameSyncStore } from "./recs-game-sync-store";

interface ParityFixture {
  capturedFrom: string;
  entities: Array<{ hashed_keys: string; models: Record<string, unknown> }>;
  partials: Array<{ hashed_keys: string; models: Record<string, unknown> }>;
}

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/sync/recs-game-sync-store.parity.json"), "utf8"),
) as ParityFixture;

const componentValue = (
  components: ReturnType<typeof defineContractComponents>,
  model: string,
  entity: string,
): unknown => {
  const component = (components as unknown as Record<string, never>)[model];
  return getComponentValue(component, entity as Entity);
};

describe("Herald RECS adapter parity", () => {
  it("ingests every captured game row under the generated Cairo schemas", () => {
    const world = createWorld();
    const components = defineContractComponents(world, "s2");
    const models = [...new Set(fixture.entities.flatMap((entity) => Object.keys(entity.models)))];
    const store = createRecsGameSyncStore({ network: { contractComponents: components, world } } as never, models);

    store.applyEntityOperations([{ type: "upsert", entities: fixture.entities }]);
    store.applyEntityOperations([{ type: "upsert", entities: fixture.partials }]);

    for (const entity of fixture.entities) {
      for (const model of Object.keys(entity.models)) {
        expect(componentValue(components, model, entity.hashed_keys), `${model}:${entity.hashed_keys}`).toBeDefined();
      }
    }

    expect(
      componentValue(
        components,
        "ResourceFactoryConfig",
        "0xcc5b34e43b115030972ea35845b393d74c5a6b7d4f02d5296cec4f4395e5",
      ),
    ).toMatchObject({
      realm_output_per_second: 10_000_000_000n,
      village_output_per_second: 5_000_000_000n,
    });
    const questLevels = componentValue(
      components,
      "QuestLevels",
      "0x5216c2d1da6ad4895d9aa9db47cbed96fab1933a841d16f127c30c4a82837c1",
    ) as { game_address: bigint; levels: unknown[] };
    expect(questLevels.game_address).toBe(0x1e1c477f2ef896fd638b50caa31e3aa8f504d5c6cb3c09c99cd0b72523f07f7n);
    expect(questLevels.levels[0]).toEqual({
      target_score: "0x1a",
      settings_id: "0x3",
      time_limit: "0x15180",
    });
  });

  it("normalizes live tuple records once while ingesting entity rows", () => {
    const world = createWorld();
    const components = defineContractComponents(world, "s2");
    const models = [
      "HyperstructureShareholders",
      "LedgerRegistration",
      "QuestTile",
      "ResourceArrival",
      "StructureVillageSlots",
      "TileOpt",
      "VillageTroop",
    ];
    const store = createRecsGameSyncStore({ network: { contractComponents: components, world } } as never, models);
    const shareholderAddress = "0x615b21968063e60e2e8099da659e2d3ef9257c61356142b67a972978ddffc0f";
    const emptyArrivalSlots = Object.fromEntries(Array.from({ length: 48 }, (_, index) => [`slot_${index + 1}`, []]));

    store.applyEntityOperations([
      {
        type: "upsert",
        entities: [
          {
            hashed_keys: "shareholder-row",
            models: {
              HyperstructureShareholders: {
                game_id: "0x15",
                hyperstructure_id: "0x234f6",
                start_at: "0x6a99ea7d",
                shareholders: [{ 0: shareholderAddress, 1: "0x2710" }],
              },
            },
          },
          {
            hashed_keys: "ledger-row",
            models: {
              LedgerRegistration: {
                game_id: "0x15",
                owner: shareholderAddress,
                realm_id: "0x234f6",
                metadata: { 0: "0x1", 1: "0x2", 2: "0x3" },
                pass_kind: "0x1",
                registered: true,
              },
            },
          },
          {
            hashed_keys: "arrival-row",
            models: {
              ResourceArrival: {
                game_id: "0x15",
                structure_id: "0x234e6",
                day: "0x32896",
                ...emptyArrivalSlots,
                slot_46: [
                  { 0: "0x17", 1: "0x1955bafc200" },
                  { 0: "0x19", 1: "0x2e90edd000" },
                ],
                initialized: true,
                total_amount: "0x39a3dff7a00",
              },
            },
          },
          {
            hashed_keys: "quest-row",
            models: {
              QuestTile: {
                game_id: "0x15",
                id: "0x1",
                game_address: shareholderAddress,
                coord: { alt: false, x: "0x64ae2774", y: "0x64ae277b" },
                level: "0x2",
                resource_type: "0x17",
                amount: "0x3b9aca00",
                capacity: "0x5",
                participant_count: "0x1",
              },
            },
          },
          {
            hashed_keys: "village-slots-row",
            models: {
              StructureVillageSlots: {
                game_id: "0x15",
                connected_realm_entity_id: "0x234e6",
                connected_realm_id: "0x4",
                connected_realm_coord: { alt: false, x: "0x64ae2774", y: "0x64ae277b" },
                directions_left: ["North", "SouthWest"],
              },
            },
          },
          {
            hashed_keys: "tile-row",
            models: {
              TileOpt: {
                game_id: "0x15",
                alt: false,
                col: "0x64ae2774",
                row: "0x64ae277b",
                data: "0x2c95c4ee8c95c4ef61e0000000000",
              },
            },
          },
          {
            hashed_keys: "village-troop-row",
            models: { VillageTroop: { game_id: "0x15", village_id: "0x234e6", claimed: true } },
          },
        ],
      },
    ]);

    expect(componentValue(components, "HyperstructureShareholders", "shareholder-row")).toEqual({
      game_id: 21,
      hyperstructure_id: 144_630,
      start_at: 1_788_471_933n,
      shareholders: [[shareholderAddress, "0x2710"]],
    });
    expect(componentValue(components, "LedgerRegistration", "ledger-row")).toMatchObject({
      owner: BigInt(shareholderAddress),
      metadata: ["0x1", "0x2", "0x3"],
    });
    expect(store.listModelEntityIds("ResourceArrival")).toContain("arrival-row");
    expect(componentValue(components, "ResourceArrival", "arrival-row")).toMatchObject({
      day: 206_998n,
      slot_46: [
        ["0x17", "0x1955bafc200"],
        ["0x19", "0x2e90edd000"],
      ],
    });
    expect(componentValue(components, "QuestTile", "quest-row")).toMatchObject({
      game_address: BigInt(shareholderAddress),
      coord: { alt: false, x: 1_689_134_964, y: 1_689_134_971 },
    });
    expect(componentValue(components, "StructureVillageSlots", "village-slots-row")).toMatchObject({
      directions_left: ["North", "SouthWest"],
    });
    expect(componentValue(components, "TileOpt", "tile-row")).toMatchObject({
      data: 0x2c95c4ee8c95c4ef61e0000000000n,
    });
    expect(componentValue(components, "VillageTroop", "village-troop-row")).toEqual({
      game_id: 21,
      village_id: 144_614,
      claimed: true,
    });
  });

  it("emits normalized tuple spans for ephemeral events", () => {
    const world = createWorld();
    const components = defineContractComponents(world, "s2");
    const eventModels = ["BattleEvent", "ExplicitResourceBurn", "StoryEvent", "Transfer"] as const;
    const store = createRecsGameSyncStore({ network: { contractComponents: components, world } } as never, eventModels);
    const eventComponents = components.events as unknown as Record<
      string,
      { update$: { subscribe: (callback: (update: { value: [unknown] }) => void) => { unsubscribe: () => void } } }
    >;
    const observed = new Map<string, Record<string, unknown>>();
    const subscriptions = eventModels.map((model) =>
      eventComponents[model].update$.subscribe((update) => {
        const [current] = update.value;
        if (current) observed.set(model, current as unknown as Record<string, unknown>);
      }),
    );

    try {
      store.applyEvent({
        hashed_keys: "battle-event",
        models: {
          BattleEvent: {
            game_id: "0x15",
            attacker_id: "0x1",
            defender_id: "0x2",
            attacker_owner: "0x3",
            defender_owner: "0x4",
            winner_id: "0x1",
            coord: { alt: false, x: "0x5", y: "0x6" },
            max_reward: [{ 0: "0x17", 1: "0x3b9aca00" }],
            timestamp: "0x6a99ea79",
          },
        },
      });
      store.applyEvent({
        hashed_keys: "burn-event",
        models: {
          ExplicitResourceBurn: {
            game_id: "0x15",
            entity_id: "0x1",
            entity_owner_id: "0x2",
            resources: [{ 0: "0x19", 1: "0x77359400" }],
            timestamp: "0x6a99ea79",
          },
        },
      });
      store.applyEvent({
        hashed_keys: "transfer-event",
        models: {
          Transfer: {
            game_id: "0x15",
            recipient_structure_id: "0x1",
            sending_realm_id: "0x2",
            sender_structure_id: "0x3",
            resources: [{ 0: "0x1a", 1: "0xb2d05e00" }],
            timestamp: "0x6a99ea79",
          },
        },
      });
      store.applyEvent({
        hashed_keys: "story-event",
        models: {
          StoryEvent: {
            game_id: "0x15",
            id: "0x23a51",
            owner: "0x615b21968063e60e2e8099da659e2d3ef9257c61356142b67a972978ddffc0f",
            entity_id: "0x23939",
            tx_hash: "0x79575a8463b06dc8784ab281e22da5a493b05d4928ab6008e96ed8d83d2ec97",
            story: {
              ExplorerGuardSwapStory: {
                count: "0xe2e10044600",
                to_guard_slot: "Delta",
                to_structure_id: "0x234f6",
                from_explorer_id: "0x23939",
                to_structure_direction: "NorthWest",
              },
            },
            timestamp: "0x6a99ea79",
          },
        },
      });
    } finally {
      subscriptions.forEach((subscription) => subscription.unsubscribe());
    }

    expect(observed.get("BattleEvent")?.max_reward).toEqual([["0x17", "0x3b9aca00"]]);
    expect(observed.get("ExplicitResourceBurn")?.resources).toEqual([["0x19", "0x77359400"]]);
    expect(observed.get("Transfer")?.resources).toEqual([["0x1a", "0xb2d05e00"]]);
    expect(observed.get("StoryEvent")).toMatchObject({
      owner: 0x615b21968063e60e2e8099da659e2d3ef9257c61356142b67a972978ddffc0fn,
      timestamp: 0x6a99ea79n,
    });
  });
});
