import { expect, it } from "vitest";
import { launchSlot, type SlotGame } from "./slot-launch";
import { launchShard } from "./test-launch-chain";

/** Four games dealt round-robin to two seaters, as the launch assigns them by group. */
const slot: SlotGame[] = [
  { name: "blitz-1", players: 24, seater: "s0" },
  { name: "blitz-2", players: 24, seater: "s1" },
  { name: "blitz-3", players: 23, seater: "s0" },
  { name: "blitz-4", players: 23, seater: "s1" },
];
const repeat = (gameId: number, times: number) => Array.from({ length: times }, () => gameId);

it("creates every game from the scheduler with one wait, then each seater seats its own games in its own pipeline", async () => {
  const shard = launchShard();
  const launched = await launchSlot(shard.chain, slot);
  expect(launched.map(({ name, gameId, seater, seats }) => [name, gameId, seater, seats])).toEqual([
    ["blitz-1", 1, "s0", 24],
    ["blitz-2", 2, "s1", 24],
    ["blitz-3", 3, "s0", 23],
    ["blitz-4", 4, "s1", 23],
  ]);
  expect(shard.sentBy("scheduler").map(({ nonce }) => nonce)).toEqual([0n, 1n, 2n, 3n]);
  expect(shard.state.closedWaits).toBe(1);
  // Each seater's seats run on its own consecutive nonces from 0, its games in roster order, with no probe.
  for (const [seater, games] of [
    ["s0", [...repeat(1, 24), ...repeat(3, 23)]],
    ["s1", [...repeat(2, 24), ...repeat(4, 23)]],
  ] as const) {
    const sent = shard.sentBy(seater);
    expect(sent.map(({ nonce }) => nonce)).toEqual(Array.from({ length: 47 }, (_, index) => BigInt(index)));
    expect(sent.map(({ gameId }) => gameId)).toEqual(games);
  }
  expect(shard.state.deepestQueue).toBeLessThanOrEqual(48);
  expect([...shard.games.values()].every(({ seated, roster }) => seated === roster)).toBe(true);
});

it("verifies every game and tops up the one a reverted seat left short, on that game's own seater", async () => {
  // s0's nonce 30 is game 3's seventh seat: it reverts, spending the nonce and seating nobody.
  const shard = launchShard({ revert: [30n] });
  const launched = await launchSlot(shard.chain, slot);
  expect([...shard.games.values()].map(({ seated }) => seated)).toEqual([24, 24, 23, 23]);
  expect(launched.map(({ seats }) => seats)).toEqual([24, 24, 24, 23]);
  expect(shard.sentBy("s1")).toHaveLength(47);
});

it("restarts mid-run: created games are not created again, and their seating settles on their own seater", async () => {
  const shard = launchShard();
  // The crashed run created games 1 and 2, seated game 1 fully and game 2 to 10, and left two of game 2's seats queued.
  const first = shard.created(slot[0]!, 24);
  const second = shard.created(slot[1]!, 10);
  shard.queue("s1", 0n, second);
  shard.queue("s1", 1n, second);
  const launched = await launchSlot(shard.chain, slot);
  expect(shard.sentBy("scheduler")).toHaveLength(2);
  expect([...shard.games.values()].map(({ seated }) => seated)).toEqual([24, 24, 23, 23]);
  expect(shard.sentBy("s0").filter(({ gameId }) => gameId === first)).toHaveLength(0);
  // Game 2 had 12 seated once its queue ran; s1 seats game 4 fresh, then tops game 2 up with a probe and one window.
  expect(launched.map(({ seats }) => seats)).toEqual([0, 12, 23, 23]);
});

it("fails the run when one seater stalls, after the others finish; the retry seats only the stalled seater's games", async () => {
  const shard = launchShard();
  shard.state.refusing.add("s1");
  await expect(launchSlot(shard.chain, slot)).rejects.toThrow("roster_seating_did_not_progress");
  expect([...shard.games.values()].map(({ seated }) => seated)).toEqual([24, 0, 23, 0]);
  const s0Sent = shard.sentBy("s0").length;
  shard.state.refusing.delete("s1");
  await launchSlot(shard.chain, slot);
  expect([...shard.games.values()].map(({ seated }) => seated)).toEqual([24, 24, 23, 23]);
  expect(shard.sentBy("scheduler")).toHaveLength(4);
  expect(shard.sentBy("s0")).toHaveLength(s0Sent);
});

it("refuses a game stored with another roster or another seater, before seating anyone", async () => {
  const roster = launchShard();
  roster.created({ ...slot[0]!, players: 20 });
  await expect(launchSlot(roster.chain, slot)).rejects.toThrow("frozen_roster_differs");
  const seater = launchShard();
  seater.created({ ...slot[0]!, seater: "s1" });
  await expect(launchSlot(seater.chain, slot)).rejects.toThrow("game_seater_differs");
  expect([...roster.state.sent, ...seater.state.sent].filter(({ kind }) => kind === "seat")).toHaveLength(0);
});
