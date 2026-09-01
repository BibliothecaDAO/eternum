import type { GameSyncModelDefinition } from "@bibliothecadao/eternum/game-sync-models";
import { hash } from "starknet";
import { describe, expect, it } from "vitest";

import { createModelRegistry } from "./model-registry";
import type { DecodedWorldEvent, RawWorldEvent, WorldManifest } from "./types";
import { WORLD_EVENT_SELECTORS, decodeWorldEvent } from "./world-event-decoder";
import { WorldFold } from "./world-fold";

const entityDefinition: GameSyncModelDefinition = {
  availability: "all",
  channels: ["gamewide-entity"],
  deletion: "component",
  name: "TestModel",
  recovery: "convergent-snapshot",
  s2Scope: "game",
};

const eventDefinition: GameSyncModelDefinition = {
  availability: "all",
  channels: ["global-event"],
  deletion: "event-ephemeral",
  eventRetention: { dedupeIdentityLimit: 512, replayEffectsOnRecovery: true, retainRecsRows: false },
  name: "TestEvent",
  recovery: "event-deduped",
  s2Scope: "game",
};

const manifest: WorldManifest = {
  abis: [
    {
      type: "struct",
      name: "example::Coord",
      members: [
        { name: "x", type: "core::integer::u32" },
        { name: "y", type: "core::integer::u32" },
      ],
    },
    {
      type: "enum",
      name: "example::Status",
      variants: [
        { name: "Idle", type: "()" },
        { name: "Moving", type: "()" },
      ],
    },
    {
      type: "struct",
      name: "example::TestModel",
      members: [
        { name: "game_id", type: "core::integer::u32" },
        { name: "entity_id", type: "core::integer::u32" },
        { name: "count", type: "core::integer::u64" },
        { name: "active", type: "core::bool" },
        { name: "coord", type: "example::Coord" },
        { name: "status", type: "example::Status" },
      ],
    },
    {
      type: "struct",
      name: "example::TestEvent",
      members: [
        { name: "game_id", type: "core::integer::u32" },
        { name: "amount", type: "core::integer::u32" },
      ],
    },
  ],
  events: [
    {
      members: [
        { key: true, name: "game_id", type: "core::integer::u32" },
        { key: false, name: "amount", type: "core::integer::u32" },
      ],
      selector: "0x202",
      tag: "s2-TestEvent",
    },
  ],
  models: [
    {
      members: [
        { key: true, name: "game_id", type: "core::integer::u32" },
        { key: true, name: "entity_id", type: "core::integer::u32" },
        { key: false, name: "count", type: "core::integer::u64" },
        { key: false, name: "active", type: "core::bool" },
        { key: false, name: "coord", type: "example::Coord" },
        { key: false, name: "status", type: "example::Status" },
      ],
      selector: "0x101",
      tag: "s2-TestModel",
    },
  ],
  world: { address: "0x123" },
};

const rawEvent = (selector: string, model: string, data: string[], extraKeys: string[] = []): RawWorldEvent => ({
  block_number: 12,
  data,
  event_index: 3,
  keys: [selector, model, "0xabc", ...extraKeys],
  transaction_hash: "0x456",
  transaction_index: 2,
});

const decodeRequired = (registry: ReturnType<typeof createModelRegistry>, event: RawWorldEvent) => {
  const decoded = decodeWorldEvent(registry, event);
  if (!decoded) throw new Error("Expected fixture event to decode");
  return decoded;
};

