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

/**
 * Promise queue that batches transactions by signer and cost category.
 * Transactions in the same category from the same signer are batched together
 * up to the category's limit.
 */
export class PromiseQueue {
  private queue: QueueItem[] = [];
  private processing = false;
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
    if (this.processing) return;

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
          void this.processQueue();
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
      void this.processQueue();
    }, newDelay);
    this.batchTimeoutStartedAt = Date.now();
    this.currentScheduledDelay = newDelay;
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        // Capture all items
        const items = [...this.queue];
        this.queue = [];

        // Group by signer address first
        const signerGroups = new Map<string, QueueItem[]>();
        for (const item of items) {
          const address = (item.transaction.signer as any).address ?? "unknown";
          const group = signerGroups.get(address) || [];
          group.push(item);
          signerGroups.set(address, group);
        }

        // Within each signer group, group by cost category and process
        // categories in parallel, batches within a category sequentially
        for (const [, signerItems] of signerGroups) {
          const categoryGroups = new Map<TransactionCostCategory, QueueItem[]>();

          for (const item of signerItems) {
            const category = getTransactionCategory(item.transaction.transactionType);
            const group = categoryGroups.get(category) || [];
            group.push(item);
            categoryGroups.set(category, group);
          }

          // Parallel across categories, sequential within each category
          await Promise.allSettled(
            Array.from(categoryGroups.entries()).map(async ([category, group]) => {
              const batchLimit = CATEGORY_BATCH_LIMITS[category];

              // Split into chunks based on category batch limit
              for (let i = 0; i < group.length; i += batchLimit) {
                await this.processBatch(group.slice(i, i + batchLimit));
              }
            }),
          );
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a batch of queue items as a single multicall transaction.
   */
  private async processBatch(batch: QueueItem[]) {
    if (batch.length === 0) return;

    if (batch.length === 1) {
      const { transaction, resolve, reject } = batch[0];
      try {
        const result = await this.executor.executeAndCheckTransaction(
          transaction.signer,
          transaction.calls,
          undefined,
          {
            waitForConfirmation: false,
            transactionType: transaction.transactionType,
          },
        );
        resolve(result);
      } catch (error) {
        reject(error);
      }
    } else {
      // Multiple transactions - batch them together
      try {
        const allCalls = batch.map(({ transaction }) => {
          const calls = transaction.calls;
          return Array.isArray(calls) ? calls : [calls];
        });

        // Flatten all calls into a single array
        const flattenedCalls = allCalls.flat();

        // Get signer from first item
        const signer = batch[0].transaction.signer;

        // Collect batch details - count by transaction type
        const typeCounts = new Map<TransactionType, number>();
        batch.forEach((item) => {
          if (item.transaction.transactionType) {
            typeCounts.set(
              item.transaction.transactionType,
              (typeCounts.get(item.transaction.transactionType) || 0) + 1,
            );
          }
        });

        const batchDetails: BatchedTransactionDetail[] = Array.from(typeCounts.entries()).map(([type, count]) => ({
          type,
          count,
        }));

        // Execute the batched transaction with batch details
        const result = await this.executor.executeAndCheckTransaction(signer, flattenedCalls, batchDetails, {
          waitForConfirmation: false,
        });

        // Resolve all promises with the result
        batch.forEach((item) => item.resolve(result));
      } catch (error) {
        // Reject all promises in the batch
        batch.forEach((item) => item.reject(error));
      }
    }
  }
}
