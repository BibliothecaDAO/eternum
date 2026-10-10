import { afterEach, beforeEach, expect, it } from "vitest";
import { D1LaunchStore } from "./store";
import { D1SlotStore } from "./slot-store";
import { createLaunchTestDatabase, testChain, TEST_CHAIN } from "./test-database";
let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(() => database.close());
const paid = {
  kind: "paid" as const,
  ledger: { address: "0x10", chainId: "0x534e5f5345504f4c4941", shard: TEST_CHAIN, gameId: 7 },
};
const summary = {
  environment: "madara.blitz" as const,
  chain: "madara" as const,
  gameType: "blitz" as const,
  gameName: "friday-1",
  gameId: 7,
  startTime: 100,
  startTimeIso: new Date(100000).toISOString(),
  durationSeconds: 60,
  rpcUrl: "https://shard.test",
  configMode: "batched" as const,
  configSteps: [],
  dryRun: false,
};
it("serves one immutable ledger opening record to both a slot and the directory before roster freeze", async () => {
  const launches = new D1LaunchStore(database.db, testChain());
  const slots = new D1SlotStore(database.db, launches);
  await slots.create("friday", new Date(Date.now() + 60000).toISOString());
  expect(await slots.list()).toEqual([]);
  await expect(slots.get("friday")).rejects.toThrow("entry");
  await launches.saveGame(summary);
  await launches.saveEntry("madara.blitz", "friday-1", paid);
  expect((await slots.get("friday")).entry).toEqual(paid);
  expect(await launches.playerDirectoryGames()).toEqual([{ chainId: TEST_CHAIN, games: [{ gameId: 7, entry: paid }] }]);
  await launches.saveEntry("madara.blitz", "friday-1", paid);
  await expect(
    launches.saveEntry("madara.blitz", "friday-1", { ...paid, ledger: { ...paid.ledger, address: "0x99" } }),
  ).rejects.toThrow();
});
it("refuses mismatched game keys and keeps free terms explicit", async () => {
  const launches = new D1LaunchStore(database.db, testChain());
  await launches.enqueue("game", { environment: "madara.blitz", gameName: "friday-1" });
  await launches.saveGame(summary);
  await expect(
    launches.saveEntry("madara.blitz", "friday-1", { ...paid, ledger: { ...paid.ledger, gameId: 8 } }),
  ).rejects.toThrow();
  const free = await launches.enqueue("game", { environment: "madara.frontier", gameName: "frontier" });
  expect(free.entry).toEqual({ kind: "free" });
});

it("refuses the legacy free-registration route for a paid slot", async () => {
  const launches = new D1LaunchStore(database.db, testChain());
  const slots = new D1SlotStore(database.db, launches);
  await slots.create("friday", new Date(Date.now() + 60000).toISOString());
  await launches.saveGame(summary);
  await launches.saveEntry("madara.blitz", "friday-1", paid);
  await expect(slots.register("friday", [{ realmsId: "0x1", account: "0x2" }])).rejects.toThrow("ledger");
  expect((await slots.get("friday")).registrations).toEqual([]);
});
it("has no persistent second copy of the ledger roster after migration", async () => {
  expect(
    await database.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='blitz_ledger_rosters'")
      .first(),
  ).toBeNull();
});
