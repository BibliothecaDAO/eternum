import { describe, expect, it } from "bun:test";
import { collectGas, type CollectedTransaction, type TransactionReceiptReader } from "./gas-collector";

const HASH = {
  settle: "0x" + "a".repeat(64),
  move: "0x" + "b".repeat(64),
  revertedExplore: "0x" + "c".repeat(64),
  firstProduce: "0x" + "d".repeat(64),
  retriedProduce: "0x" + "e".repeat(64),
  seasonClose: "0x" + "f".repeat(64),
};

const record = (
  hash: string | undefined,
  stage: CollectedTransaction["stage"],
  kind: string,
  outcome: CollectedTransaction["outcome"],
  actionIndex?: number,
): CollectedTransaction => ({ actionIndex, botId: 1, gameId: 9, kind, outcome, stage, transactionHash: hash });

const receipt = (l2Gas: number, block: number, reverted = false) => ({
  actual_fee: { amount: `0x${(l2Gas * 5).toString(16)}`, unit: "FRI" },
  block_number: block,
  execution_resources: { l1_gas: 0, l1_data_gas: 32, l2_gas: l2Gas },
  execution_status: reverted ? "REVERTED" : "SUCCEEDED",
});

const reader: TransactionReceiptReader = {
  getTransactionReceipt: async (hash) => {
    const receipts: Record<string, unknown> = {
      [HASH.settle]: receipt(1_000, 10),
      [HASH.move]: receipt(300, 11),
      [HASH.revertedExplore]: receipt(200, 11, true),
      [HASH.firstProduce]: receipt(150, 12),
      [HASH.retriedProduce]: receipt(160, 13),
      [HASH.seasonClose]: receipt(700, 20),
    };
    if (!(hash in receipts)) throw new Error("Transaction hash not found");
    return receipts[hash];
  },
};

describe("gas collector", () => {
  it("counts a resubmitted hash once, keeps reverted and retried gas in the totals but shown apart, and puts setup apart", async () => {
    const transactions: CollectedTransaction[] = [
      record(HASH.settle, "setup", "settle", "completed"),
      record(HASH.move, "workload", "move", "completed", 0),
      record(HASH.move, "workload", "move", "completed", 0), // identical resubmission after a reconnect
      record(HASH.revertedExplore, "workload", "explore", "reverted", 1),
      record(HASH.firstProduce, "workload", "produce", "confirmation_timeout", 2),
      record(HASH.retriedProduce, "workload", "produce", "completed", 2), // the same action, resubmitted anew
      record(undefined, "workload", "move", "submit_failed", 3),
      record(HASH.seasonClose, "finalization", "season_close", "completed"),
    ];
    const summary = await collectGas({
      transactions,
      reader,
      node: { blocks: { first: 11, last: 13 }, l2GasConsumed: 810 },
    });

    expect(summary.transactions).toEqual({
      records: 8,
      unique: 6,
      resubmitted: 1,
      receiptsFetched: 6,
      receiptsMissing: 0,
    });
    expect(summary.actions).toEqual({ attempted: 7, completed: 4, rejected: 1, reverted: 1, retried: 1 });
    expect(summary.gas.total.l2Gas).toBe(1_000 + 300 + 200 + 150 + 160 + 700);
    expect(summary.gas.total.transactions).toBe(6);
    expect(summary.gas.total.fee).toBe(String((1_000 + 300 + 200 + 150 + 160 + 700) * 5));
    expect(summary.gas.failed).toMatchObject({ transactions: 1, l2Gas: 200 });
    expect(summary.gas.retried).toMatchObject({ transactions: 1, l2Gas: 160 });
    expect(summary.gas.byStage.setup).toMatchObject({ transactions: 1, l2Gas: 1_000 });
    expect(summary.gas.byStage.workload).toMatchObject({ transactions: 4, l2Gas: 300 + 200 + 150 + 160 });
    expect(summary.gas.byStage.finalization).toMatchObject({ transactions: 1, l2Gas: 700 });
    expect(summary.blocks).toEqual({ first: 10, last: 20 });
    expect(summary.reconciliation).toEqual({
      nodeBlocks: { first: 11, last: 13 },
      nodeL2Gas: 810,
      harnessL2GasInNodeBlocks: 810,
      deltaL2Gas: 0,
      reconciled: true,
    });
  });

  it("reports a hash the node never executed as a missing receipt and an unreconciled window as such", async () => {
    const summary = await collectGas({
      transactions: [
        record(HASH.move, "workload", "move", "completed", 0),
        record("0x" + "9".repeat(64), "workload", "move", "confirmation_timeout", 1),
      ],
      reader,
      node: { blocks: { first: 11, last: 11 }, l2GasConsumed: 345 },
    });
    expect(summary.transactions).toMatchObject({ unique: 2, receiptsFetched: 1, receiptsMissing: 1 });
    expect(summary.reconciliation).toMatchObject({ harnessL2GasInNodeBlocks: 300, deltaL2Gas: 45, reconciled: false });
  });

  it("leaves the reconciliation open when the node reported no window", async () => {
    const summary = await collectGas({ transactions: [record(HASH.move, "workload", "move", "completed", 0)], reader, node: null });
    expect(summary.reconciliation).toEqual({
      nodeBlocks: null,
      nodeL2Gas: null,
      harnessL2GasInNodeBlocks: null,
      deltaL2Gas: null,
      reconciled: null,
    });
  });
});
