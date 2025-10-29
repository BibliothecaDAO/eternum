import type { AllowArray, Call } from "starknet";
import type { EternumProvider } from "@bibliothecadao/provider";

type ExecuteFn = EternumProvider["executeAndCheckTransaction"];

export interface BatchOptions {
  // EntryPoint names that should execute immediately, e.g. ["set_world_config"]
  immediateEntrypoints?: string[];
  // When true, disables sleeps/delays in config flows
  skipSleeps?: boolean;
  // Optional label for logs
  label?: string;
}

export interface BatchResultPlaceholder {
  // Minimal surface used by existing logs in config scripts
  statusReceipt: string;
}

export class TxBatcher {
  private calls: Call[] = [];
  private readonly provider: EternumProvider;
  private readonly signer: any;
  private readonly originalExecute: ExecuteFn;
  private readonly immediateEntrypoints: Set<string>;

  constructor(provider: EternumProvider, signer: any, opts?: BatchOptions) {
    this.provider = provider;
    this.signer = signer;
    // Bind original for later restore/flush
    this.originalExecute = provider.executeAndCheckTransaction.bind(provider);
    this.immediateEntrypoints = new Set(opts?.immediateEntrypoints ?? []);
  }

  // Intercept provider.executeAndCheckTransaction to aggregate Calls
  enableInterception() {
    const self = this;
    (this.provider as any).__txBatcher = this; // expose for optional introspection

    this.provider.executeAndCheckTransaction = async function (signer: any, details: AllowArray<Call>) {
      // Normalize to array of calls
      const arr = Array.isArray(details) ? details : [details];

      // If any entrypoint is marked immediate, run the original immediately
      const shouldExecuteNow = arr.some((c) => self.immediateEntrypoints.has(c.entrypoint));
      if (shouldExecuteNow) {
        return await self.originalExecute(signer, details);
      }

      // Otherwise, queue for later
      self.add(details);

      // Return a placeholder so existing logs don't crash
      const placeholder: BatchResultPlaceholder = { statusReceipt: "QUEUED_FOR_BATCH" };
      return placeholder as any;
    } as any;
  }

  disableInterception() {
    // Restore original execute
    this.provider.executeAndCheckTransaction = this.originalExecute;
    delete (this.provider as any).__txBatcher;
  }

  add(details: AllowArray<Call>) {
    if (Array.isArray(details)) {
      this.calls.push(...details);
    } else {
      this.calls.push(details);
    }
  }

  get size() {
    return this.calls.length;
  }

  // Perform a single multicall with all queued Calls
  async flush() {
    if (!this.calls.length) return null;
    const txDetails = [...this.calls];
    this.calls.length = 0;
    return await this.originalExecute(this.signer, txDetails);
  }
}

/**
 * Helper to run a function with batching interception enabled, then flush.
 *
 * @param provider - EternumProvider instance
 * @param signer - Account/Signer
 * @param run - async function that performs config calls
 * @param opts - Batch options
 * @returns the flush transaction receipt
 */
export async function withBatching(
  provider: EternumProvider,
  signer: any,
  run: () => Promise<void>,
  opts?: BatchOptions,
) {
  const batcher = new TxBatcher(provider, signer, opts);
  batcher.enableInterception();
  try {
    await run();
  } finally {
    batcher.disableInterception();
  }
  return await batcher.flush();
}

/**
 * Programmatically add entrypoints to execute immediately while batching is enabled.
 */
export function markImmediateEntrypoints(provider: EternumProvider, entrypoints: string | string[]) {
  const batcher = (provider as any).__txBatcher as TxBatcher | undefined;
  if (!batcher) return;
  const list = Array.isArray(entrypoints) ? entrypoints : [entrypoints];
  // @ts-ignore - access private for convenience in scripts
  list.forEach((e) => batcher["immediateEntrypoints"].add(e));
}

/**
 * Programmatically remove entrypoints from the immediate set.
 */
export function unmarkImmediateEntrypoints(provider: EternumProvider, entrypoints?: string | string[]) {
  const batcher = (provider as any).__txBatcher as TxBatcher | undefined;
  if (!batcher) return;
  // @ts-ignore - access private for convenience in scripts
  if (!entrypoints) batcher["immediateEntrypoints"] = new Set();
  else {
    const list = Array.isArray(entrypoints) ? entrypoints : [entrypoints];
    // @ts-ignore
    list.forEach((e) => batcher["immediateEntrypoints"].delete(e));
  }
}
