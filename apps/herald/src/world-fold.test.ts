import type { GameSyncModelDefinition } from "@bibliothecadao/eternum/game-sync-models";
import { hash } from "starknet";
import { describe, expect, it } from "vitest";

import { createModelRegistry } from "./model-registry";
import type { RawWorldEvent, WorldManifest } from "./types";
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
});
