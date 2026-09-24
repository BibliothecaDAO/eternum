import { mapWithConcurrency } from "./account-factory";
import type { TrackedTransaction, TransactionStage } from "./driver";

/**
 * The gas and resource collector: runs once after the measurement window, from the recorded transaction hashes, and
 * writes one machine-readable summary. Receipts are fetched here, never on the timed path, so a run's latency figures
 * carry no receipt round trips.
 */

export interface TransactionReceiptReader {
  getTransactionReceipt(transactionHash: string): Promise<unknown>;
}

/** What one receipt contributes: the L3's own gas figures and the fee, as the node reports them. */
interface TransactionGas {
  blockNumber: number | null;
  executionStatus: "SUCCEEDED" | "REVERTED";
  feeWei: bigint;
  l1DataGas: number;
  l1Gas: number;
  l2Gas: number;
  /** Cairo steps and builtin applications when the node's receipts carry them; null when they do not. */
  steps: number | null;
  builtins: Record<string, number> | null;
}

export interface GasTotals {
  transactions: number;
  l2Gas: number;
  l1Gas: number;
  l1DataGas: number;
  /** Sum of `actual_fee`, in the fee unit's smallest denomination, as a decimal string because it exceeds 2^53. */
  fee: string;
}

export interface GasSummary {
  transactions: {
    /** Tracked records, including identical resubmissions of one hash. */
    records: number;
    /** Distinct hashes: an identical resubmission is one transaction. */
    unique: number;
    resubmitted: number;
    receiptsFetched: number;
    /** Hashes the node has no receipt for (never admitted, or dropped). */
    receiptsMissing: number;
  };
  actions: {
    attempted: number;
    completed: number;
    /** Refused before execution: no receipt, no gas. */
    rejected: number;
    /** Executed and reverted: gas paid, counted in the totals and shown apart. */
    reverted: number;
    /** Later attempts of an action already submitted once: counted in the totals and shown apart. */
    retried: number;
  };
  gas: {
    total: GasTotals;
    failed: GasTotals;
    retried: GasTotals;
    byStage: Record<TransactionStage, GasTotals>;
  };
  blocks: { first: number | null; last: number | null };
  /**
   * Cairo steps and builtins per action kind, from the receipts. Unavailable, never zero, when the run executed
   * natively (native execution reports no steps) or when the node's receipts carry no step counters at all.
   */
  resources: { available: false; reason: string } | { available: true; byKind: Record<string, KindResources> };
  /** The harness's gas inside the node's reported block range against the node's close-block total for it. */
  reconciliation: {
    nodeBlocks: { first: number; last: number } | null;
    nodeL2Gas: number | null;
    harnessL2GasInNodeBlocks: number | null;
    deltaL2Gas: number | null;
    reconciled: boolean | null;
  };
}

/** The recorded facts the collector needs; every tracked transaction carries them. */
export type CollectedTransaction = Pick<
  TrackedTransaction,
  "actionIndex" | "botId" | "gameId" | "kind" | "outcome" | "stage" | "tick" | "transactionHash"
>;

interface NodeGasWindow {
  blocks: { first: number | null; last: number | null };
  l2GasConsumed: number;
}

export interface KindResources {
  transactions: number;
  steps: number;
  builtins: Record<string, number>;
}

export interface CollectGasOptions {
  transactions: readonly CollectedTransaction[];
  reader: TransactionReceiptReader;
  node: NodeGasWindow | null;
  /** Whether the node executed natively during the run, as the host state records it; null when unknown. */
  nativeExecution: boolean | null;
  concurrency?: number;
}

const STAGES: TransactionStage[] = ["setup", "workload", "finalization"];

export async function collectGas(options: CollectGasOptions): Promise<GasSummary> {
  const hashes = [...new Set(options.transactions.flatMap((record) => record.transactionHash ?? []))];
  const receipts = await readTransactionGas(options.reader, hashes, options.concurrency);
  return summarizeGas(options.transactions, receipts, options.node, options.nativeExecution);
}

/** Reads every receipt once, after the window; a missing receipt is recorded as null, never as zero gas. */
async function readTransactionGas(
  reader: TransactionReceiptReader,
  hashes: readonly string[],
  concurrency = 8,
): Promise<Map<string, TransactionGas | null>> {
  const entries = await mapWithConcurrency(hashes, concurrency, async (hash) => {
    try {
      return [hash, parseTransactionGas(await reader.getTransactionReceipt(hash))] as const;
    } catch (error) {
      if (isTransactionMissing(error)) return [hash, null] as const;
      throw error;
    }
  });
  return new Map(entries);
}

