import { expect, it } from "vitest";
import { SeatRefused, seatRoster, type RosterSeats, type SeatResult } from "./seat-pipeline";

/**
 * A shard as the launcher sees it: the mempool queues seats by nonce, the sequencer executes the launcher's queue in
 * nonce order whenever the launcher reads, and each executed seat seats the next player or, past the last, nobody.
 */
function shard(
  roster: number,
  faults: { refuse?: bigint[]; lose?: bigint[]; revert?: bigint[]; unreadable?: bigint[]; queued?: bigint[] } = {},
) {
  const refuse = new Set(faults.refuse);
  const unreadable = new Set(faults.unreadable);
  const lose = new Set(faults.lose);
  const revert = new Set(faults.revert);
  // Seats a crashed run left queued, the launcher's own, which no longer has their hashes.
  const queued = new Set<bigint>(faults.queued);
  const results = new Map<bigint, SeatResult>();
  const state = { nonce: 0n, seated: 0, sent: [] as bigint[], refused: 0, deepestQueue: 0, refusing: false };
  const execute = () => {
    for (; queued.delete(state.nonce); state.nonce++) {
      if (state.refusing || revert.delete(state.nonce)) {
        results.set(state.nonce, "spent");
        continue;
      }
      if (state.seated < roster) state.seated++;
      results.set(state.nonce, { remaining: BigInt(roster - state.seated) });
    }
  };
  const seats: RosterSeats = {
    async nextNonce() {
      execute();
      return state.nonce;
    },
    async send(nonce) {
      if (refuse.delete(nonce)) {
        state.refused++;
        throw new SeatRefused();
      }
      state.sent.push(nonce);
      // An accepted seat the node then drops never executes: every later nonce waits behind it.
      if (lose.delete(nonce) || nonce < state.nonce) return;
      queued.add(nonce);
      state.deepestQueue = Math.max(state.deepestQueue, queued.size);
    },
    async result(nonce) {
      execute();
      return unreadable.has(nonce) ? "missing" : (results.get(nonce) ?? "missing");
    },
  };
  return { seats, state };
}

it("seats a roster with one probe and one window, never queuing more than the window", async () => {
  const { seats, state } = shard(50);
  expect(await seatRoster(seats, 48n)).toBe(50);
  expect(state.seated).toBe(50);
  expect(state.sent).toEqual(Array.from({ length: 50 }, (_, index) => BigInt(index)));
  expect(state.deepestQueue).toBeLessThanOrEqual(48);
});

it("resends a seat the RPC refused before forwarding, at the same nonce", async () => {
  const { seats, state } = shard(24, { refuse: [5n] });
  expect(await seatRoster(seats)).toBe(24);
  expect(state).toMatchObject({ seated: 24, refused: 1, nonce: 24n });
  expect(state.sent.filter((nonce) => nonce === 5n)).toHaveLength(1);
});

it("fills a gap: a seat accepted but never executed is sent again once its successors stall behind it", async () => {
  const { seats, state } = shard(24, { lose: [7n] });
  expect(await seatRoster(seats)).toBe(24);
  expect(state).toMatchObject({ seated: 24, nonce: 24n });
  expect(state.sent.filter((nonce) => nonce === 7n)).toHaveLength(2);
});

it("tops up after a seat reverts mid-window: its nonce is spent and the next round seats the player it missed", async () => {
  const { seats, state } = shard(24, { revert: [3n] });
  expect(await seatRoster(seats)).toBe(25);
  expect(state).toMatchObject({ seated: 24, nonce: 25n });
});

it("an extra seat on a full roster is a no-op, so an unknown last outcome is settled by one more probe", async () => {
  const full = shard(0);
  expect(await seatRoster(full.seats)).toBe(1);
  expect(full.state).toMatchObject({ seated: 0, nonce: 1n });

  // The last seat executed but its receipt never reads: the chain has moved past it, so it counts as spent, and the
  // top-up round's one seat finds the roster full.
  const lastUnread = shard(3, { unreadable: [2n] });
  expect(await seatRoster(lastUnread.seats)).toBe(4);
  expect(lastUnread.state).toMatchObject({ seated: 3, nonce: 4n });
});

it("gives up on a seat the RPC keeps refusing", async () => {
  const { seats } = shard(24);
  const stubborn: RosterSeats = {
    ...seats,
    async send() {
      throw new SeatRefused();
    },
  };
  await expect(seatRoster(stubborn)).rejects.toBeInstanceOf(SeatRefused);
});

it("stops after two rounds that only spend nonces, before anyone is seated, and recovers on the launch's retry", async () => {
  const { seats, state } = shard(24);
  state.refusing = true;
  await expect(seatRoster(seats)).rejects.toThrow("roster_seating_did_not_progress");
  expect(state).toMatchObject({ seated: 0, nonce: 2n });
  state.refusing = false;
  expect(await seatRoster(seats)).toBe(24);
  expect(state).toMatchObject({ seated: 24, nonce: 26n });
});

it("stops after two all-spent rounds once progress was known, spending at most two rounds of nonces", async () => {
  const { seats, state } = shard(5);
  const probe: RosterSeats = {
    ...seats,
    async result(nonce) {
      const result = await seats.result(nonce);
      state.refusing = true;
      return result;
    },
  };
  await expect(seatRoster(probe)).rejects.toThrow("roster_seating_did_not_progress");
  // The probe seated one player and reported 4; two rounds of 4 seats then spent their nonces.
  expect(state).toMatchObject({ seated: 1, nonce: 9n });
  state.refusing = false;
  expect(await seatRoster(seats)).toBe(4);
  expect(state).toMatchObject({ seated: 5, nonce: 13n });
});

it("resumes a crashed run: its queued seats run first, and a gap in them is filled at the chain's next nonce", async () => {
  const restarted = shard(10, { queued: [0n, 1n, 2n, 3n] });
  expect(await seatRoster(restarted.seats)).toBe(6);
  expect(restarted.state).toMatchObject({ seated: 10, nonce: 10n });
  expect(restarted.state.sent).toEqual([4n, 5n, 6n, 7n, 8n, 9n]);

  // The probe fills the gap at 2 and reports 7 unseated, a count taken before the old seats at 3 and 4 ran behind it,
  // so the round sends two seats that find the roster full and seat nobody.
  const gapped = shard(10, { queued: [0n, 1n, 3n, 4n] });
  expect(await seatRoster(gapped.seats)).toBe(8);
  expect(gapped.state).toMatchObject({ seated: 10, nonce: 12n });
  expect(gapped.state.sent).toEqual([2n, 5n, 6n, 7n, 8n, 9n, 10n, 11n]);
});
