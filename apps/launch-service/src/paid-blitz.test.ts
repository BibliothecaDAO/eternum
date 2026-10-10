import { expect, it, vi } from "vitest";
import { launchPaidBlitz } from "./paid-blitz";
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
    roster: vi.fn(async () => [] as { wallet: string; account: string }[]),
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
    blitzDeadline: vi.fn(async () => 60),
    blitzRoster: vi.fn(async () => ({ ...frozen, secondsUntilClose: 0, end: 160 })),
    openBlitz: vi.fn(async () => {
      order.push("open");
      return {
        kind: "paid" as const,
        ledger: { address: "0x10", chainId: "0x2", shard: "0x1", gameId: 7 },
      };
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
  const store = {
    saveEntry: vi.fn(async () => {
      order.push("terms");
    }),
    loadGame: async () => null,
    saveGame: vi.fn(async (row: LaunchGameSummary) => row),
  };
  const run = () => launchPaidBlitz("0x1", shard, value, store, 100);
  return { order, shard, value, store, run };
};
it("creates an empty shard game before paid registration and installs exactly the pinned ledger pairs", async () => {
  const f = fixture();
  const result = await f.run();
  expect(f.order).toEqual(["create", "open", "terms", "freeze", "seat"]);
  expect(f.value.openBlitz).toHaveBeenCalledWith({ chainId: "0x1", gameId: 7 }, { start: 100, end: 160 });
  expect(f.shard.install).toHaveBeenCalledWith(7, [{ wallet: "0x123", account: "0x456" }]);
  expect(result).toMatchObject({ gameId: 7, startTime: 105, finalizeAt: 165, settlementTransactions: 2 });
});
it("keeps the real game key while waiting for registration and reuses the frozen pairs after lost acknowledgments", async () => {
  const f = fixture();
  f.value.blitzRoster.mockResolvedValueOnce({
    gameId: 7,
    blockNumber: 10,
    blockHash: "0xabc",
    secondsUntilClose: 60,
    end: 160,
    registrations: [],
  });
  await expect(f.run()).rejects.toMatchObject({ secondsUntilClose: 60 });
  expect(f.store.saveGame).toHaveBeenCalledWith(expect.objectContaining({ gameId: 7 }));
  expect(f.shard.install).not.toHaveBeenCalled();
  expect(f.store.saveEntry).toHaveBeenCalledWith(
    "madara.blitz",
    "paid-game",
    expect.objectContaining({ kind: "paid" }),
  );
  f.shard.install.mockRejectedValueOnce(new Error("lost freeze acknowledgment"));
  await expect(f.run()).rejects.toThrow("lost freeze");
  await f.run();
  expect(f.value.blitzRoster).toHaveBeenCalledTimes(3);
});

it("does not declare paid terms until the ledger opening confirms", async () => {
  const f = fixture();
  f.value.openBlitz.mockRejectedValueOnce(new Error("ledger unavailable"));
  await expect(f.run()).rejects.toThrow("ledger unavailable");
  expect(f.store.saveGame).toHaveBeenCalled();
  expect(f.store.saveEntry).not.toHaveBeenCalled();
  expect(f.shard.install).not.toHaveBeenCalled();
});
it("resumes the roster stored on the shard without reading a D1 or ledger copy", async () => {
  const f = fixture();
  Object.assign(f.shard, { roster: async () => [{ wallet: "0x123", account: "0x456" }] });
  f.value.blitzRoster.mockRejectedValue(new Error("ledger unavailable"));
  await f.run();
  expect(f.value.blitzRoster).not.toHaveBeenCalled();
  expect(f.shard.install).not.toHaveBeenCalled();
});
