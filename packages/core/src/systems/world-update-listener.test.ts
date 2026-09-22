import { describe, expect, it, vi } from "vitest";
import { WorldUpdateListener } from "./world-update-listener";
import { NativeFactStore } from "../client/native-fact-store";
import type { GameClientSetup } from "../client/game-client";
import { configManager } from "../managers/config-manager";

function fixture() {
  configManager.setActiveGame(1, 1);
  const store = new NativeFactStore();
  return { store, listener: new WorldUpdateListener({ store } as GameClientSetup) };
}

describe("native scene updates", () => {
  it("reads building additions and removals from committed facts and unsubscribes", () => {
    const { store, listener } = fixture();
    const changed = vi.fn();
    const stop = listener.Buildings.onBuildingUpdate({ col: 20, row: 30 }, changed);
    const building = {
      game_id: 1,
      alt: false,
      outer_col: 20,
      outer_row: 30,
      inner_col: 11,
      inner_row: 10,
      category: 3,
      outer_entity_id: 7,
      paused: false,
      labor_paid: 0n,
    };
    store.applyEntityOperations([
      { type: "upsert", entities: [{ hashed_keys: "0x1", models: { Building: building } }] },
    ]);
    expect(changed).toHaveBeenLastCalledWith({ buildingType: 3, innerCol: 11, innerRow: 10, paused: false });
    store.applyEntityOperations([{ type: "delete-entity", entityId: "0x1" }]);
    expect(changed).toHaveBeenLastCalledWith({ buildingType: 0, innerCol: 11, innerRow: 10, paused: false });
    stop();
    store.applyEntityOperations([
      { type: "upsert", entities: [{ hashed_keys: "0x1", models: { Building: building } }] },
    ]);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("delivers native chest and extraction stories without retaining event rows", () => {
    const { store, listener } = fixture();
    const chest = vi.fn();
    const reward = vi.fn();
    const stop = listener.RelicChest.onRelicChestOpened(chest);
    listener.ExplorerReward.onExplorerRewardEventUpdate(reward);
    const opening = {
      game_id: "0x1",
      timestamp: "0x64",
      story: {
        RelicChestOpened: {
          explorer_id: "0x7",
          coord: { alt: true, x: "0xa", y: "0x14" },
          relics: ["0x27"],
          points: "0x0",
        },
      },
    };
    store.applyEvent({ hashed_keys: "0x1", models: { StoryEvent: opening } });
    expect(chest).toHaveBeenCalledWith({ explorerId: 7, hex: { x: 10, y: 20 }, relics: [39], timestamp: 100 });
    store.applyEvent({
      hashed_keys: "0x2",
      models: {
        StoryEvent: {
          game_id: "0x1",
          timestamp: "0x65",
          owner: "0xabc",
          story: {
            ExplorationReward: {
              explorer_id: "0x7",
              receiver: "0x8",
              coord: { alt: true, x: "0xa", y: "0x14" },
              resource_type: "0x1",
              amount: "0x3b9aca00",
            },
          },
        },
      },
    });
    expect(reward).toHaveBeenCalledWith(
      expect.objectContaining({ explorerId: 7, explorerOwnerAddress: 0xabcn, amount: 1, rawAmount: 1000000000n }),
    );
    store.applyEvent({ hashed_keys: "0x3", models: { StoryEvent: { ...opening, game_id: "0x2" } } });
    expect(chest).toHaveBeenCalledTimes(1);
    stop();
    store.applyEvent({ hashed_keys: "0x4", models: { StoryEvent: opening } });
    expect(chest).toHaveBeenCalledTimes(1);
    expect([...store.rows("ExplorerTroops")]).toEqual([]);
  });
});
