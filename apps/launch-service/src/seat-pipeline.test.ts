import { expect, it } from "vitest";
import { SeatRefused, seatRoster, type LauncherSeats } from "./seat-pipeline";
import { launchShard, type ShardFaults } from "./test-launch-chain";

/** A shard holding one created game of `roster` players, none seated, seated by s0 from nonce 0. */
const oneGame = (roster: number, faults: ShardFaults = {}) => {
  const shard = launchShard(faults);
  const gameId = shard.created({ name: "blitz-1", players: roster, seater: "s0" });
  const seats = () => shard.sentBy("s0").map(({ nonce }) => nonce);
  return {
    games: shard.games,
    gameId,
    seats,
    chain: shard.chain.seats("s0"),
    state: {
      get nonce() {
        return shard.state.nonce("s0");
      },
      get refused() {
        return shard.state.refused;
      },
      get deepestQueue() {
        return shard.state.deepestQueue;
      },
      set refusing(on: boolean) {
        if (on) shard.state.refusing.add("s0");
        else shard.state.refusing.delete("s0");
      },
    },
    queue: (nonce: bigint, gameId: number) => shard.queue("s0", nonce, gameId),
  };
};

it("seats a roster with one probe and one window, never queuing more than the window", async () => {
  const { chain, state, games, gameId, seats } = oneGame(50);
  expect(await seatRoster(chain, gameId, 48n)).toBe(50);
  expect(games.get(gameId)!.seated).toBe(50);
  expect(seats()).toEqual(Array.from({ length: 50 }, (_, index) => BigInt(index)));
  expect(state.deepestQueue).toBeLessThanOrEqual(48);
});

it("resends a seat the RPC refused before forwarding, at the same nonce", async () => {
  const { chain, state, games, gameId, seats } = oneGame(24, { refuse: [5n] });
  expect(await seatRoster(chain, gameId)).toBe(24);
  expect(games.get(gameId)!.seated).toBe(24);
  expect([state.refused, state.nonce]).toEqual([1, 24n]);
  expect(seats().filter((nonce) => nonce === 5n)).toHaveLength(1);
});

it("fills a gap: a seat accepted but never executed is sent again once its successors stall behind it", async () => {
  const { chain, state, games, gameId, seats } = oneGame(24, { lose: [7n] });
  expect(await seatRoster(chain, gameId)).toBe(24);
  expect(games.get(gameId)!.seated).toBe(24);
  expect(state.nonce).toBe(24n);
  expect(seats().filter((nonce) => nonce === 7n)).toHaveLength(2);
});

it("tops up after a seat reverts mid-window: its nonce is spent and the next round seats the player it missed", async () => {
  const { chain, state, games, gameId } = oneGame(24, { revert: [3n] });
  expect(await seatRoster(chain, gameId)).toBe(25);
  expect(games.get(gameId)!.seated).toBe(24);
  expect(state.nonce).toBe(25n);
});

it("an extra seat on a full roster is a no-op, so an unknown last outcome is settled by one more probe", async () => {
  const full = oneGame(0);
  expect(await seatRoster(full.chain, full.gameId)).toBe(1);
  expect(full.state.nonce).toBe(1n);

  // The last seat executed but its receipt never reads: the chain has moved past it, so it counts as spent, and the
  // top-up round's one seat finds the roster full.
  const lastUnread = oneGame(3, { unreadable: [2n] });
  expect(await seatRoster(lastUnread.chain, lastUnread.gameId)).toBe(4);
  expect(lastUnread.games.get(lastUnread.gameId)!.seated).toBe(3);
  expect(lastUnread.state.nonce).toBe(4n);
});

it("gives up on a seat the RPC keeps refusing", async () => {
  const { chain, gameId } = oneGame(24);
  const stubborn: LauncherSeats = {
    ...chain,
    async send() {
      throw new SeatRefused();
    },
  };
  await expect(seatRoster(stubborn, gameId)).rejects.toBeInstanceOf(SeatRefused);
});

it("stops after two rounds that only spend nonces, before anyone is seated, and recovers on the launch's retry", async () => {
  const { chain, state, games, gameId } = oneGame(24);
  state.refusing = true;
  await expect(seatRoster(chain, gameId)).rejects.toThrow("roster_seating_did_not_progress");
  expect(games.get(gameId)!.seated).toBe(0);
  expect(state.nonce).toBe(2n);
  state.refusing = false;
  expect(await seatRoster(chain, gameId)).toBe(24);
  expect(games.get(gameId)!.seated).toBe(24);
  expect(state.nonce).toBe(26n);
});

it("stops after two all-spent rounds once progress was known, spending at most two rounds of nonces", async () => {
  const { chain, state, games, gameId } = oneGame(5);
  const probe: LauncherSeats = {
    ...chain,
    async result(nonce) {
      const result = await chain.result(nonce);
      state.refusing = true;
      return result;
    },
  };
  await expect(seatRoster(probe, gameId)).rejects.toThrow("roster_seating_did_not_progress");
  // The probe seated one player and reported 4; two rounds of 4 seats then spent their nonces.
  expect(games.get(gameId)!.seated).toBe(1);
  expect(state.nonce).toBe(9n);
  state.refusing = false;
  expect(await seatRoster(chain, gameId)).toBe(4);
  expect(games.get(gameId)!.seated).toBe(5);
  expect(state.nonce).toBe(13n);
});

it("resumes a crashed run: its queued seats run first, and a gap in them is filled at the chain's next nonce", async () => {
  const restarted = oneGame(10);
  for (const nonce of [0n, 1n, 2n, 3n]) restarted.queue(nonce, restarted.gameId);
  expect(await seatRoster(restarted.chain, restarted.gameId)).toBe(6);
  expect(restarted.games.get(restarted.gameId)!.seated).toBe(10);
  expect(restarted.seats()).toEqual([4n, 5n, 6n, 7n, 8n, 9n]);

  // The probe fills the gap at 2 and reports 7 unseated, a count taken before the old seats at 3 and 4 ran behind it,
  // so the round sends two seats that find the roster full and seat nobody.
  const gapped = oneGame(10);
  for (const nonce of [0n, 1n, 3n, 4n]) gapped.queue(nonce, gapped.gameId);
  expect(await seatRoster(gapped.chain, gapped.gameId)).toBe(8);
  expect(gapped.games.get(gapped.gameId)!.seated).toBe(10);
  expect(gapped.state.nonce).toBe(12n);
  expect(gapped.seats()).toEqual([2n, 5n, 6n, 7n, 8n, 9n, 10n, 11n]);
});
