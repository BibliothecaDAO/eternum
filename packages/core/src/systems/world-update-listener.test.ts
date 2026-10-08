import { StructureType } from "@bibliothecadao/types";
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
  it("reads an army's Upgrade in either enum form, and refuses one it cannot name", () => {
    const { store, listener } = fixture();
    const chosen = vi.fn();
    listener.Attributes.onTierBought(chosen);
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
            TierBought: { explorer_id: 7, attribute, tier: 3, price: 200 },
          },
        },
      });
    story("Scouting");
    story({ Battle: {} });
    expect(chosen.mock.calls.map(([update]) => update)).toEqual([
      { explorerId: 7, attribute: "Scouting", tier: 3, price: 200 },
      { explorerId: 7, attribute: "Battle", tier: 3, price: 200 },
    ]);
    expect(() => story("Luck")).toThrow("Malformed tier purchase");
  });

  it("carries a cleared site's payout with the tile and losses of the exchange that won it", () => {
    const { store, listener } = fixture();
    const payout = vi.fn();
    const stop = listener.SitePayouts.onSitePayout(payout);
    const side = (before: bigint, after: bigint) => ({ before: String(before), after: String(after) });
    const battle = (order: string, defenderId: number) =>
      store.applyEvent({
        model: "BattleEvent",
        key: `battle-${order}`,
        value: {
          game_id: 1,
          order,
          index: 0,
          defender_id: defenderId,
          coord: { x: 40, y: 12 },
          attacker: side(1_498_000_000_000n, 1_078_000_000_000n),
          defender: side(1_100_000_000_000n, 0n),
        },
      });
    const story = (order: string, siteId: number, category: number, reward: unknown) =>
      store.applyEvent({
        model: "StoryEvent",
        key: `story-${order}`,
        value: {
          game_id: 1,
          order,
          index: 1,
          owner: "0x111",
          timestamp: 100,
          story: { SitePayout: { structure_id: 3, explorer_id: 7, site_id: siteId, category, reward } },
        },
      });

    battle("5", 9);
    story("5", 9, StructureType.Camp, { resource_type: 23, amount: "550000000000" });
    battle("6", 10);
    story("6", 10, StructureType.Stragglers, null);
    expect(payout.mock.calls.map(([update]) => update)).toEqual([
      {
        explorerId: 7,
        siteId: 9,
        ownerAddress: 0x111n,
        kind: "Camp",
        reward: { resourceId: 23, amount: 550 },
        coord: { x: 40, y: 12 },
        troopsLost: 420,
      },
      expect.objectContaining({ siteId: 10, kind: "Stragglers", reward: null }),
    ]);
    // A payout whose winning battle is not the one just before it is a contract bug, never a guess.
    expect(() => story("7", 11, StructureType.Rift, { resource_type: 29, amount: "1" })).toThrow(
      "without its winning battle",
    );
    battle("7", 11);
    expect(() => story("7", 11, StructureType.Rift, null)).toThrow("A cleared Rift pays nothing");
    stop();
    battle("8", 12);
    story("8", 12, StructureType.Camp, { resource_type: 23, amount: "1" });
    expect(payout).toHaveBeenCalledTimes(2);
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
