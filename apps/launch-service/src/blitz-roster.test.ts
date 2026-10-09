import { Effect } from "effect";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { D1BlitzRosterStore, freezeBlitzRoster, RosterFailure } from "./blitz-roster";
import { createLaunchTestDatabase } from "./test-database";

let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  await database.close();
});
const key = { chainId: "0x1", gameName: "blitz-ledger-1" };
const roster = {
  gameId: 7,
  blockNumber: 10,
  blockHash: "0xabc",
  registrations: [{ wallet: "0x123", account: "0x456" }],
};

it("freezes one confirmed ledger roster and preserves the wallet/account mapping through a restart", async () => {
  const readClosed = vi.fn(() => Effect.succeed(roster));
  const store = new D1BlitzRosterStore(database.db);
  const first = await Effect.runPromise(freezeBlitzRoster(key, { readClosed }, store));
  readClosed.mockReturnValue(Effect.succeed({ ...roster, registrations: [] }));
  const second = await Effect.runPromise(freezeBlitzRoster(key, { readClosed }, new D1BlitzRosterStore(database.db)));
  expect(second).toEqual(first);
  expect(readClosed).toHaveBeenCalledTimes(1);
});
it("has no local-roster fallback when the ledger interface is missing", async () => {
  const store = new D1BlitzRosterStore(database.db);
  await expect(
    Effect.runPromise(
      freezeBlitzRoster(
        key,
        {
          readClosed: () => Effect.fail(new RosterFailure({ operation: "game_key_reservation_interface_unavailable" })),
        },
        store,
      ),
    ),
  ).rejects.toThrow();
  expect(await store.read(key)).toBeNull();
});
it("refuses aliases that duplicate either a wallet or its gameplay account", async () => {
  for (const registrations of [
    [...roster.registrations, { wallet: "0x0123", account: "0x999" }],
    [...roster.registrations, { wallet: "0x999", account: "0x0456" }],
  ]) {
    await expect(
      Effect.runPromise(
        freezeBlitzRoster(
          key,
          { readClosed: () => Effect.succeed({ ...roster, registrations }) },
          new D1BlitzRosterStore(database.db),
        ),
      ),
    ).rejects.toThrow();
  }
});
it("separates identically named games on different shard chains", async () => {
  const store = new D1BlitzRosterStore(database.db);
  await Effect.runPromise(freezeBlitzRoster(key, { readClosed: () => Effect.succeed(roster) }, store));
  const other = { ...roster, registrations: [{ wallet: "0x987", account: "0x654" }] };
  expect(
    await Effect.runPromise(
      freezeBlitzRoster({ ...key, chainId: "0x2" }, { readClosed: () => Effect.succeed(other) }, store),
    ),
  ).toEqual(other);
});
