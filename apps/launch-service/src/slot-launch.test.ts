import { expect, it } from "vitest";
import { launchSlot, type SlotGame } from "./slot-launch";
import { launchShard } from "./test-launch-chain";

const slot: SlotGame[] = [
  { name: "blitz-1", players: 24 },
  { name: "blitz-2", players: 24 },
  { name: "blitz-3", players: 23 },
];

it("creates every game back to back with one wait, then seats all of them in one pipeline", async () => {
  const { chain, state, games } = launchShard();
  const launched = await launchSlot(chain, slot);
  expect(launched.map(({ name, gameId, seats }) => [name, gameId, seats])).toEqual([
    ["blitz-1", 1, 24],
    ["blitz-2", 2, 24],
    ["blitz-3", 3, 23],
  ]);
  const creates = state.sent.filter(({ kind }) => kind === "create");
  const seats = state.sent.filter(({ kind }) => kind === "seat");
  expect(creates.map(({ nonce }) => nonce)).toEqual([0n, 1n, 2n]);
  expect(state.closedWaits).toBe(1);
  // One pipeline across the games, in roster order, with no probe: 71 consecutive nonces after the creates.
  expect(seats.map(({ nonce }) => nonce)).toEqual(Array.from({ length: 71 }, (_, index) => BigInt(index + 3)));
  expect(seats.map(({ gameId }) => gameId)).toEqual([
    ...Array.from({ length: 24 }, () => 1),
    ...Array.from({ length: 24 }, () => 2),
    ...Array.from({ length: 23 }, () => 3),
  ]);
  expect(state.deepestQueue).toBeLessThanOrEqual(48);
  expect([...games.values()].map(({ seated, roster }) => seated === roster)).toEqual([true, true, true]);
});

it("verifies every game once and tops up the one a reverted seat left short", async () => {
  // Nonce 30 is game 2's seventh seat: it reverts, spending the nonce and seating nobody.
  const { chain, games } = launchShard({ revert: [30n] });
  const launched = await launchSlot(chain, slot);
  expect([...games.values()].map(({ seated }) => seated)).toEqual([24, 24, 23]);
  // Game 2's top-up is one probe seat, which seats the player the reverted seat missed.
  expect(launched.map(({ seats }) => seats)).toEqual([24, 25, 23]);
});

it("restarts mid-run: games already created are not created again, and their seating is settled by the top-up", async () => {
  const shard = launchShard();
  // The crashed run created games 1 and 2, seated game 1 fully and game 2 to 10, and left two of game 2's seats queued.
  const first = shard.created(slot[0]!, 24);
  const second = shard.created(slot[1]!, 10);
  shard.queue(0n, second);
  shard.queue(1n, second);
  const launched = await launchSlot(shard.chain, slot);
  expect(shard.state.sent.filter(({ kind }) => kind === "create")).toHaveLength(1);
  expect([...shard.games.values()].map(({ seated }) => seated)).toEqual([24, 24, 23]);
  const seatsFor = (gameId: number) => shard.state.sent.filter((sent) => sent.gameId === gameId).length;
  expect(seatsFor(first)).toBe(0);
  // Game 2 had 12 seated once its queue ran; its probe reports 11 left, and one window seats them.
  expect(seatsFor(second)).toBe(12);
  expect(launched.map(({ seats }) => seats)).toEqual([0, 12, 23]);
});

it("refuses a game whose stored roster is not the one being launched, before seating anyone", async () => {
  const shard = launchShard();
  shard.created({ name: "blitz-1", players: 20 });
  await expect(launchSlot(shard.chain, slot)).rejects.toThrow("frozen_roster_differs");
  expect(shard.state.sent.filter(({ kind }) => kind === "seat")).toHaveLength(0);
});

it("stops the launch when a game's seating stops progressing, leaving the rest for the retry", async () => {
  const shard = launchShard();
  shard.state.refusing = true;
  await expect(launchSlot(shard.chain, slot)).rejects.toThrow("roster_seating_did_not_progress");
  shard.state.refusing = false;
  const launched = await launchSlot(shard.chain, slot);
  expect([...shard.games.values()].map(({ seated }) => seated)).toEqual([24, 24, 23]);
  expect(shard.state.sent.filter(({ kind }) => kind === "create")).toHaveLength(3);
  expect(launched.every(({ seats }) => seats > 0)).toBe(true);
});
