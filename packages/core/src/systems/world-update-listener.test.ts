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
  it("carries the chest result's recorded action key to its consumer", () => {
    const { store, listener } = fixture();
    const reward = vi.fn();
    listener.ChestRewards.onChestReward(reward);
    store.applyEvent({
      model: "StoryEvent",
      key: "receipt-key",
      value: {
        game_id: 1,
        order: "9007199254740993",
        index: 1,
        timestamp: 100,
        story: { ChestReward: { explorer_id: 7, kind: "Token", quality: 0, depth: 2 } },
      },
    });
    expect(reward).toHaveBeenCalledWith({
      resultKey: ["0x1", "0x20000000000001", "0x1"],
      explorerId: 7,
      kind: "Token",
      quality: 0,
      depth: 2,
      timestamp: 100,
    });
  });

  it("reads an army's attribute choice in either enum form, and refuses one it cannot name", () => {
    const { store, listener } = fixture();
    const chosen = vi.fn();
    listener.Attributes.onAttributeChosen(chosen);
    const story = (attribute: unknown) =>
      store.applyEvent({
        model: "StoryEvent",
        key: "receipt-key",
        value: {
          game_id: 1,
          order: "4",
          index: 0,
          timestamp: 100,
          story: {
            AttributeChosen: { explorer_id: 7, offer_id: 3, source: "Level", attribute, applied: 1, lost: 2 },
          },
        },
      });
    story("Scouting");
    story({ Battle: {} });
    expect(chosen.mock.calls.map(([update]) => update)).toEqual([
      { explorerId: 7, offerId: 3, attribute: "Scouting", applied: 1, lost: 2 },
      { explorerId: 7, offerId: 3, attribute: "Battle", applied: 1, lost: 2 },
    ]);
    expect(() => story("Luck")).toThrow("Malformed attribute choice");
  });

  it("reads building additions and removals from committed facts and unsubscribes", () => {
    const { store, listener } = fixture();
    const changed = vi.fn();
    const stop = listener.Buildings.onBuildingUpdate(7, changed);
    const building = {
      game_id: 1,
      structure_id: 7,
      inner_col: 11,
      inner_row: 10,
      category: 3,
      paused: false,
      labor_paid: 0n,
    };
    store.applyFacts([{ model: "Building", key: "0x1", value: building }]);
    expect(changed).toHaveBeenLastCalledWith({ buildingType: 3, innerCol: 11, innerRow: 10, paused: false });
    store.applyFacts([{ model: "Building", key: "0x1", value: null }]);
    expect(changed).toHaveBeenLastCalledWith({ buildingType: 0, innerCol: 11, innerRow: 10, paused: false });
    stop();
    store.applyFacts([{ model: "Building", key: "0x1", value: building }]);
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
    store.applyEvent({ model: "StoryEvent", key: "0x1", value: opening });
    expect(chest).toHaveBeenCalledWith({ explorerId: 7, hex: { x: 10, y: 20 }, relics: [39], timestamp: 100 });
    store.applyEvent({
      model: "StoryEvent",
      key: "0x2",
      value: {
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
    });
    expect(reward).toHaveBeenCalledWith(
      expect.objectContaining({
        explorerId: 7,
        explorerOwnerAddress: 0xabcn,
        amount: 1,
        rawAmount: 1000000000n,
        coord: { x: 10, y: 20 },
      }),
    );
    store.applyEvent({ model: "StoryEvent", key: "0x3", value: { ...opening, game_id: "0x2" } });
    expect(chest).toHaveBeenCalledTimes(1);
    stop();
    store.applyEvent({ model: "StoryEvent", key: "0x4", value: opening });
    expect(chest).toHaveBeenCalledTimes(1);
    expect([...store.rows("ExplorerTroops")]).toEqual([]);
  });
});
