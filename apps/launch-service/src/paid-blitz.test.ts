import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { launchPaidBlitz } from "./paid-blitz";
import { RegistrationOpen } from "./blitz-roster";
import type { LaunchGameSummary } from "../../../config/deployer/clean/types";

const fixture = () => {
  const order: string[] = [];
  const summary: LaunchGameSummary = {
    environment: "madara.blitz",
    chain: "madara",
    gameType: "blitz",
    gameName: "paid-game",
    gameId: 7,
    startTime: 100,
    startTimeIso: new Date(100000).toISOString(),
    durationSeconds: 60,
    rpcUrl: "https://shard.test",
    configMode: "batched",
    configSteps: [],
    dryRun: false,
  };
  const shard = {
    create: vi.fn(async () => {
      order.push("create");
      return summary;
    }),
    install: vi.fn(async () => {
      order.push("freeze");
    }),
    seat: vi.fn(async () => {
      order.push("seat");
      return 2;
    }),
    window: async () => ({ start: 105, end: 165 }),
  };
  const value = {
    openBlitz: vi.fn(async () => {
      order.push("open");
    }),
    validateBlitz: vi.fn(async () => {}),
    refundBlitz: vi.fn(async () => null),
  };
  const frozen = {
    gameId: 7,
    blockNumber: 10,
    blockHash: "0xabc",
    registrations: [{ wallet: "0x123", account: "0x456" }],
  };
  let saved: typeof frozen | null = null;
  const rosters = { read: async () => saved, save: async (_key: unknown, row: typeof frozen) => (saved = row) };
  const source = { readClosed: vi.fn(() => Effect.succeed(frozen)) };
  const store = { loadGame: async () => null, saveGame: vi.fn(async (row: LaunchGameSummary) => row) };
  const run = () => launchPaidBlitz("0x1", "paid-game", shard, value, source, rosters, store, 100);
  return { order, shard, value, source, store, run };
};
it("creates an empty shard game before paid registration and installs exactly the pinned ledger pairs", async () => {
  const f = fixture();
  const result = await f.run();
  expect(f.order).toEqual(["create", "open", "freeze", "seat"]);
  expect(f.value.openBlitz).toHaveBeenCalledWith({ chainId: "0x1", gameId: 7 }, { start: 100, end: 160 });
  expect(f.shard.install).toHaveBeenCalledWith(7, [{ wallet: "0x123", account: "0x456" }]);
  expect(result).toMatchObject({ gameId: 7, startTime: 105, finalizeAt: 165, settlementTransactions: 2 });
});
it("keeps the real game key while waiting for registration and reuses the frozen pairs after lost acknowledgments", async () => {
  const f = fixture();
  f.source.readClosed.mockReturnValueOnce(Effect.fail(new RegistrationOpen({ secondsUntilClose: 60 })) as never);
  await expect(f.run()).rejects.toMatchObject({ secondsUntilClose: 60 });
  expect(f.store.saveGame).toHaveBeenCalledWith(expect.objectContaining({ gameId: 7 }));
  expect(f.shard.install).not.toHaveBeenCalled();
  f.shard.install.mockRejectedValueOnce(new Error("lost freeze acknowledgment"));
  await expect(f.run()).rejects.toThrow("lost freeze");
  await f.run();
  expect(f.source.readClosed).toHaveBeenCalledTimes(2);
});