/** Fills the block each accepted transaction landed in, for the drills that need it after their own steps. */
export async function attachAcceptedBlocks(
  reader: TransactionReceiptReader,
  transactions: TrackedTransaction[],
): Promise<void> {
  const accepted = transactions.filter(
    (transaction) => transaction.outcome === "completed" && transaction.transactionHash !== undefined,
  );
  const receipts = await readTransactionGas(
    reader,
    accepted.map((transaction) => transaction.transactionHash!),
  );
  for (const transaction of accepted) {
    const block = receipts.get(transaction.transactionHash!)?.blockNumber;
    if (block !== null && block !== undefined) transaction.acceptedOnL2Block = block;
  }
}

function summarizeGas(
  transactions: readonly CollectedTransaction[],
  receipts: ReadonlyMap<string, TransactionGas | null>,
  node: NodeGasWindow | null,
  nativeExecution: boolean | null,
): GasSummary {
  const attempts = dropIdenticalResubmissions(transactions);
  const retried = new Set(laterAttemptsOfSameAction(attempts));
  const totals = {
    total: emptyTotals(),
    failed: emptyTotals(),
    retried: emptyTotals(),
    byStage: Object.fromEntries(STAGES.map((stage) => [stage, emptyTotals()])) as Record<TransactionStage, MutableTotals>,
  };
  const blocks: number[] = [];
  let receiptsFetched = 0;
  let receiptsMissing = 0;
  for (const record of attempts) {
    if (record.transactionHash === undefined) continue;
    const gas = receipts.get(record.transactionHash);
    if (!gas) {
      receiptsMissing += 1;
      continue;
    }
    receiptsFetched += 1;
    if (gas.blockNumber !== null) blocks.push(gas.blockNumber);
    add(totals.total, gas);
    add(totals.byStage[record.stage], gas);
    if (gas.executionStatus === "REVERTED") add(totals.failed, gas);
    if (retried.has(record)) add(totals.retried, gas);
  }
  const nodeBlocks =
    node && node.blocks.first !== null && node.blocks.last !== null
      ? { first: node.blocks.first, last: node.blocks.last }
      : null;
  const harnessInNodeBlocks = nodeBlocks
    ? attempts.reduce((sum, record) => {
        const gas = record.transactionHash === undefined ? null : receipts.get(record.transactionHash);
        const inside =
          gas?.blockNumber !== null &&
          gas?.blockNumber !== undefined &&
          gas.blockNumber >= nodeBlocks.first &&
          gas.blockNumber <= nodeBlocks.last;
        return inside ? sum + gas.l2Gas : sum;
      }, 0)
    : null;
  return {
    transactions: {
      records: transactions.length,
      unique: receiptsFetched + receiptsMissing,
      resubmitted: transactions.length - attempts.length,
      receiptsFetched,
      receiptsMissing,
    },
    actions: {
      attempted: attempts.length,
      completed: attempts.filter((record) => record.outcome === "completed").length,
      rejected: attempts.filter((record) => record.outcome === "rejected" || record.outcome === "submit_failed").length,
      reverted: attempts.filter((record) => record.outcome === "reverted").length,
      retried: retried.size,
    },
    gas: {
      total: finish(totals.total),
      failed: finish(totals.failed),
      retried: finish(totals.retried),
      byStage: Object.fromEntries(STAGES.map((stage) => [stage, finish(totals.byStage[stage])])) as Record<
        TransactionStage,
        GasTotals
      >,
    },
    blocks: { first: blocks.length ? Math.min(...blocks) : null, last: blocks.length ? Math.max(...blocks) : null },
    resources: summarizeResources(attempts, receipts, nativeExecution),
    reconciliation: {
      nodeBlocks,
      nodeL2Gas: node?.l2GasConsumed ?? null,
      harnessL2GasInNodeBlocks: harnessInNodeBlocks,
      deltaL2Gas: node && harnessInNodeBlocks !== null ? node.l2GasConsumed - harnessInNodeBlocks : null,
      reconciled: node && harnessInNodeBlocks !== null ? node.l2GasConsumed === harnessInNodeBlocks : null,
    },
  };
}

function summarizeResources(
  attempts: readonly CollectedTransaction[],
  receipts: ReadonlyMap<string, TransactionGas | null>,
  nativeExecution: boolean | null,
): GasSummary["resources"] {
  if (nativeExecution) return { available: false, reason: "native execution reports no Cairo steps or builtins" };
  const executed = attempts.flatMap((record) => {
    const gas = record.transactionHash === undefined ? null : receipts.get(record.transactionHash);
    return gas ? [{ record, gas }] : [];
  });
  if (executed.length === 0) return { available: false, reason: "no executed transaction to read" };
  // A receipt without counters, or with zero steps, is a node that does not report them, never a free transaction.
  if (executed.some(({ gas }) => gas.steps === null || gas.steps === 0 || gas.builtins === null)) {
    return { available: false, reason: "the node's receipts carry no Cairo step or builtin counters" };
  }
  const byKind: Record<string, KindResources> = {};
  for (const { record, gas } of executed) {
    const kind = (byKind[record.kind] ??= { transactions: 0, steps: 0, builtins: {} });
    kind.transactions += 1;
    kind.steps += gas.steps!;
    for (const [builtin, count] of Object.entries(gas.builtins!)) kind.builtins[builtin] = (kind.builtins[builtin] ?? 0) + count;
  }
  return { available: true, byKind };
}

