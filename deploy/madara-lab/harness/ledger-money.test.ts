import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "bun:test";
import { uint256, type Account } from "starknet";
import {
  assertLedgerRunConservation,
  buildLedgerSweepPlan,
  readLedgerBalanceBaselines,
  readLedgerSweepManifest,
  writeLedgerSweepManifest,
  type LedgerSweepAccount,
} from "./ledger-money";

describe("ledger harness money path", () => {
  it("derives the recoverable treasury float from immutable pre-fund baselines", async () => {
    const accounts = sweepAccounts([
      { owner: "0x1", baseline: 100n },
      { owner: "0x2", baseline: 200n },
    ]);
    const provider = balanceProvider({ "0x1": 600n, "0x2": 700n });

    const plan = await buildLedgerSweepPlan(provider, "0xlords", accounts, 2);

    expect(plan.entries.map(({ amount }) => amount)).toEqual([500n, 500n]);
    expect(plan.amount).toBe(1_000n);
  });

  it("conserves funded LORDS across payouts, protocol cut, and dust", async () => {
    const accounts = sweepAccounts([
      { owner: "0x1", baseline: 100n },
      { owner: "0x2", baseline: 200n },
    ]);
    const provider = balanceProvider({ "0x1": 500n, "0x2": 800n });
    const sweep = await buildLedgerSweepPlan(provider, "0xlords", accounts, 2);

    expect(assertLedgerRunConservation({ funded: 1_250n, swept: sweep.amount, protocolCut: 200n, dust: 50n })).toBe(
      1_250n,
    );
    expect(() =>
      assertLedgerRunConservation({ funded: 1_251n, swept: sweep.amount, protocolCut: 200n, dust: 50n }),
    ).toThrow("funded 1251, returned 1250");
  });

  it("refuses to sweep when an owner fell below the recorded baseline", async () => {
    const accounts = sweepAccounts([{ owner: "0x1", baseline: 100n }]);
    await expect(buildLedgerSweepPlan(balanceProvider({ "0x1": 99n }), "0xlords", accounts, 1)).rejects.toThrow(
      "balance fell below its pre-fund baseline",
    );
  });

  it("checks every owner for STRK before any LORDS funding can start", async () => {
    const provider = tokenBalanceProvider({
      "0xlords:0x1": 20n,
      "0xlords:0x2": 30n,
      "strk:0x1": 1n,
      "strk:0x2": 0n,
    });

    await expect(readLedgerBalanceBaselines(provider, "0xlords", ["0x1", "0x2"], 2)).rejects.toThrow(
      "Owner 0x2 has no STRK",
    );
  });

  it("persists the exact recovery baselines before funding", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ledger-sweep-"));
    const manifestPath = path.join(directory, "run.sweep.json");
    try {
      await writeLedgerSweepManifest(manifestPath, {
        accounts: [{ owner: "0x1", preFundLordsBalance: 20n, strkBalance: 3n }],
        chainId: "0x534e5f4d41494e",
        gameId: 7,
        ledgerAddress: "0x2",
        lordsAddress: "0x3",
        treasuryAddress: "0x4",
      });

      const manifest = await readLedgerSweepManifest(manifestPath);
      expect(manifest.accounts[0]).toMatchObject({
        preFundLordsBalanceBaseUnits: "20",
        strkBalanceBaseUnits: "3",
      });
      await expect(
        writeLedgerSweepManifest(manifestPath, {
          accounts: [{ owner: "0x1", preFundLordsBalance: 999n, strkBalance: 3n }],
          chainId: "0x534e5f4d41494e",
          gameId: 7,
          ledgerAddress: "0x2",
          lordsAddress: "0x3",
          treasuryAddress: "0x4",
        }),
      ).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});

function sweepAccounts(values: Array<{ baseline: bigint; owner: string }>): LedgerSweepAccount[] {
  return values.map(({ baseline, owner }) => ({
    account: {} as Account,
    owner,
    preFundLordsBalance: baseline,
  }));
}

function balanceProvider(balances: Record<string, bigint>) {
  return tokenBalanceProvider(Object.fromEntries(Object.entries(balances).map(([owner, balance]) => [`0xlords:${owner}`, balance])));
}

function tokenBalanceProvider(balances: Record<string, bigint>) {
  return {
    async callContract(call: { calldata: string[]; contractAddress: string }) {
      const owner = call.calldata[0]!;
      const token = call.contractAddress === "0xlords" ? "0xlords" : "strk";
      const balance = balances[`${token}:${owner}`] ?? 0n;
      const value = uint256.bnToUint256(balance);
      return [value.low.toString(), value.high.toString()];
    },
  };
}