describe("WorldFold", () => {
  const registry = createModelRegistry(manifest, [entityDefinition, eventDefinition]);

  it("folds set, full update, member update, and delete events deterministically", () => {
    const fold = new WorldFold(registry);
    fold.apply(
      decodeRequired(
        registry,
        rawEvent(WORLD_EVENT_SELECTORS.set, "0x101", ["0x2", "0x7", "0x2", "0x5", "0x3", "0x1", "0x4", "0x5", "0x2"]),
      ),
    );
    const otherGame = rawEvent(WORLD_EVENT_SELECTORS.set, "0x101", [
      "0x2",
      "0x8",
      "0x3",
      "0x5",
      "0x4",
      "0x0",
      "0x5",
      "0x6",
      "0x1",
    ]);
    otherGame.keys[2] = "0xdef";
    fold.apply(decodeRequired(registry, otherGame));

    expect(fold.snapshot(7, 12).models).toEqual([
      {
        model: "TestModel",
        rows: [
          {
            key: "0xabc",
            value: {
              active: true,
              coord: { x: "0x4", y: "0x5" },
              count: "0x3",
              entity_id: "0x2",
              game_id: "0x7",
              status: "Moving",
            },
          },
        ],
      },
    ]);
    expect(fold.snapshot(7, 12, ["TestModel"]).models).toHaveLength(1);
    expect(fold.snapshot(8, 12).models[0]?.rows.map(({ key }) => key)).toEqual(["0xdef"]);
    expect(() => fold.snapshot(7, 12, ["Missing"])).toThrow("Unknown snapshot models: Missing");

    fold.apply(
      decodeRequired(
        registry,
        rawEvent(WORLD_EVENT_SELECTORS.updateMember, "0x101", ["0x1", "0x9"], [hash.getSelectorFromName("count")]),
      ),
    );
    expect(fold.snapshot(7, 12).models[0].rows[0].value.count).toBe("0x9");

    fold.apply(
      decodeRequired(
        registry,
        rawEvent(WORLD_EVENT_SELECTORS.update, "0x101", ["0x5", "0xb", "0x0", "0x8", "0x9", "0x1"]),
      ),
    );
    expect(fold.snapshot(7, 12).models[0].rows[0].value).toMatchObject({
      active: false,
      coord: { x: "0x8", y: "0x9" },
      count: "0xb",
      status: "Idle",
    });

    fold.apply(decodeRequired(registry, rawEvent(WORLD_EVENT_SELECTORS.delete, "0x101", [])));
    expect(fold.snapshot(7, 12).models[0].rows).toEqual([]);
  });

  it("decodes event messages without retaining them in the state fold", () => {
    const event = decodeRequired(
      registry,
      rawEvent(WORLD_EVENT_SELECTORS.event, "0x202", ["0x1", "0x7", "0x1", "0xc"]),
    );
    expect(event).toMatchObject({ kind: "event", key: { game_id: 7n }, value: { amount: 12n } });

    const fold = new WorldFold(registry);
    fold.apply(event);
    expect(fold.retainedRowCount()).toBe(0);
  });

  it("folds the latest battle for both participants", () => {
    const fold = new WorldFold(registry);
    const battle: DecodedWorldEvent = {
      entityId: "0xba771e",
      key: { attacker_id: 41n, defender_id: 52n, game_id: 7n },
      kind: "event",
      model: { ...eventDefinition, name: "BattleEvent" },
      position: { blockNumber: 12, eventIndex: 3, transactionHash: "0x456", transactionIndex: 2 },
      value: { timestamp: 99n },
    };

    fold.apply(battle);

    expect(fold.snapshot(7, 12, ["LastBattle"]).models).toEqual([
      {
        model: "LastBattle",
        rows: [
          {
            key: expect.any(String),
            value: {
              entity_id: "0x29",
              game_id: "0x7",
              latest_defender_id: "0x34",
              latest_defense_timestamp: "0x63",
            },
          },
          {
            key: expect.any(String),
            value: {
              entity_id: "0x34",
              game_id: "0x7",
              latest_attacker_id: "0x29",
              latest_attack_timestamp: "0x63",
            },
          },
        ],
      },
    ]);
  });

  it("restores checkpoints and keeps pre-confirmed overlays replaceable", () => {
    const confirmed = new WorldFold(registry);
    confirmed.apply(
      decodeRequired(
        registry,
        rawEvent(WORLD_EVENT_SELECTORS.set, "0x101", ["0x2", "0x7", "0x2", "0x5", "0x3", "0x1", "0x4", "0x5", "0x2"]),
      ),
    );
    const restored = WorldFold.restore(registry, confirmed.checkpoint());
    const overlay = restored.overlay();
    overlay.apply(
      decodeRequired(
        registry,
        rawEvent(WORLD_EVENT_SELECTORS.updateMember, "0x101", ["0x1", "0x9"], [hash.getSelectorFromName("count")]),
      ),
    );

    expect(confirmed.snapshot(7, 12)).toEqual(restored.snapshot(7, 12));
    expect(restored.snapshot(7, 12).models[0].rows[0].value.count).toBe("0x3");
    expect(overlay.snapshot(7, 12).models[0].rows[0].value.count).toBe("0x9");
  });

  it("reads a row through an overlay in the shape a diff set carries", () => {
    const confirmed = new WorldFold(registry);
    const applied = confirmed.apply(
      decodeRequired(
        registry,
        rawEvent(WORLD_EVENT_SELECTORS.set, "0x101", ["0x2", "0x7", "0x2", "0x5", "0x3", "0x1", "0x4", "0x5", "0x2"]),
      ),
    );
    const overlay = confirmed.overlay();

    expect(confirmed.currentRow("TestModel", "0xabc")).toEqual(applied?.set);
    expect(overlay.currentRow("TestModel", "0xabc")).toEqual(applied?.set);
    expect(confirmed.currentRow("TestModel", "0xdef")).toBeUndefined();

    overlay.apply(decodeRequired(registry, rawEvent(WORLD_EVENT_SELECTORS.delete, "0x101", [])));
    expect(overlay.currentRow("TestModel", "0xabc")).toBeUndefined();
    expect(confirmed.currentRow("TestModel", "0xabc")).toEqual(applied?.set);
  });
});