/** The same hash recorded twice is one transaction the node executed once; the first record keeps its place. */
function dropIdenticalResubmissions(transactions: readonly CollectedTransaction[]): CollectedTransaction[] {
  const seen = new Set<string>();
  return transactions.filter((record) => {
    if (record.transactionHash === undefined) return true;
    if (seen.has(record.transactionHash)) return false;
    seen.add(record.transactionHash);
    return true;
  });
}

/** An action submitted again under a new hash is a retry: every attempt after the first, in record order. */
function laterAttemptsOfSameAction(attempts: readonly CollectedTransaction[]): CollectedTransaction[] {
  const seen = new Set<string>();
  return attempts.filter((record) => {
    const key = actionKey(record);
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}

const actionKey = (record: CollectedTransaction): string =>
  [record.gameId, record.botId, record.stage, record.kind, record.actionIndex ?? "", record.tick ?? ""].join(":");

interface MutableTotals {
  transactions: number;
  l2Gas: number;
  l1Gas: number;
  l1DataGas: number;
  fee: bigint;
}

const emptyTotals = (): MutableTotals => ({ transactions: 0, l2Gas: 0, l1Gas: 0, l1DataGas: 0, fee: 0n });

function add(totals: MutableTotals, gas: TransactionGas): void {
  totals.transactions += 1;
  totals.l2Gas += gas.l2Gas;
  totals.l1Gas += gas.l1Gas;
  totals.l1DataGas += gas.l1DataGas;
  totals.fee += gas.feeWei;
}

const finish = (totals: MutableTotals): GasTotals => ({ ...totals, fee: totals.fee.toString() });

/** A receipt as the RPC returns it (v0.8 and later): resources per gas kind, the fee, the status and the block. */
function parseTransactionGas(receipt: unknown): TransactionGas {
  const record = receipt as {
    actual_fee?: { amount?: string };
    block_number?: number;
    execution_resources?: ExecutionResources;
    execution_status?: string;
    transaction_hash?: string;
  };
  const resources = record.execution_resources;
  if (!resources || typeof resources.l2_gas !== "number") {
    throw new Error(`Receipt ${record.transaction_hash ?? "?"} reports no l2_gas; the node is older than RPC v0.8`);
  }
  // A fee-free shard reports a zero fee; a receipt without one, or without its L1 gas, is malformed, never zero.
  const fee = record.actual_fee?.amount;
  if (fee === undefined || typeof resources.l1_gas !== "number" || typeof resources.l1_data_gas !== "number") {
    throw new Error(`Receipt ${record.transaction_hash ?? "?"} lacks its fee or L1 gas`);
  }
  return {
    blockNumber: Number.isSafeInteger(record.block_number) ? record.block_number! : null,
    executionStatus: record.execution_status === "REVERTED" ? "REVERTED" : "SUCCEEDED",
    feeWei: BigInt(fee),
    l1DataGas: resources.l1_data_gas,
    l1Gas: resources.l1_gas,
    l2Gas: resources.l2_gas,
    ...parseComputation(resources),
  };
}

/** RPC v0.8 and later report gas only; a node that still lists steps and `<name>_builtin_applications` is read too. */
interface ExecutionResources {
  l1_gas?: number;
  l1_data_gas?: number;
  l2_gas?: number;
  steps?: number;
  computation_resources?: { steps?: number; [counter: string]: unknown };
  [counter: string]: unknown;
}

function parseComputation(resources: ExecutionResources): Pick<TransactionGas, "steps" | "builtins"> {
  const source = resources.computation_resources ?? resources;
  if (typeof source.steps !== "number") return { steps: null, builtins: null };
  const builtins: Record<string, number> = {};
  for (const [counter, count] of Object.entries(source)) {
    if (counter.endsWith("_builtin_applications") && typeof count === "number") {
      builtins[counter.slice(0, -"_builtin_applications".length)] = count;
    }
  }
  return { steps: source.steps, builtins };
}

const isTransactionMissing = (error: unknown): boolean =>
  /transaction hash not found|TXN_HASH_NOT_FOUND|29/i.test(error instanceof Error ? error.message : String(error));
