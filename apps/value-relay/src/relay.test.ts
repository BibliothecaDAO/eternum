import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { blitzCommitment } from "./blitz-commitment";
import { runRelay, grantDailyLabor } from "./relay";
import { runMonitor, type MonitorProgress } from "./monitor";
import { frontierPayment } from "./adapters";
import { RelayFailure, type RelayPorts, type ConfirmedBlock, type Withdrawal, type BlitzResult } from "./ports";
import type { RelayStore } from "./state";

const withdrawal: Withdrawal = {
  chainId: "0x1",
  seasonId: 4,
  transactionHash: "0xabc",
  realmsId: "0x2",
  amount: "17",
  confirmedAt: 1000,
};
const result: BlitzResult = {
  chainId: "0x1",
  gameId: 6,
  rows: [],
  commitment: blitzCommitment({ chainId: "0x1", gameId: 6, rows: [] }),
};
const block: ConfirmedBlock = {
  chainId: "0x1",
  number: 0,
  hash: "0xa",
  parentHash: "0x0",
  status: "ACCEPTED_ON_L2",
  withdrawals: [withdrawal],
  results: [result],
};
const fixture = () => {
  let progress = { nextBlock: 0, lastHash: null as string | null, halted: null as string | null };
  const withdrawals = new Map<string, Withdrawal>();
  const results = new Map<number, BlitzResult>();
  const store: RelayStore = {
    progress: async () => progress,
    observe: async (block) => {
      block.withdrawals.forEach((w) => withdrawals.set(w.transactionHash, w));
      block.results.forEach((r) => results.set(r.gameId, r));
      progress = { ...progress, nextBlock: block.number + 1, lastHash: block.hash };
    },
    withdrawals: async () => [...withdrawals.values()],
    results: async () => [...results.values()],
    completeWithdrawal: async (hash) => {
      withdrawals.delete(hash);
    },
    completeResult: async (id) => {
      results.delete(id);
    },
    halt: async (reason) => {
      progress = { ...progress, halted: reason };
    },
  };
  const ports: RelayPorts = {
    shard: {
      confirmedHead: () => Effect.succeed(0),
      block: () => Effect.succeed(block),
      withdrawal: () => Effect.succeed(withdrawal),
      result: () => Effect.succeed(result),
      grantLabor: vi.fn(() => Effect.succeed({ account: "0x3", home: "9", amount: "1000000000000" })),
    },
    identity: {
      payoutWallet: () => Effect.succeed({ status: "ready", address: "0x123" }),
      linkedWallet: () => Effect.succeed("0x123"),
    },
    ledger: {
      pay: vi.fn(() => Effect.void),
      postResult: vi.fn(() => Effect.void),
      paidClaims: () => Effect.succeed({ rows: [{ ...withdrawal, wallet: "0x123" }], next: null }),
      postedResults: () => Effect.succeed({ rows: [result], next: null }),
    },
    realms: { ownerOf: () => Effect.succeed("0x123") },
  };
  return { ports, store, run: () => Effect.runPromise(runRelay("0x1", ports, store)) };
};

