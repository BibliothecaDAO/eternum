import { RESOURCE_PRECISION, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";
import { WorldUpdateListener } from "./world-update-listener";
import { NativeFactStore } from "../client/native-fact-store";
import type { GameClientSetup } from "../client/game-client";
import { configManager } from "../managers/config-manager";

/** A refusal inside a store reader is reported by the store, which keeps delivering to every other reader. */
function expectReported(deliver: () => void, message: string) {
  const reported = vi.spyOn(console, "error").mockImplementation(() => {});
  deliver();
  expect(String(reported.mock.calls.at(-1))).toContain(message);
  reported.mockRestore();
}

function fixture() {
  configManager.setActiveGame(1, 1);
  const store = new NativeFactStore();
  return { store, listener: new WorldUpdateListener({ store } as GameClientSetup) };
}

describe("native scene updates", () => {
  it.each([
    { category: StructureType.Ruin, kind: "Ruin", resourceId: ResourcesIds.Lords, amount: 5 },
    { category: StructureType.Ruin, kind: "Ruin", resourceId: ResourcesIds.Lords, amount: 0 },
    { category: StructureType.Beasts, kind: "Beasts", resourceId: ResourcesIds.Labor, amount: 137 },
    { category: StructureType.Beasts, kind: "Beasts", resourceId: ResourcesIds.Labor, amount: 80 },
    { category: StructureType.Beasts, kind: "Beasts", resourceId: ResourcesIds.Labor, amount: 0 },
    { category: StructureType.Camp, kind: "Camp", resourceId: ResourcesIds.Essence, amount: 12 },
    { category: StructureType.Rift, kind: "Rift", resourceId: ResourcesIds.Labor, amount: 4 },
    { category: StructureType.Camp, kind: "Camp", resourceId: ResourcesIds.Labor, amount: null },
    { category: StructureType.Rift, kind: "Rift", resourceId: ResourcesIds.Labor, amount: null },
    { category: StructureType.Ruin, kind: "Ruin", resourceId: ResourcesIds.Labor, amount: null },
    { category: StructureType.Beasts, kind: "Beasts", resourceId: ResourcesIds.Labor, amount: null },
  ])("delivers $kind's recorded $amount payout with its winning battle", ({ category, kind, resourceId, amount }) => {
    const { store, listener } = fixture();
    const delivered = vi.fn();
    const stop = listener.SitePayouts.onSitePayout(delivered);
    const position = (event_index: number) => ({
      block_number: 9,
      transaction_hash: "0xab",
      transaction_index: 0,
      event_index,
    });
    store.applyEvent({
      model: "StoryEvent",
      key: "payout",
      value: {
        game_id: 1,
        owner: "0x111",
        timestamp: 100,
        event_position: position(4),
        story: {
          SitePayout: {
            structure_id: 3,
            explorer_id: 7,
            site_id: 9,
            category,
            reward:
              amount === null
                ? null
                : { resource_type: resourceId, amount: String(BigInt(amount) * BigInt(RESOURCE_PRECISION)) },
          },
        },
      },
    });
    expect(delivered).not.toHaveBeenCalled();
    store.applyEvent({
      model: "BattleEvent",
      key: "battle",
      value: {
        game_id: 1,
        defender_id: 9,
        coord: { x: 40, y: 12 },
        attacker: { before: "1000000000000", after: "900000000000" },
        defender: { before: "100000000000", after: "0" },
        event_position: position(5),
      },
    });
    expect(delivered.mock.calls).toEqual([
      [
        {
          explorerId: 7,
          siteId: 9,
          ownerAddress: 0x111n,
          kind,
          reward: amount === null ? null : { resourceId, amount },
          coord: { x: 40, y: 12 },
          troopsLost: 100,
        },
      ],
    ]);
    stop();
  });

  it("carries a cleared site's payout with the tile and losses of the battle the contract emits after it", () => {
    const { store, listener } = fixture();
    const payout = vi.fn();
    const stop = listener.SitePayouts.onSitePayout(payout);
    const side = (before: bigint, after: bigint) => ({ before: String(before), after: String(after) });
    const at = (transaction: string, index: number) => ({
      event_position: { block_number: 9, transaction_hash: transaction, transaction_index: 0, event_index: index },
    });
    const battle = (transaction: string, defenderId: number, lostTroops = 420n) =>
      store.applyEvent({
        model: "BattleEvent",
        key: `battle-${transaction}-${defenderId}-${lostTroops}`,
        value: {
          game_id: 1,
          defender_id: defenderId,
          coord: { x: 40, y: 12 },
          attacker: side(1_498_000_000_000n, 1_498_000_000_000n - lostTroops * 1_000_000_000n),
          defender: side(1_100_000_000_000n, 0n),
          ...at(transaction, 5),
        },
      });
    const story = (transaction: string, siteId: number, category: number, reward: unknown) =>
      store.applyEvent({
        model: "StoryEvent",
        key: `story-${transaction}-${siteId}`,
        value: {
          game_id: 1,
          owner: "0x111",
          timestamp: 100,
          story: { SitePayout: { structure_id: 3, explorer_id: 7, site_id: siteId, category, reward } },
          ...at(transaction, 4),
        },
      });

    // The order on the chain: an earlier exchange that left the camp standing, then the payout, then its battle.
    battle("0xa", 9, 100n);
    story("0xb", 9, StructureType.Camp, { resource_type: 23, amount: "550000000000" });
    expect(payout).not.toHaveBeenCalled();
    battle("0xb", 9);
    story("0xc", 10, StructureType.Beasts, null);
    battle("0xc", 10);
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
      expect.objectContaining({ siteId: 10, kind: "Beasts", reward: null }),
    ]);

    // Within one transaction, a different site's battle or a second payout is still a pairing fault.
    story("0xd", 11, StructureType.Rift, { resource_type: 29, amount: "1" });
    expectReported(() => battle("0xd", 12), "Site payout 11 arrived without its winning battle");
    story("0xe", 11, StructureType.Rift, { resource_type: 29, amount: "1" });
    expectReported(
      () => story("0xe", 13, StructureType.Camp, { resource_type: 23, amount: "1" }),
      "Site payout 11 arrived without its winning battle",
    );
    battle("0xe", 13);
    story("0x10", 11, StructureType.Rift, { resource_type: 29, amount: "1" });
    expectReported(
      () => story("0x11", 13, StructureType.Camp, { resource_type: 23, amount: "1" }),
      "Site payout 11 arrived without its winning battle",
    );
    battle("0x11", 13);
    expect(payout).toHaveBeenCalledTimes(4);

    stop();
    story("0x13", 12, StructureType.Camp, { resource_type: 23, amount: "1" });
    battle("0x13", 12);
    expect(payout).toHaveBeenCalledTimes(4);
  });

  it.each([
    { category: StructureType.Camp, kind: "Camp", resourceId: ResourcesIds.Labor },
    { category: StructureType.Rift, kind: "Rift", resourceId: ResourcesIds.Essence },
    { category: StructureType.Beasts, kind: "Beasts", resourceId: null },
  ])(
    "reports an unpaired private $kind payout once without losing the following clear",
    ({ category, kind, resourceId }) => {
      const { store, listener } = fixture();
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const delivered = vi.fn();
      const stop = listener.SitePayouts.onSitePayout(delivered);
      const at = (transaction_hash: string, event_index: number) => ({
        event_position: { block_number: 9, transaction_hash, transaction_index: 0, event_index },
      });
      const payout = (tx: string, site_id: number) =>
        store.applyEvent({
          model: "StoryEvent",
          key: `story-${tx}`,
          value: {
            game_id: 1,
            owner: "0xa",
            timestamp: 100,
            ...at(tx, 4),
            story: {
              SitePayout: {
                structure_id: 3,
                explorer_id: 7,
                site_id,
                category,
                reward: resourceId === null ? null : { resource_type: resourceId, amount: String(RESOURCE_PRECISION) },
              },
            },
          },
        });
      const battle = (tx: string, defender_id: number) =>
        store.applyEvent({
          model: "BattleEvent",
          key: `battle-${tx}`,
          value: {
            game_id: 1,
            defender_id,
            coord: { x: 40, y: 12 },
            attacker: { before: "1000000000000", after: "900000000000" },
            defender: { before: "100000000000", after: "0" },
            ...at(tx, 5),
          },
        });
      try {
        // A private receipt without its battle, then another action: report the lost clear once.
        payout("0xaa", 9);
        battle("0xbb", 5);
        expect(delivered).not.toHaveBeenCalled();
        expect(errors).toHaveBeenCalledTimes(1);
        expect(String(errors.mock.calls[0])).toContain("Site payout 9 arrived without its winning battle");
        payout("0xcc", 8);
        battle("0xcc", 8);
        // A payout can itself end the prior transaction: report the fault after retaining the new receipt.
        payout("0xdd", 10);
        payout("0xee", 11);
        battle("0xee", 11);
        expect(errors).toHaveBeenCalledTimes(2);
        expect(String(errors.mock.calls[1])).toContain("Site payout 10 arrived without its winning battle");
        expect(delivered.mock.calls.map(([clear]) => clear)).toEqual(
          [8, 11].map((siteId) => ({
            explorerId: 7,
            siteId,
            ownerAddress: 0xan,
            kind,
            reward: resourceId === null ? null : { resourceId, amount: 1 },
            coord: { x: 40, y: 12 },
            troopsLost: 100,
          })),
        );
      } finally {
        stop();
        errors.mockRestore();
      }
    },
  );

  it("quietly leaves a peer's ruin receipt unpaired when its transaction ends, then delivers the viewer's clear", () => {
    const { store, listener } = fixture();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const delivered = vi.fn();
    const stop = listener.SitePayouts.onSitePayout(delivered);
    const at = (transaction_hash: string, event_index: number) => ({
      event_position: { block_number: 9, transaction_hash, transaction_index: 0, event_index },
    });
    const story = (tx: string, owner: string, site_id: number, category: number) =>
      store.applyEvent({
        model: "StoryEvent",
        key: `story-${tx}`,
        value: {
          game_id: 1,
          owner,
          timestamp: 100,
          ...at(tx, 4),
          story: {
            SitePayout: {
              structure_id: 3,
              explorer_id: 7,
              site_id,
              category,
              reward: {
                resource_type: category === StructureType.Ruin ? ResourcesIds.Lords : ResourcesIds.Labor,
                amount: String(5n * BigInt(RESOURCE_PRECISION)),
              },
            },
          },
        },
      });
    const battle = (tx: string, defender_id: number) =>
      store.applyEvent({
        model: "BattleEvent",
        key: `battle-${tx}`,
        value: {
          game_id: 1,
          defender_id,
          coord: { x: 40, y: 12 },
          attacker: { before: "1000000000000", after: "900000000000" },
          defender: { before: "100000000000", after: "0" },
          ...at(tx, 6),
        },
      });
    const otherStory = (tx: string) =>
      store.applyEvent({
        model: "StoryEvent",
        key: `other-story-${tx}`,
        value: {
          game_id: 1,
          owner: "0xa",
          timestamp: 100,
          story: { FaithPointsClaimedStory: { wonder_id: 3, new_points: 1, total_points: 2 } },
          ...at(tx, 5),
        },
      });
    try {
      // Shared peer receipt, then an unrelated own clear.
      story("0xaa", "0xb", 99, StructureType.Ruin);
      expect(delivered).not.toHaveBeenCalled();
      story("0xbb", "0xa", 9, StructureType.Camp);
      otherStory("0xbb");
      battle("0xbb", 9);
      expect(delivered.mock.calls).toEqual([
        [
          {
            explorerId: 7,
            siteId: 9,
            ownerAddress: 0xan,
            kind: "Camp",
            reward: { resourceId: ResourcesIds.Labor, amount: 5 },
            coord: { x: 40, y: 12 },
            troopsLost: 100,
          },
        ],
      ]);
      expect(errors).not.toHaveBeenCalled();
      // Even a battle naming the same site cannot pair across transactions.
      story("0xcc", "0xb", 98, StructureType.Ruin);
      battle("0xdd", 98);
      // Any event from another transaction ends the pending pair, not just another payout or battle.
      story("0xee", "0xb", 97, StructureType.Ruin);
      otherStory("0xff");
      battle("0xee", 97);
      expect(delivered).toHaveBeenCalledTimes(1);
      expect(errors).not.toHaveBeenCalled();
    } finally {
      stop();
      errors.mockRestore();
    }
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
    const stop = listener.Chests.onChestOpened(chest);
    listener.ExplorerReward.onExplorerRewardEventUpdate(reward);
    const opening = {
      game_id: "0x1",
      timestamp: "0x64",
      story: {
        RelicChestOpened: {
          explorer_id: "0x7",
          coord: { alt: true, x: "0xa", y: "0x14" },
          chest: { pack: "War", lucky: false },
          relics: ["0x29", "0x2b", "0x27"],
          points: "0x0",
        },
      },
    };
    store.applyEvent({ model: "StoryEvent", key: "0x1", value: opening });
    expect(chest).toHaveBeenCalledWith({
      kind: "relics",
      title: "Crate opened: 3 relics to the army",
      explorerId: 7,
      hex: { x: 10, y: 20 },
      relics: [41, 43, 39],
      timestamp: 100,
    });
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

it("delivers paid and expired reward chest stories through the one opening subscription, and releases both handlers", () => {
  const { store, listener } = fixture();
  const received = vi.fn();
  const stop = listener.Chests.onChestOpened(received);
  const emit = (amount: number, game_id = 1) =>
    store.applyEvent({
      model: "StoryEvent",
      key: "0xce",
      value: {
        game_id,
        timestamp: 361,
        story: { RewardChestOpened: { explorer_id: 7, structure_id: 5, coord: { alt: false, x: 10, y: 20 }, amount } },
      },
    });
  emit(17);
  emit(0);
  emit(50, 2);
  expect(received.mock.calls.map(([value]) => value)).toEqual([
    {
      kind: "lords",
      amount: 17,
      title: "Chest opened: 17 LORDS to its realm",
      explorerId: 7,
      hex: { x: 10, y: 20 },
      timestamp: 361,
    },
    {
      kind: "lords",
      amount: 0,
      title: "Chest expired: no LORDS paid",
      explorerId: 7,
      hex: { x: 10, y: 20 },
      timestamp: 361,
    },
  ]);
  stop();
  emit(17);
  expect(received).toHaveBeenCalledTimes(2);
});
