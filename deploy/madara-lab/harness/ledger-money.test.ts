import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "bun:test";
import { uint256, type Account } from "starknet";
import mainnetAddresses from "../../../contracts/common/addresses/mainnet.json";
import {
  assertLedgerRunConservation,
  buildLedgerSweepPlan,
  estimateLedgerStrkFeeFloor,
  readLedgerBalanceBaselines,
  readLedgerSweepManifest,
  recordLedgerSweepAndAssertConservation,
  writeLedgerSweepManifest,
  type LedgerSweepAccount,
} from "./ledger-money";

describe("ledger harness money path", () => {
  it("holds two register fees plus margin for registration and sweep gas", async () => {
    let estimates = 0;
    let estimateDetails: unknown;
    const account = {
      async estimateInvokeFee(_calls: unknown, details: unknown) {
        estimates += 1;
        estimateDetails = details;
        return { overall_fee: 101n };
      },
    } as unknown as Pick<Account, "estimateInvokeFee">;

    const floor = await estimateLedgerStrkFeeFloor(account, [
      { contractAddress: "0x1", entrypoint: "register", calldata: [] },
    ]);

    expect(floor).toEqual({ estimatedRegisterFee: 101n, requiredStrkFloor: 253n });
    expect(estimates).toBe(1);
    expect(estimateDetails).toEqual({ version: 3, tip: 0 });
  });

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

  it("conserves the pre-finalize pool across payouts, protocol cut, and dust", async () => {
    const accounts = sweepAccounts([
      { owner: "0x1", baseline: 100n },
      { owner: "0x2", baseline: 200n },
    ]);
    const provider = balanceProvider({ "0x1": 500n, "0x2": 800n });
    const sweep = await buildLedgerSweepPlan(provider, "0xlords", accounts, 2);

    expect(
      assertLedgerRunConservation({ poolBeforeFinalization: 1_250n, swept: sweep.amount, protocolCut: 200n, dust: 50n }),
    ).toBe(1_250n);
    expect(() =>
      assertLedgerRunConservation({
        poolBeforeFinalization: 1_251n,
        swept: sweep.amount,
        protocolCut: 200n,
        dust: 50n,
      }),
    ).toThrow("pre-finalize pool 1251, accounted 1250");
  });

  it("records sweep hashes before reporting a conservation failure", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ledger-sweep-receipt-"));
    const manifestPath = path.join(directory, "run.sweep.json");
    try {
      await expect(
        recordLedgerSweepAndAssertConservation(
          manifestPath,
          { amount: 700n, transactionHashes: ["0xsweep"] },
          { poolBeforeFinalization: 1_000n, swept: 700n, protocolCut: 200n, dust: 50n },
        ),
      ).rejects.toThrow("pre-finalize pool 1000, accounted 950");
      const receipts = (await readdir(directory)).filter((name) => name.includes(".receipt-"));
      expect(receipts).toHaveLength(1);
      expect(await Bun.file(path.join(directory, receipts[0]!)).json()).toMatchObject({
        amountBaseUnits: "700",
        transactionHashes: ["0xsweep"],
      });
    } finally {
      await rm(directory, { recursive: true });
    }
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
      "strk:0x1": 3n,
      "strk:0x2": 1n,
    });

    await expect(readLedgerBalanceBaselines(provider, "0xlords", ["0x1", "0x2"], 2n, 2)).rejects.toThrow(
      "Owner 0x2 needs at least 2 STRK fri",
    );
  });

  it("persists the exact recovery baselines before funding", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ledger-sweep-"));
    const manifestPath = path.join(directory, "run.sweep.json");
    try {
      await writeLedgerSweepManifest(manifestPath, {
        accounts: [{ owner: "0x1", preFundLordsBalance: 20n, strkBalance: 3n }],
        chainId: "0x534e5f4d41494e",
        estimatedRegisterFeeFri: "1",
        gameId: 7,
        ledgerAddress: "0x2",
        lordsAddress: "0x3",
        requiredStrkFloorFri: "3",
        treasuryAddress: "0x4",
      });

      const manifest = await readLedgerSweepManifest(manifestPath);
      expect(manifest.accounts[0]).toMatchObject({
        preFundLordsBalanceBaseUnits: "20",
        strkBalanceBaseUnits: "3",
      });
      expect(manifest).toMatchObject({ estimatedRegisterFeeFri: "1", requiredStrkFloorFri: "3", schemaVersion: 2 });
      await expect(
        writeLedgerSweepManifest(manifestPath, {
          accounts: [{ owner: "0x1", preFundLordsBalance: 999n, strkBalance: 3n }],
          chainId: "0x534e5f4d41494e",
          estimatedRegisterFeeFri: "1",
          gameId: 7,
          ledgerAddress: "0x2",
          lordsAddress: "0x3",
          requiredStrkFloorFri: "3",
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
      const token = resolveMockToken(call.contractAddress);
      const balance = balances[`${token}:${owner}`] ?? 0n;
      const value = uint256.bnToUint256(balance);
      return [value.low.toString(), value.high.toString()];
    },
  };
}

function resolveMockToken(address: string): "0xlords" | "strk" {
  if (address === "0xlords") return "0xlords";
  if (BigInt(address) === BigInt(mainnetAddresses.strk)) return "strk";
  throw new Error(`Unexpected token address ${address}`);
}