describe("confirmed value relay", () => {
  it("advances the cursor once and posts each confirmed obligation", async () => {
    const f = fixture();
    await f.run();
    await f.run();
    expect(await f.store.progress()).toEqual({ nextBlock: 1, lastHash: "0xa", halted: null });
    expect(f.ports.ledger.pay).toHaveBeenCalledTimes(1);
    expect(f.ports.ledger.pay).toHaveBeenCalledWith(withdrawal, "0x123");
    expect(f.ports.ledger.postResult).toHaveBeenCalledTimes(1);
  });
  it("retains withdrawals until a wallet exists and the hold ends, reading the current link each time", async () => {
    const f = fixture();
    f.ports.identity.payoutWallet = () => Effect.succeed({ status: "no_wallet" });
    await f.run();
    f.ports.identity.payoutWallet = () => Effect.succeed({ status: "on_hold", address: "0x123", until: 1000 });
    await f.run();
    expect(f.ports.ledger.pay).not.toHaveBeenCalled();
    expect(await f.store.progress()).toMatchObject({ nextBlock: 1 });
    f.ports.identity.payoutWallet = () => Effect.succeed({ status: "ready", address: "0x456" });
    await f.run();
    expect(f.ports.ledger.pay).toHaveBeenCalledWith(withdrawal, "0x456");
  });
  it("retries a payment after a lost acknowledgment using the withdrawal transaction hash", async () => {
    const f = fixture();
    const paid = new Set<string>();
    let transfers = 0;
    f.ports.ledger.pay = (w) => {
      if (!paid.has(w.transactionHash)) {
        paid.add(w.transactionHash);
        transfers++;
        return Effect.fail(new RelayFailure({ operation: "lost_ack" }));
      }
      return Effect.void;
    };
    await expect(f.run()).rejects.toThrow();
    await f.run();
    expect(transfers).toBe(1);
    expect(await f.store.withdrawals()).toEqual([]);
  });
  it("halts durably before any further payment when a previously observed hash changes", async () => {
    const f = fixture();
    f.ports.identity.payoutWallet = () => Effect.succeed({ status: "no_wallet" });
    await f.run();
    f.ports.shard.block = () => Effect.succeed({ ...block, hash: "0xb" });
    await expect(f.run()).rejects.toThrow();
    expect(await f.store.progress()).toMatchObject({ halted: "confirmed_block_changed:0" });
    expect(await f.run()).toMatchObject({ status: "halted" });
    expect(f.ports.ledger.pay).not.toHaveBeenCalled();
  });
  it.each(["PRE_CONFIRMED", "PRE_ACCEPTED", "REJECTED"])(
    "refuses %s blocks even from a faulty adapter",
    async (status) => {
      const f = fixture();
      f.ports.shard.block = () => Effect.succeed({ ...block, status } as ConfirmedBlock);
      await expect(f.run()).rejects.toThrow();
      expect(f.ports.ledger.pay).not.toHaveBeenCalled();
      expect((await f.store.progress()).halted).toBeTruthy();
    },
  );
  it("checks Realm ownership on every labor claim", async () => {
    const f = fixture();
    const claim = { gameId: 1, home: "9", chainId: "0x1", realmId: "7", day: 20000, realmsId: "0x2", account: "0x3" };
    await Effect.runPromise(grantDailyLabor(f.ports, claim));
    f.ports.realms.ownerOf = () => Effect.succeed("0x456");
    await expect(Effect.runPromise(grantDailyLabor(f.ports, claim))).rejects.toThrow();
    expect(f.ports.shard.grantLabor).toHaveBeenCalledTimes(1);
  });
  it("encodes the published payment interface with exact u256 limbs", async () => {
    const submit = vi.fn(async () => {});
    const pay = frontierPayment(submit);
    await Effect.runPromise(pay({ ...withdrawal, amount: String(2n ** 128n + 5n) }, "0x123"));
    expect(submit).toHaveBeenCalledWith("pay", ["0x1", "4", "0xabc", "0x123", "5", "1"]);
  });
});

describe("independent payout monitor", () => {
  it.each(["missing_receipt", "wrong_amount", "wrong_season", "missing_result", "wrong_commitment"])(
    "pauses on %s",
    async (fault) => {
      const f = fixture();
      if (fault === "missing_receipt") f.ports.shard.withdrawal = () => Effect.succeed(null);
      if (fault === "wrong_amount") f.ports.shard.withdrawal = () => Effect.succeed({ ...withdrawal, amount: "18" });
      if (fault === "wrong_season") f.ports.shard.withdrawal = () => Effect.succeed({ ...withdrawal, seasonId: 5 });
      if (fault === "missing_result") f.ports.shard.result = () => Effect.succeed(null);
      if (fault === "wrong_commitment") f.ports.shard.result = () => Effect.succeed({ ...result, commitment: "0xbad" });
      let progress: MonitorProgress = { halted: null };
      const pause = vi.fn(() => Effect.void);
      const store = {
        load: async () => progress,
        save: async (p: MonitorProgress) => {
          progress = p;
        },
      };
      await Effect.runPromise(runMonitor({ ...f.ports, ledger: { ...f.ports.ledger, pause } }, store));
      expect(progress.halted).toBeTruthy();
      expect(pause).toHaveBeenCalledTimes(1);
    },
  );
  it("retries a failed pause from the persisted stop condition", async () => {
    const f = fixture();
    f.ports.shard.withdrawal = () => Effect.succeed(null);
    let progress: MonitorProgress = { halted: null };
    const pause = vi
      .fn()
      .mockReturnValueOnce(Effect.fail(new RelayFailure({ operation: "pause_failed" })))
      .mockReturnValue(Effect.void);
    const store = {
      load: async () => progress,
      save: async (p: MonitorProgress) => {
        progress = p;
      },
    };
    const monitor = () => Effect.runPromise(runMonitor({ ...f.ports, ledger: { ...f.ports.ledger, pause } }, store));
    await expect(monitor()).rejects.toThrow();
    expect(progress.halted).toBeTruthy();
    await monitor();
    expect(pause).toHaveBeenCalledTimes(2);
  });
  it("does not pause on matching confirmed records", async () => {
    const f = fixture();
    const pause = vi.fn(() => Effect.void);
    const progress: MonitorProgress = { halted: null };
    await Effect.runPromise(
      runMonitor(
        { ...f.ports, ledger: { ...f.ports.ledger, pause } },
        { load: async () => progress, save: async () => {} },
      ),
    );
    expect(pause).not.toHaveBeenCalled();
  });
});

