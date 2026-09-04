import { Account, AccountInterface, AllowArray, Call } from "starknet";
import {
  BatchDelayConfig,
  CATEGORY_BATCH_LIMITS,
  getDelayForTransaction,
  getTransactionCategory,
  TransactionCostCategory,
} from "./batch-config";
import { TransactionExecutor } from "./transaction-executor";
import { BatchedTransactionDetail, TransactionType } from "./types";

/**
 * A transaction that can be enqueued for batched execution.
 */
export interface QueueableTransaction {
  signer: Account | AccountInterface;
  calls: AllowArray<Call>;
  transactionType?: TransactionType;
}

interface QueueItem {
  transaction: QueueableTransaction;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

const asCallArray = (calls: AllowArray<Call>): Call[] => (Array.isArray(calls) ? calls : [calls]);

const ISOLATED_CONSTRUCTION_TRANSACTION_TYPES = new Set<TransactionType>([TransactionType.DESTROY_BUILDING]);

const hasVrfRequestRandomCall = (transaction: QueueableTransaction): boolean =>
  asCallArray(transaction.calls).some((call) => call.entrypoint === "request_random");

const isConstructionWriteTransaction = (transaction: QueueableTransaction): boolean =>
  Boolean(transaction.transactionType && ISOLATED_CONSTRUCTION_TRANSACTION_TYPES.has(transaction.transactionType));

const shouldSubmitIndividually = (item: QueueItem): boolean =>
  item.transaction.transactionType === TransactionType.EXPLORE ||
  hasVrfRequestRandomCall(item.transaction) ||
  isConstructionWriteTransaction(item.transaction);

/**
 * Sensitive submissions never merge with others:
 * - VRF request_random calls must stay paired with exactly one consumer.
 * - Building destruction must not let one rejected slot roll back unrelated
 *   construction calls in the same multicall.
 */
const splitBatchForSubmission = (batch: QueueItem[]): QueueItem[][] => {
  const submissionBatches: QueueItem[][] = [];
  let currentSharedBatch: QueueItem[] = [];

  for (const item of batch) {
    if (shouldSubmitIndividually(item)) {
      if (currentSharedBatch.length > 0) {
        submissionBatches.push(currentSharedBatch);
        currentSharedBatch = [];
      }
      submissionBatches.push([item]);
      continue;
    }

    currentSharedBatch.push(item);
  }

  if (currentSharedBatch.length > 0) {
    submissionBatches.push(currentSharedBatch);
  }

  return submissionBatches;
};

const signerAddressOf = (item: QueueItem): string =>
  (item.transaction.signer as { address?: string }).address ?? "unknown";

const categoryOf = (item: QueueItem): TransactionCostCategory =>
  getTransactionCategory(item.transaction.transactionType);

const groupBy = <K>(items: QueueItem[], keyOf: (item: QueueItem) => K): QueueItem[][] => {
  const groups = new Map<K, QueueItem[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
};

const chunk = (items: QueueItem[], size: number): QueueItem[][] => {
  const chunks: QueueItem[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

/** One multicall per signer and cost category, capped by the category's batch limit. */
const buildSubmissionBatches = (items: QueueItem[]): QueueItem[][] =>
  groupBy(items, signerAddressOf).flatMap((signerItems) =>
    groupBy(signerItems, categoryOf).flatMap((categoryItems) =>
      chunk(categoryItems, CATEGORY_BATCH_LIMITS[categoryOf(categoryItems[0])]).flatMap(splitBatchForSubmission),
    ),
  );

const countByTransactionType = (batch: QueueItem[]): BatchedTransactionDetail[] => {
  const counts = new Map<TransactionType, number>();
  for (const { transaction } of batch) {
    if (transaction.transactionType) {
      counts.set(transaction.transactionType, (counts.get(transaction.transactionType) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count }));
};

/**
 * Promise queue that batches transactions by signer and cost category.
 * Transactions in the same category from the same signer are batched together
 * up to the category's limit.
 */
export class PromiseQueue {
  private queue: QueueItem[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private batchTimeoutStartedAt: number = 0;
  private currentScheduledDelay: number = Infinity;
  private readonly flatDelay: number | undefined;
  private readonly delayConfig: BatchDelayConfig | undefined;

  constructor(
    private executor: TransactionExecutor,
    options?: { batchDelayMs?: number; batchDelayConfig?: BatchDelayConfig },
  ) {
    if (options?.batchDelayConfig) {
      this.delayConfig = options.batchDelayConfig;
    } else if (options?.batchDelayMs !== undefined) {
      this.flatDelay = options.batchDelayMs;
    } else {
      // Default: flat 1000ms (backward compatibility)
      this.flatDelay = 1000;
    }
  }

  /**
   * Enqueue a transaction for batched execution.
   */
  async enqueue<T>(transaction: QueueableTransaction): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ transaction, resolve, reject });
      this.scheduleProcessing(transaction.transactionType);
    });
  }

  private getDelay(transactionType?: TransactionType): number {
    if (this.delayConfig) {
      return getDelayForTransaction(transactionType, this.delayConfig);
    }
    return this.flatDelay ?? 1000;
  }

  private scheduleProcessing(transactionType?: TransactionType) {
    const newDelay = this.getDelay(transactionType);

    if (this.batchTimeout) {
      // A timer is already running. Check if the new item wants a shorter delay.
      const elapsed = Date.now() - this.batchTimeoutStartedAt;
      const remaining = Math.max(0, this.currentScheduledDelay - elapsed);

      if (newDelay < remaining) {
        // Reschedule with the shorter delay
        clearTimeout(this.batchTimeout);
        this.batchTimeout = setTimeout(() => {
          this.batchTimeout = null;
          this.processQueue();
        }, newDelay);
        this.batchTimeoutStartedAt = Date.now();
        this.currentScheduledDelay = newDelay;
      }
      // Otherwise keep existing timer
      return;
    }

    // No timer running — start one
    this.batchTimeout = setTimeout(() => {
      this.batchTimeout = null;
      this.processQueue();
    }, newDelay);
    this.batchTimeoutStartedAt = Date.now();
    this.currentScheduledDelay = newDelay;
  }

  /**
   * Batches fire without waiting on each other: one action's sign+send round
   * trip must not delay the next action's signing. Nonce order across
   * in-flight batches is the account layer's job, and same-explorer explores
   * still serialise inside the executor.
   */
  private processQueue() {
    const items = this.queue;
    this.queue = [];
    for (const batch of buildSubmissionBatches(items)) {
      void this.submitBatch(batch);
    }
  }

  private async submitBatch(batch: QueueItem[]) {
    try {
      const result =
        batch.length === 1 ? await this.submitSingle(batch[0].transaction) : await this.submitMulticall(batch);
      batch.forEach((item) => item.resolve(result));
    } catch (error) {
      batch.forEach((item) => item.reject(error));
    }
  }

  private submitSingle(transaction: QueueableTransaction) {
    return this.executor.executeAndCheckTransaction(transaction.signer, transaction.calls, undefined, {
      waitForConfirmation: false,
      transactionType: transaction.transactionType,
    });
  }

  private submitMulticall(batch: QueueItem[]) {
    const signer = batch[0].transaction.signer;
    const calls = batch.flatMap(({ transaction }) => asCallArray(transaction.calls));
    return this.executor.executeAndCheckTransaction(signer, calls, countByTransactionType(batch), {
      waitForConfirmation: false,
    });
  }
}