it("detects a parent mismatch before recording or paying the new block", async () => {
  const f = fixture();
  await f.run();
  f.ports.shard.confirmedHead = () => Effect.succeed(1);
  f.ports.shard.block = (number) =>
    Effect.succeed(
      number === 0 ? block : { ...block, number: 1, hash: "0xb", parentHash: "0xc", withdrawals: [], results: [] },
    );
  await expect(f.run()).rejects.toThrow();
  expect(await f.store.progress()).toMatchObject({ nextBlock: 1, halted: "parent_hash_changed:1" });
});
it("stops on a regressed confirmed head before paying pending withdrawals", async () => {
  const f = fixture();
  f.ports.identity.payoutWallet = () => Effect.succeed({ status: "no_wallet" });
  await f.run();
  f.ports.shard.confirmedHead = () => Effect.succeed(-1);
  await expect(f.run()).rejects.toThrow();
  expect(f.ports.ledger.pay).not.toHaveBeenCalled();
});
it("checks later pages and revisits previously checked results on a later monitor pass", async () => {
  const f = fixture();
  const pause = vi.fn(() => Effect.void);
  let progress: MonitorProgress = { halted: null };
  const store = {
    load: async () => progress,
    save: async (p: MonitorProgress) => {
      progress = p;
    },
  };
  f.ports.ledger.postedResults = (cursor) =>
    Effect.succeed(cursor === null ? { rows: [], next: "page2" } : { rows: [result], next: null });
  const monitor = () => Effect.runPromise(runMonitor({ ...f.ports, ledger: { ...f.ports.ledger, pause } }, store));
  await monitor();
  expect(pause).not.toHaveBeenCalled();
  f.ports.shard.result = () => Effect.succeed({ ...result, commitment: "0xbad" });
  await monitor();
  expect(pause).toHaveBeenCalledTimes(1);
});

it("matches the ledger and shard golden commitment vector", () => {
  const rows = ["1000", "1001"].map((wallet) => ({
    wallet,

    rank: 1,
  }));
  expect(blitzCommitment({ chainId: "0x7368617264", gameId: 7, rows })).toBe(
    "0x5d912378a36e87b3b4331c33a3cb97ad23ddfbcab670825f2fa18743f34c6d6",
  );
});
it("halts before storing a result whose payload differs from its commitment", async () => {
  const f = fixture();
  f.ports.shard.block = () => Effect.succeed({ ...block, results: [{ ...result, commitment: "0xbad" }] });
  await expect(f.run()).rejects.toThrow();
  expect(f.ports.ledger.postResult).not.toHaveBeenCalled();
});

it("compares chain and block identities as felts rather than hex spellings", async () => {
  const f = fixture();
  await f.run();
  f.ports.shard.block = () => Effect.succeed({ ...block, chainId: "0x01", hash: "0x0a" });
  expect(await f.run()).toEqual({ status: "ready" });
});

it("does not acknowledge a clock-lagged payment and still delivers other result work", async () => {
  const f = fixture();
  f.ports.ledger.pay = vi.fn(() => Effect.fail(new RelayFailure({ operation: "ledger_clock_behind" })));
  await f.run();
  expect(await f.store.withdrawals()).toHaveLength(1);
  expect(f.ports.ledger.postResult).toHaveBeenCalledOnce();
  f.ports.ledger.pay = vi.fn(() => Effect.void);
  await f.run();
  expect(await f.store.withdrawals()).toEqual([]);
});
