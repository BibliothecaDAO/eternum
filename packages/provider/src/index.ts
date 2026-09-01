/**
 * Provider class for interacting with the Eternum game contracts
 *
 * @param katana - The katana manifest containing contract addresses and ABIs
 * @param url - Optional RPC URL for the provider
 */
import type { Manifest } from "@bibliothecadao/types";
import * as SystemProps from "@bibliothecadao/types";
import { DojoCall, DojoProvider } from "@dojoengine/core";
import EventEmitter from "eventemitter3";
import {
  Account,
  AccountInterface,
  AllowArray,
  BigNumberish,
  Call,
  CallData,
  GetTransactionReceiptResponse,
  ResourceBoundsBN,
  uint256,
  UniversalDetails,
} from "starknet";
import { classifyTransactionError, extractErrorMessage, formatErrorForConsole } from "./classify-transaction-error";
import { PromiseQueue, QueueableTransaction } from "./promise-queue";
import { ExecutionOptions } from "./transaction-executor";
import { withRetry } from "./retry";
import type { RetryConfig } from "./retry";
import {
  BatchedTransactionDetail,
  TransactionFailedPayload,
  TransactionFailureStage,
  TransactionLifecycleMeta,
  TransactionProviderState,
  TransactionRetrySafety,
  TransactionSubmitFailureKind,
  TransactionSubmitGuard,
  TransactionSubmitGuardContext,
  TransactionStreamWaiter,
  TransactionType,
} from "./types";
import { createVrfRequestRandomCall, isVrfEnabled, isVrfRequestRandomCall, type VrfSource } from "./vrf";
export const NAMESPACE = "s1_eternum";
export {
  CATEGORY_BATCH_LIMITS,
  getTransactionCategory,
  TransactionCostCategory,
  DEFAULT_BATCH_DELAYS,
  getDelayForTransaction,
} from "./batch-config";
export type { BatchDelayConfig } from "./batch-config";
export { classifyTransactionError, extractErrorMessage, formatErrorForConsole } from "./classify-transaction-error";
export type { ClassifiedTransactionError } from "./classify-transaction-error";
export { PromiseQueue } from "./promise-queue";
export type { QueueableTransaction } from "./promise-queue";
export type { TransactionExecutor, ExecutionOptions } from "./transaction-executor";
export { withRetry, isRetryableError, calculateBackoffDelay, DEFAULT_RETRY_CONFIG } from "./retry";
export type { RetryConfig } from "./retry";
export { TransactionType } from "./types";
export type {
  BatchedTransactionDetail,
  TransactionFailedPayload,
  TransactionFailureStage,
  TransactionLifecycleMeta,
  TransactionProviderState,
  TransactionRetrySafety,
  TransactionSubmitFailureKind,
  TransactionSubmitGuard,
  TransactionSubmitGuardContext,
  TransactionStreamWaiter,
} from "./types";
export type { VrfSource } from "./vrf";

// Mainnet currently rejects V3 invokes above this l2_gas max_amount ceiling.
const MAX_V3_L2_GAS_MAX_AMOUNT = 1_200_000_000n;
const V3_L2_GAS_OVERHEAD_PERCENT = 50n;
const HUNDRED_PERCENT = 100n;
const DEFAULT_FEE_ESTIMATE_TIMEOUT_MS = 5_000;
// A failed fee estimate carries the full Cairo trace before any gas is spent;
// keep it briefly so the eventual submit/confirmation failure can surface it.
const ESTIMATE_ERROR_TTL_MS = 60_000;
const DEFAULT_TRANSACTION_SUBMIT_TIMEOUT_MS = 20_000;
const EXPLORE_RESOURCE_BOUNDS_CACHE_TTL_MS = 15_000;
export const SUBMISSION_TIMEOUT_UNCERTAIN_MESSAGE =
  "Submission timed out before a tx hash was returned. Check wallet/activity before retrying.";
const formatTimeoutDuration = (timeoutMs: number): string =>
  timeoutMs >= 1_000 ? `${Math.round(timeoutMs / 1_000)}s` : `${timeoutMs}ms`;

class TransactionSubmissionTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `Transaction submission timed out after ${formatTimeoutDuration(timeoutMs)} before a transaction hash was returned`,
    );
    this.name = "TransactionSubmissionTimeoutError";
  }
}

const isTransactionSubmissionTimeoutError = (error: unknown): boolean => {
  return error instanceof TransactionSubmissionTimeoutError;
};

const matchesDestroyedConnectionError = (error: unknown): boolean => {
  const message = extractErrorMessage(error, "").toLowerCase();
  return message.includes("destroyed connection") || message.includes("connection destroyed");
};

const classifySubmitFailure = (
  error: unknown,
): {
  failureKind: TransactionSubmitFailureKind;
  providerState: TransactionProviderState;
  hasTxHash: boolean;
  retrySafety: TransactionRetrySafety;
} => {
  if (isTransactionSubmissionTimeoutError(error)) {
    return {
      failureKind: "submission_timeout_no_hash",
      providerState: "unknown",
      hasTxHash: false,
      retrySafety: "unsafe_until_wallet_checked",
    };
  }

  if (matchesDestroyedConnectionError(error)) {
    return {
      failureKind: "provider_connection_destroyed",
      providerState: "destroyed",
      hasTxHash: false,
      retrySafety: "safe_after_reconnect",
    };
  }

  return {
    failureKind: "submit_failed",
    providerState: "unknown",
    hasTxHash: false,
    retrySafety: "unknown",
  };
};

const withL2GasHeadroom = (resourceBounds?: ResourceBoundsBN): ResourceBoundsBN | undefined => {
  if (!resourceBounds?.l2_gas || typeof resourceBounds.l2_gas.max_amount !== "bigint") {
    return resourceBounds;
  }

  const currentMaxAmount = resourceBounds.l2_gas.max_amount;
  const paddedMaxAmount =
    (currentMaxAmount * (HUNDRED_PERCENT + V3_L2_GAS_OVERHEAD_PERCENT) + (HUNDRED_PERCENT - 1n)) / HUNDRED_PERCENT;
  const nextMaxAmount = paddedMaxAmount > MAX_V3_L2_GAS_MAX_AMOUNT ? MAX_V3_L2_GAS_MAX_AMOUNT : paddedMaxAmount;

  if (nextMaxAmount === currentMaxAmount) {
    return resourceBounds;
  }

  return {
    ...resourceBounds,
    l2_gas: {
      ...resourceBounds.l2_gas,
      max_amount: nextMaxAmount,
    },
  };
};

type VrfExecutionLock = {
  completed: Promise<void>;
  resolve: () => void;
};

type CachedExploreExecutionDetails = {
  cachedAtMs: number;
  resourceBounds: ResourceBoundsBN;
};

type TransactionFailureError = Error & {
  transactionFailureStage?: TransactionFailureStage;
  /** Raw receipt revert reason, verbatim, attached on the revert path. */
  rawRevertReason?: string;
};

/**
 * Structured error context for a TransactionFailedPayload: the original error
 * and the raw revert reason when the error came off a reverted receipt.
 */
const buildFailureDiagnostics = (error: unknown): Pick<TransactionFailedPayload, "error" | "revertReason"> => {
  const revertReason = error instanceof Error ? (error as TransactionFailureError).rawRevertReason : undefined;
  return {
    error,
    ...(revertReason !== undefined ? { revertReason } : {}),
  };
};

const attachTransactionFailureStage = (
  error: unknown,
  stage: TransactionFailureStage,
  fallbackMessage = "Unknown error",
): TransactionFailureError => {
  const stagedError: TransactionFailureError =
    error instanceof Error
      ? (error as TransactionFailureError)
      : (new Error(extractErrorMessage(error, fallbackMessage)) as TransactionFailureError);
  stagedError.transactionFailureStage = stage;
  return stagedError;
};

const resolveTransactionFailureStage = (error: unknown, fallback: TransactionFailureStage): TransactionFailureStage => {
  const stagedError = error as TransactionFailureError | undefined;
  if (error instanceof Error && typeof stagedError?.transactionFailureStage === "string") {
    return stagedError.transactionFailureStage ?? fallback;
  }

  return fallback;
};

/**
 * Gets a contract address from the manifest by name
 *
 * @param manifest - The manifest containing contract information
 * @param name - The name/tag of the contract to find
 * @returns The contract address
 * @throws Error if contract not found
 */
export const getContractByName = (manifest: Manifest, name: string) => {
  const contract = manifest.contracts.find((item) => item.tag === name);
  if (!contract) {
    throw new Error(`Contract ${name} not found in manifest`);
  }
  return contract.address;
};

/**
 * Higher order function that adds event emitter functionality to a class
 *
 * @param Base - The base class to extend
 * @returns A new class with event emitter capabilities
 */
function ApplyEventEmitter<T extends new (...args: any[]) => {}>(Base: T) {
  return class extends Base {
    eventEmitter = new EventEmitter();

    /**
     * Emit an event
     * @param event - The event name
     * @param args - Arguments to pass to event handlers
     */
    emit(event: string, ...args: any[]) {
      this.eventEmitter.emit(event, ...args);
    }

    /**
     * Subscribe to an event
     * @param event - The event name to listen for
     * @param listener - Callback function when event occurs
     */
    on(event: string, listener: (...args: any[]) => void) {
      this.eventEmitter.on(event, listener);
    }

    /**
     * Unsubscribe from an event
     * @param event - The event name to stop listening to
     * @param listener - The callback function to remove
     */
    off(event: string, listener: (...args: any[]) => void) {
      this.eventEmitter.off(event, listener);
    }
  };
}
const EnhancedDojoProvider = ApplyEventEmitter(DojoProvider);

export const buildVrfCalls = async ({
  account,
  call,
  vrfProviderAddress,
  addressToCall,
  source,
}: {
  account: AccountInterface;
  call: Call;
  vrfProviderAddress: string | undefined;
  addressToCall: string;
  source?: VrfSource;
}): Promise<Call[]> => {
  if (!account) return [];
  if (!vrfProviderAddress) throw new Error("VRF provider address is not defined");

  const requestRandomCall = createVrfRequestRandomCall({
    vrfProviderAddress,
    addressToCall,
    source: source ?? { type: "nonce", value: account.address },
  });

  let calls = [];
  calls.push(requestRandomCall);
  calls.push(call);

  return calls;
};

export class EternumProvider extends EnhancedDojoProvider {
  promiseQueue: PromiseQueue;
  // Batching state (optional, used by admin/config UIs)
  private _batchCalls?: Call[];
  private _batchImmediate?: Set<string>;
  private _batchSigner?: Account | AccountInterface;
  private _batchOriginalExecute?: (
    signer: Account | AccountInterface,
    transactionDetails: AllowArray<Call>,
  ) => Promise<GetTransactionReceiptResponse>;
  private readonly TRANSACTION_CONFIRM_TIMEOUT_MS = 10_000;
  private readonly TRANSACTION_SUBMIT_TIMEOUT_MS = DEFAULT_TRANSACTION_SUBMIT_TIMEOUT_MS;
  private readonly FEE_ESTIMATE_TIMEOUT_MS = DEFAULT_FEE_ESTIMATE_TIMEOUT_MS;
  private pendingVrfExecutionLocks = new Map<string, VrfExecutionLock>();
  private cachedExploreExecutionDetails = new Map<string, CachedExploreExecutionDetails>();
  private lastEstimateError?: { error: unknown; atMs: number };
  private readonly retryConfig?: RetryConfig;
  private transactionSubmitGuard?: TransactionSubmitGuard;
  private transactionStreamWaiter?: TransactionStreamWaiter;
  private transactionStreamSubmitObserver?: (transactionHash: string) => void;
  /** Model/contract-tag namespace: "s2" on appchain worlds, "s1_eternum" on legacy worlds. */
  readonly namespace: string;
  /** Active game on an s2 appchain world; 0 on legacy worlds (no calldata rewrite). */
  private readonly gameId: number;
  /** Normalized addresses of this world's game-system contracts (game_id-prefixed entrypoints on s2). */
  private readonly gameContractAddresses: Set<string>;
  /** Fixed bounds for a fee-free chain; undefined keeps the normal estimation path. */
  private readonly executionResourceBounds?: ResourceBoundsBN;

  /**
   * Create a new EternumProvider instance
   *
   * @param katana - The katana manifest containing contract info
   * @param url - Optional RPC URL
   * @param scope - s2 world scope and optional fixed execution bounds
   */
  constructor(
    katana: Manifest,
    url?: string,
    private VRF_PROVIDER_ADDRESS?: string,
    retryConfig?: RetryConfig,
    scope?: {
      namespace?: string;
      gameId?: number;
      executionResourceBounds?: ResourceBoundsBN;
      transactionStreamWaiter?: TransactionStreamWaiter;
    },
  ) {
    super(katana, url);
    this.manifest = katana;
    this.retryConfig = retryConfig;
    this.namespace = scope?.namespace ?? NAMESPACE;
    this.gameId = scope?.gameId ?? 0;
    this.executionResourceBounds = scope?.executionResourceBounds;
    this.transactionStreamWaiter = scope?.transactionStreamWaiter;
    this.gameContractAddresses = new Set(
      this.gameId > 0
        ? ((katana.contracts ?? []) as { address?: string }[])
            .map((contract) => this.normalizeAddress(contract.address))
            .filter((address): address is string => Boolean(address))
        : [],
    );

    this.getWorldAddress = function () {
      const worldAddress = this.manifest.world.address;
      return worldAddress;
    };
    // No timed batching: appchain txs land in <1s, so waiting to merge actions only adds
    // latency (and a merged multicall makes one revert fail unrelated actions). The queue
    // stays for per-signer serialization; a backlog still coalesces naturally.
    this.promiseQueue = new PromiseQueue(this, { batchDelayMs: 0 });
  }

  public setTransactionStreamWaiter(
    waiter: TransactionStreamWaiter | undefined,
    submitObserver?: (transactionHash: string) => void,
  ): void {
    this.transactionStreamWaiter = waiter;
    this.transactionStreamSubmitObserver = submitObserver;
  }

  /**
   * Every deployed s2 game-system entrypoint takes `game_id` as its first
   * argument (the client never calls the exceptions: registrar launch
   * functions and the MMR token hooks). Prepending it here — the single seam
   * every transaction path funnels through — spares ~150 call sites from
   * threading the id. Non-game calls in the same multicall (ERC20 approvals,
   * VRF request_random) are left untouched; legacy worlds (gameId 0) skip the
   * rewrite entirely.
   */
  private withGameIdCalldata(transactionDetails: AllowArray<Call>): AllowArray<Call> {
    // `> 0` (not `<= 0` inverted) so prototype-built test doubles with no
    // constructor state fall through to the legacy no-rewrite path.
    if (!(this.gameId > 0) || !this.gameContractAddresses) return transactionDetails;

    const prependGameId = (call: Call): Call => {
      const contractAddress = this.normalizeAddress(call.contractAddress);
      if (!contractAddress || !this.gameContractAddresses.has(contractAddress)) return call;
      const calldata = Array.isArray(call.calldata) ? call.calldata : [];
      return { ...call, calldata: [this.gameId.toString(), ...calldata] };
    };

    return Array.isArray(transactionDetails)
      ? transactionDetails.map(prependGameId)
      : prependGameId(transactionDetails);
  }

  private normalizeAddress(address: BigNumberish | undefined | null): string | undefined {
    if (address === undefined || address === null) {
      return undefined;
    }

    try {
      return `0x${BigInt(address).toString(16)}`;
    } catch {
      return String(address).toLowerCase();
    }
  }

  private isVrfRequestRandomCall(call: Call): boolean {
    return isVrfRequestRandomCall({
      call,
      vrfProviderAddress: this.VRF_PROVIDER_ADDRESS,
      normalizeAddress: (address) => this.normalizeAddress(address),
    });
  }

  private getVrfSourceAddress(call: Call): string | undefined {
    if (!Array.isArray(call.calldata) || call.calldata.length < 3) {
      return undefined;
    }

    return this.normalizeAddress(call.calldata[2] as BigNumberish | undefined);
  }

  private getTransactionCalls(transactionDetails: AllowArray<Call>): Call[] {
    return Array.isArray(transactionDetails) ? transactionDetails : [transactionDetails];
  }

  private serializeTransactionCacheValue(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.serializeTransactionCacheValue(item)).join(",")}]`;
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (value === undefined) {
      return "undefined";
    }

    if (value === null) {
      return "null";
    }

    return String(value);
  }

  private buildTransactionCacheSignature(transactionDetails: AllowArray<Call>): string {
    return this.getTransactionCalls(transactionDetails)
      .map((detail) => {
        const contractAddress = this.normalizeAddress(detail.contractAddress) ?? String(detail.contractAddress);
        const calldata = Array.isArray(detail.calldata)
          ? detail.calldata.map((item) => this.serializeTransactionCacheValue(item)).join(",")
          : "";
        return `${contractAddress}:${detail.entrypoint}:${calldata}`;
      })
      .join("|");
  }

  private getVrfRequestRandomCalls(transactionDetails: AllowArray<Call>): Call[] {
    return this.getTransactionCalls(transactionDetails).filter((detail) => this.isVrfRequestRandomCall(detail));
  }

  private assertSingleVrfRequestRandomCall(transactionDetails: AllowArray<Call>): void {
    const vrfRequestCalls = this.getVrfRequestRandomCalls(transactionDetails);
    if (vrfRequestCalls.length <= 1) {
      return;
    }

    throw new Error(
      "Cannot execute a multicall with multiple VRF request_random calls. Submit VRF transactions separately.",
    );
  }

  private getVrfSerializationKey(
    signer: Account | AccountInterface,
    transactionDetails: AllowArray<Call>,
  ): string | undefined {
    const details = this.getTransactionCalls(transactionDetails);
    const vrfRequestCall = details.find((detail) => this.isVrfRequestRandomCall(detail));
    if (!vrfRequestCall) {
      return undefined;
    }

    const signerAddress = this.normalizeAddress((signer as { address?: BigNumberish }).address);
    if (!signerAddress) {
      return undefined;
    }

    const sourceAddress = this.getVrfSourceAddress(vrfRequestCall) ?? signerAddress;
    return `${signerAddress}:${sourceAddress}`;
  }

  private getExploreSerializationKey(
    signer: Account | AccountInterface,
    transactionDetails: AllowArray<Call>,
  ): string | undefined {
    const signerAddress = this.normalizeAddress((signer as { address?: BigNumberish }).address);
    if (!signerAddress) {
      return undefined;
    }

    const explorerId = this.getExploreTransactionExplorerId(transactionDetails) ?? "unknown";
    return `${signerAddress}:explore:${explorerId}`;
  }

  private getExploreTransactionExplorerId(transactionDetails: AllowArray<Call>): string | undefined {
    const explorerCall = this.getTransactionCalls(transactionDetails).find(
      (detail) => detail.entrypoint === "explorer_move" || detail.entrypoint === "explorer_extract_reward",
    );
    if (!Array.isArray(explorerCall?.calldata)) {
      return undefined;
    }

    const explorerIdIndex = this.gameId > 0 ? 1 : 0;
    const rawExplorerId = explorerCall.calldata[explorerIdIndex] as BigNumberish | undefined;
    return this.normalizeAddress(rawExplorerId) ?? (rawExplorerId !== undefined ? String(rawExplorerId) : undefined);
  }

  private getTransactionSerializationKey(
    txType: TransactionType | undefined,
    signer: Account | AccountInterface,
    transactionDetails: AllowArray<Call>,
  ): string | undefined {
    if (txType === TransactionType.EXPLORE) {
      return this.getExploreSerializationKey(signer, transactionDetails);
    }

    return this.getVrfSerializationKey(signer, transactionDetails);
  }

  private getExploreExecutionDetailsCacheKey(
    txType: TransactionType | undefined,
    signer: Account | AccountInterface,
    transactionDetails: AllowArray<Call>,
  ): string | undefined {
    if (txType !== TransactionType.EXPLORE) {
      return undefined;
    }

    const signerAddress = this.normalizeAddress((signer as { address?: BigNumberish }).address);
    if (!signerAddress) {
      return undefined;
    }

    const worldAddress =
      this.normalizeAddress((this.manifest?.world?.address as BigNumberish | undefined) ?? undefined) ?? "unknown";
    const nodeUrl = (this.provider as any)?.channel?.nodeUrl ?? (this.manifest as any)?.world?.metadata?.rpc_url;
    const transactionSignature = this.buildTransactionCacheSignature(transactionDetails);
    return `${String(nodeUrl ?? "unknown")}:${worldAddress}:${signerAddress}:${txType}:${transactionSignature}`;
  }

  private getCachedExploreExecutionDetails(cacheKey: string | undefined): UniversalDetails | undefined {
    if (!cacheKey) {
      return undefined;
    }

    const cached = this.cachedExploreExecutionDetails.get(cacheKey);
    if (!cached) {
      return undefined;
    }

    if (Date.now() - cached.cachedAtMs > EXPLORE_RESOURCE_BOUNDS_CACHE_TTL_MS) {
      this.cachedExploreExecutionDetails.delete(cacheKey);
      return undefined;
    }

    return {
      version: 3,
      resourceBounds: cached.resourceBounds,
    };
  }

  private cacheExploreExecutionDetails(cacheKey: string | undefined, resourceBounds: ResourceBoundsBN): void {
    if (!cacheKey) {
      return;
    }

    this.cachedExploreExecutionDetails.set(cacheKey, {
      cachedAtMs: Date.now(),
      resourceBounds,
    });
  }

  private invalidateExploreExecutionDetailsCache(cacheKey: string | undefined): void {
    if (!cacheKey) {
      return;
    }

    this.cachedExploreExecutionDetails.delete(cacheKey);
  }

  private shouldRefreshExecutionDetailsAfterSubmitError(error: unknown): boolean {
    const message = extractErrorMessage(error, "").toLowerCase();
    return message.includes("nonce") || classifyTransactionError(error).kind === "resource_bounds";
  }

  private createVrfExecutionLock(): VrfExecutionLock {
    let resolve!: () => void;
    const completed = new Promise<void>((innerResolve) => {
      resolve = innerResolve;
    });

    return { completed, resolve };
  }

  private async acquireVrfExecutionLock(key: string): Promise<() => void> {
    while (true) {
      const existingLock = this.pendingVrfExecutionLocks.get(key);
      if (!existingLock) {
        const lock = this.createVrfExecutionLock();
        this.pendingVrfExecutionLocks.set(key, lock);

        let released = false;
        return () => {
          if (released) {
            return;
          }
          released = true;

          const currentLock = this.pendingVrfExecutionLocks.get(key);
          if (currentLock === lock) {
            this.pendingVrfExecutionLocks.delete(key);
          }
          lock.resolve();
        };
      }

      await existingLock.completed;
    }
  }

  private async getV3ExecutionDetails(
    signer: Account | AccountInterface,
    transactionDetails: AllowArray<Call>,
    options?: { cacheKey?: string; forceRefresh?: boolean },
  ): Promise<UniversalDetails> {
    const details: UniversalDetails = { version: 3, tip: 0 };
    if (this.executionResourceBounds) {
      return { ...details, resourceBounds: this.executionResourceBounds };
    }
    const cached = !options?.forceRefresh ? this.getCachedExploreExecutionDetails(options?.cacheKey) : undefined;
    if (cached) {
      return { ...details, ...cached };
    }

    const estimateInvokeFee = (signer as any)?.estimateInvokeFee;
    if (typeof estimateInvokeFee !== "function") {
      return details;
    }

    try {
      const estimate = (await this.withTimeout(
        estimateInvokeFee.call(signer, transactionDetails, {
          version: 3,
          tip: 0,
        }),
        this.FEE_ESTIMATE_TIMEOUT_MS,
        () =>
          new Error(
            `Transaction fee estimation timed out after ${formatTimeoutDuration(this.FEE_ESTIMATE_TIMEOUT_MS)}`,
          ),
      )) as { resourceBounds?: ResourceBoundsBN };
      const resourceBounds = withL2GasHeadroom(estimate?.resourceBounds);
      if (!resourceBounds) {
        return details;
      }

      this.cacheExploreExecutionDetails(options?.cacheKey, resourceBounds);

      return {
        ...details,
        resourceBounds,
      };
    } catch (error) {
      if (this.shouldAbortSubmitAfterEstimateRevert(error, transactionDetails)) {
        throw error;
      }
      // Submission proceeds with default v3 details, but the estimate error is
      // the richest failure signal we get — stash it for the failure payload.
      this.lastEstimateError = { error, atMs: Date.now() };
      console.warn(
        `[provider] Failed to estimate invoke fee, using default v3 tx details: ${formatErrorForConsole(error)}`,
      );
      return details;
    }
  }

  /**
   * A fee estimate that failed with an execution revert has already run the
   * calls and proven they fail deterministically — submitting anyway only
   * lands a doomed transaction and reports the same revert a second time.
   * VRF multicalls are the one
   * exception: their consume_random can revert at estimate time (no
   * submit_random on chain yet) and still succeed at execution once the VRF
   * server front-runs it. A marginal tx that would pass one block later is
   * rejected too; callers retry (automation next tick, players re-click).
   */
  private shouldAbortSubmitAfterEstimateRevert(error: unknown, transactionDetails: AllowArray<Call>): boolean {
    if (classifyTransactionError(error).kind !== "reverted") return false;
    return this.getVrfRequestRandomCalls(transactionDetails).length === 0;
  }

  private takeRecentEstimateError(): unknown {
    const stashed = this.lastEstimateError;
    this.lastEstimateError = undefined;
    if (!stashed || Date.now() - stashed.atMs > ESTIMATE_ERROR_TTL_MS) {
      return undefined;
    }
    return stashed.error;
  }

  /**
   * The submit error the payload should carry: usually the submit error
   * itself, but when it decoded to nothing actionable and a recent fee
   * estimate failed with a real trace, prefer that.
   */
  private resolveSubmitFailureError(error: unknown, extractedMessage: string): unknown {
    const estimateError = this.takeRecentEstimateError();
    if (estimateError === undefined) return error;
    return extractedMessage === "Unknown error" ? estimateError : error;
  }

  private async submitTransaction(
    signer: Account | AccountInterface,
    transactionDetails: AllowArray<Call>,
    executionDetails: UniversalDetails,
    options?: { executionDetailsCacheKey?: string },
  ): Promise<{ transaction_hash: string }> {
    if (this.retryConfig && this.retryConfig.maxRetries > 0) {
      let currentExecutionDetails = executionDetails;
      return await withRetry(
        () => this.execute(signer as any, transactionDetails, this.namespace ?? NAMESPACE, currentExecutionDetails),
        this.retryConfig,
        async (error, attempt) => {
          if (this.shouldRefreshExecutionDetailsAfterSubmitError(error)) {
            this.invalidateExploreExecutionDetailsCache(options?.executionDetailsCacheKey);
            currentExecutionDetails = await this.getV3ExecutionDetails(signer, transactionDetails, {
              cacheKey: options?.executionDetailsCacheKey,
              forceRefresh: true,
            });
          }
          console.warn(`[provider] Retry attempt ${attempt} for transaction: ${extractErrorMessage(error)}`);
        },
      );
    }

    return await this.execute(signer as any, transactionDetails, this.namespace ?? NAMESPACE, executionDetails);
  }

  public setTransactionSubmitGuard(transactionSubmitGuard?: TransactionSubmitGuard): void {
    this.transactionSubmitGuard = transactionSubmitGuard;
  }

  private getSignerAddress(signer: Account | AccountInterface): string | undefined {
    const address = (signer as { address?: unknown }).address;
    return typeof address === "string" && address.length > 0 ? address : undefined;
  }

  private async runTransactionSubmitGuard(
    signer: Account | AccountInterface,
    transactionMeta: TransactionLifecycleMeta,
  ): Promise<void> {
    const guard = this.transactionSubmitGuard;
    if (!guard) {
      return;
    }

    const context: TransactionSubmitGuardContext = {
      ...transactionMeta,
      transactionType: transactionMeta.type,
      signerAddress: this.getSignerAddress(signer),
      providerState: "ready",
    };

    await guard(context);
  }

  private async waitForTransactionSubmission(
    submitPromise: Promise<{ transaction_hash: string }>,
  ): Promise<{ transaction_hash: string }> {
    return await this.withTimeout(
      submitPromise,
      this.TRANSACTION_SUBMIT_TIMEOUT_MS,
      () => new TransactionSubmissionTimeoutError(this.TRANSACTION_SUBMIT_TIMEOUT_MS),
    );
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, buildError: () => Error): Promise<T> {
    if (timeoutMs <= 0) {
      return await promise;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(buildError()), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  private getTransactionEntrypoints(transactionDetails: AllowArray<Call>): string[] {
    const details = Array.isArray(transactionDetails) ? transactionDetails : [transactionDetails];
    return details.map((detail) => detail.entrypoint).filter((entrypoint): entrypoint is string => Boolean(entrypoint));
  }

  private getTransactionContractAddresses(transactionDetails: AllowArray<Call>): string[] {
    const details = Array.isArray(transactionDetails) ? transactionDetails : [transactionDetails];
    return Array.from(
      new Set(details.map((detail) => detail.contractAddress).filter((address): address is string => Boolean(address))),
    );
  }

  private buildTransactionLifecycleMeta(
    transactionDetails: AllowArray<Call>,
    meta: Pick<
      TransactionLifecycleMeta,
      "type" | "transactionHash" | "signerAddress" | "transactionCount" | "batchDetails"
    >,
  ): TransactionLifecycleMeta {
    const entrypoints = this.getTransactionEntrypoints(transactionDetails);
    const contractAddresses = this.getTransactionContractAddresses(transactionDetails);

    return {
      ...meta,
      ...(entrypoints.length > 0 ? { entrypoints } : {}),
      ...(contractAddresses.length > 0 ? { contractAddresses } : {}),
    };
  }

  private emitTransactionFailure(payload: TransactionFailedPayload): void {
    this.emit("transactionFailed", payload);
  }

  private emitTransactionSubmitted(transactionHash: string, transactionMeta: TransactionLifecycleMeta): void {
    this.transactionStreamSubmitObserver?.(transactionHash);
    this.emit("transactionSubmitted", {
      transactionHash,
      ...transactionMeta,
    });
  }

  private emitTransactionPending(transactionHash: string, transactionMeta: TransactionLifecycleMeta): void {
    this.emit("transactionPending", {
      transactionHash,
      ...transactionMeta,
    });
  }

  private observeLateSubmittedTransaction(
    submitPromise: Promise<{ transaction_hash: string }>,
    transactionMeta: TransactionLifecycleMeta,
    releaseVrfExecutionLock?: () => void,
  ): void {
    void submitPromise
      .then((tx) => {
        const recoveredTransactionMeta = {
          ...transactionMeta,
          recoveredFromSubmissionTimeout: true,
        };
        const recoveredTransactionMetaWithHash = {
          ...recoveredTransactionMeta,
          transactionHash: tx.transaction_hash,
        };

        this.emitTransactionSubmitted(tx.transaction_hash, recoveredTransactionMeta);
        this.emitTransactionPending(tx.transaction_hash, recoveredTransactionMeta);
        if (!this.transactionStreamWaiter) return;

        return this.waitForTransactionWithCheckInternal(tx.transaction_hash, recoveredTransactionMetaWithHash)
          .then((receipt) => {
            this.emit("transactionComplete", {
              details: receipt,
              ...recoveredTransactionMeta,
            });
          })
          .catch((error) => {
            this.emitTransactionFailure({
              ...recoveredTransactionMetaWithHash,
              message: extractErrorMessage(error),
              stage: resolveTransactionFailureStage(error, "background_confirmation"),
              ...buildFailureDiagnostics(error),
            });
          });
      })
      .catch(() => {
        // The original timeout path already emitted the submit failure.
      })
      .finally(() => {
        releaseVrfExecutionLock?.();
      });
  }

  // ============ Optional client-side batching API ============
  public beginBatch(options: { signer: Account | AccountInterface; immediateEntrypoints?: string[] }) {
    if (this._batchCalls) return; // already batching
    this._batchCalls = [];
    this._batchImmediate = new Set(options?.immediateEntrypoints ?? []);
    this._batchSigner = options.signer;
    this._batchOriginalExecute = this.executeAndCheckTransaction.bind(this);

    const self = this;
    this.executeAndCheckTransaction = async function (signer: any, details: AllowArray<Call>) {
      const arr = Array.isArray(details) ? details : [details];
      const shouldImmediate = arr.some((c) => self._batchImmediate?.has(c.entrypoint));
      if (shouldImmediate) {
        // passthrough
        return await (self._batchOriginalExecute as any)(signer, details);
      }
      // queue
      self._batchCalls!.push(...arr);
      // return a minimal placeholder compatible with existing logs
      return { statusReceipt: "QUEUED_FOR_BATCH" } as any;
    } as any;
  }

  public isBatching(): boolean {
    return Array.isArray(this._batchCalls);
  }

  public getQueuedBatchCallCount(): number {
    return this._batchCalls?.length ?? 0;
  }

  public markImmediateEntrypoints(entrypoints: string | string[]): void {
    if (!this._batchImmediate) return;
    const list = Array.isArray(entrypoints) ? entrypoints : [entrypoints];
    list.forEach((e) => this._batchImmediate!.add(e));
  }

  public unmarkImmediateEntrypoints(entrypoints?: string | string[]): void {
    if (!this._batchImmediate) return;
    if (!entrypoints) {
      this._batchImmediate = new Set();
      return;
    }
    const list = Array.isArray(entrypoints) ? entrypoints : [entrypoints];
    list.forEach((e) => this._batchImmediate!.delete(e));
  }

  public async flushBatch(): Promise<GetTransactionReceiptResponse | null> {
    if (!this._batchCalls || !this._batchOriginalExecute) return null;
    if (this._batchCalls.length === 0) return null;
    const txs = [...this._batchCalls];
    this._batchCalls = [];
    return await this._batchOriginalExecute(this._batchSigner as any, txs as any);
  }

  public async endBatch(options?: { flush?: boolean }): Promise<GetTransactionReceiptResponse | null> {
    const flush = options?.flush ?? true;
    let result: GetTransactionReceiptResponse | null = null;
    if (flush) {
      result = await this.flushBatch();
    }
    if (this._batchOriginalExecute) {
      // restore
      this.executeAndCheckTransaction = this._batchOriginalExecute as any;
    }
    this._batchOriginalExecute = undefined as any;
    this._batchCalls = undefined;
    this._batchImmediate = undefined;
    this._batchSigner = undefined;
    return result;
  }

  /**
   * Execute a transaction and check its result
   *
   * @param signer - Account that will sign the transaction
   * @param transactionDetails - Transaction call data
   * @param batchDetails - Optional details about batched transactions (from PromiseQueue)
   * @returns Transaction receipt
   */
  async executeAndCheckTransaction(
    signer: Account | AccountInterface,
    rawTransactionDetails: AllowArray<Call>,
    batchDetails?: BatchedTransactionDetail[],
    options?: ExecutionOptions & { transactionType?: TransactionType },
  ) {
    const transactionDetails = this.withGameIdCalldata(rawTransactionDetails);
    this.assertSingleVrfRequestRandomCall(transactionDetails);

    const isMultipleTransactions = Array.isArray(transactionDetails);

    // Get the transaction type based on the entrypoint name
    let txType: TransactionType;

    if (isMultipleTransactions) {
      // For multiple calls, use the first call's entrypoint
      txType =
        TransactionType[
          transactionDetails
            // remove VRF provider call from the list to define the transaction type
            .filter((detail) => !this.isVrfRequestRandomCall(detail))[0]
            ?.entrypoint.toUpperCase() as keyof typeof TransactionType
        ];
    } else {
      txType = TransactionType[transactionDetails.entrypoint.toUpperCase() as keyof typeof TransactionType];
    }
    txType = options?.transactionType ?? txType;

    const transactionMeta = this.buildTransactionLifecycleMeta(transactionDetails, {
      type: txType,
      signerAddress: this.getSignerAddress(signer),
      ...(isMultipleTransactions ? { transactionCount: transactionDetails.length } : {}),
      ...(batchDetails && batchDetails.length > 0 ? { batchDetails } : {}),
    });
    const executionDetailsCacheKey = this.getExploreExecutionDetailsCacheKey(txType, signer, transactionDetails);
    const executionDetailsPromise =
      txType === TransactionType.EXPLORE
        ? this.getV3ExecutionDetails(signer, transactionDetails, {
            cacheKey: executionDetailsCacheKey,
          })
        : undefined;
    // The prefetch can reject (preflight abort) before the guard/lock awaits
    // below reach it; park a handler so the window never surfaces as an
    // unhandled rejection. The await inside the try still observes the error.
    executionDetailsPromise?.catch(() => {});

    await this.runTransactionSubmitGuard(signer, transactionMeta);
    if (txType === TransactionType.EXPLORE) {
      this.emit("transactionProgress", {
        stage: "explore_submit_guard_released",
        type: txType,
        explorerId: this.getExploreTransactionExplorerId(transactionDetails),
        signerAddress: transactionMeta.signerAddress,
      });
    }

    const vrfSerializationKey = this.getTransactionSerializationKey(txType, signer, transactionDetails);
    let releaseVrfExecutionLock: (() => void) | undefined;
    if (vrfSerializationKey) {
      // Explores of the same explorer (and VRF requests from the same source)
      // serialise here by design: the next explore's calls are built from the
      // position the previous one leaves behind. Every other action pipelines.
      releaseVrfExecutionLock = await this.acquireVrfExecutionLock(vrfSerializationKey);
      if (txType === TransactionType.EXPLORE) {
        this.emit("transactionProgress", {
          stage: "explore_provider_lock_acquired",
          type: txType,
          explorerId: this.getExploreTransactionExplorerId(transactionDetails),
          signerAddress: transactionMeta.signerAddress,
        });
      }
    }

    let tx;
    let submitPromise: Promise<{ transaction_hash: string }> | undefined;
    try {
      // Resolved inside the try so a preflight abort (the estimate proved a
      // deterministic revert) rides the same failure emission and VRF-lock
      // release as a submit failure.
      const executionDetails = executionDetailsPromise
        ? await executionDetailsPromise
        : await this.getV3ExecutionDetails(signer, transactionDetails, {
            cacheKey: executionDetailsCacheKey,
          });
      if (txType === TransactionType.EXPLORE) {
        this.emit("transactionProgress", {
          stage: "explore_execution_details_ready",
          type: txType,
          explorerId: this.getExploreTransactionExplorerId(transactionDetails),
          signerAddress: transactionMeta.signerAddress,
        });
        this.emit("transactionProgress", {
          stage: "explore_sign_send_started",
          type: txType,
          explorerId: this.getExploreTransactionExplorerId(transactionDetails),
          signerAddress: transactionMeta.signerAddress,
        });
      }
      submitPromise = this.submitTransaction(signer, transactionDetails, executionDetails, {
        executionDetailsCacheKey,
      });
      tx = await this.waitForTransactionSubmission(submitPromise);
    } catch (error) {
      const message = extractErrorMessage(error);
      const submitFailure = classifySubmitFailure(error);
      if (this.shouldRefreshExecutionDetailsAfterSubmitError(error)) {
        this.invalidateExploreExecutionDetailsCache(executionDetailsCacheKey);
      }
      if (submitPromise && submitFailure.failureKind === "submission_timeout_no_hash") {
        this.observeLateSubmittedTransaction(submitPromise, transactionMeta, releaseVrfExecutionLock);
        releaseVrfExecutionLock = undefined;
      } else {
        releaseVrfExecutionLock?.();
        releaseVrfExecutionLock = undefined;
      }
      // Throw the resolved error too: when the submit error decoded to
      // nothing actionable, callers (automation's revert classifier, toasts)
      // need the stashed estimate trace as much as the diagnostics do.
      const resolvedError = this.resolveSubmitFailureError(error, message);
      this.emitTransactionFailure({
        ...transactionMeta,
        message: `Transaction failed to submit: ${message}`,
        stage: "submit",
        ...submitFailure,
        ...buildFailureDiagnostics(resolvedError),
      });
      throw resolvedError;
    }

    // Emit immediately so UI can show pending state
    this.emitTransactionSubmitted(tx.transaction_hash, transactionMeta);

    const waitForConfirmation = options?.waitForConfirmation ?? true;
    const transactionMetaWithHash = {
      ...transactionMeta,
      transactionHash: tx.transaction_hash,
    };
    if (!this.transactionStreamWaiter) {
      releaseVrfExecutionLock?.();
      releaseVrfExecutionLock = undefined;
      this.emitTransactionPending(tx.transaction_hash, transactionMeta);
      return {
        statusReceipt: "PENDING",
        transaction_hash: tx.transaction_hash,
      } as unknown as GetTransactionReceiptResponse;
    }
    const waitPromiseWithoutLockRelease = this.waitForTransactionWithCheckInternal(
      tx.transaction_hash,
      transactionMetaWithHash,
    );
    const waitPromise = releaseVrfExecutionLock
      ? waitPromiseWithoutLockRelease.finally(() => {
          releaseVrfExecutionLock?.();
          releaseVrfExecutionLock = undefined;
        })
      : waitPromiseWithoutLockRelease;

    if (!waitForConfirmation) {
      this.emitTransactionPending(tx.transaction_hash, transactionMeta);
      void waitPromise
        .then((receipt) => {
          this.emit("transactionComplete", {
            details: receipt,
            ...transactionMeta,
          });
        })
        .catch((error) => {
          console.error(`Error waiting for transaction ${tx.transaction_hash}`, error);
          this.emitTransactionFailure({
            ...transactionMetaWithHash,
            message: extractErrorMessage(error),
            stage: resolveTransactionFailureStage(error, "background_confirmation"),
            ...buildFailureDiagnostics(error),
          });
        });

      return {
        statusReceipt: "PENDING",
        transaction_hash: tx.transaction_hash,
      } as any;
    }

    let waitResult: { status: "confirmed"; receipt: GetTransactionReceiptResponse } | { status: "pending" };
    try {
      waitResult = await this.waitForTransactionWithTimeout(waitPromise, this.TRANSACTION_CONFIRM_TIMEOUT_MS);
    } catch (error) {
      this.emitTransactionFailure({
        ...transactionMetaWithHash,
        message: extractErrorMessage(error),
        stage: resolveTransactionFailureStage(error, "confirmation"),
        ...buildFailureDiagnostics(error),
      });
      throw error;
    }

    if (waitResult.status === "pending") {
      this.emitTransactionPending(tx.transaction_hash, transactionMeta);
      void waitPromise
        .then((receipt) => {
          this.emit("transactionComplete", {
            details: receipt,
            ...transactionMeta,
          });
        })
        .catch((error) => {
          console.error(`Error waiting for transaction ${tx.transaction_hash}`, error);
          this.emitTransactionFailure({
            ...transactionMetaWithHash,
            message: extractErrorMessage(error),
            stage: resolveTransactionFailureStage(error, "background_confirmation"),
            ...buildFailureDiagnostics(error),
          });
        });

      return {
        statusReceipt: "PENDING",
        transaction_hash: tx.transaction_hash,
      } as any;
    }

    this.emit("transactionComplete", {
      details: waitResult.receipt,
      ...transactionMeta,
    });

    return waitResult.receipt;
  }

  async callAndReturnResult(signer: Account | AccountInterface, transactionDetails: DojoCall | Call) {
    const tx = await this.call(this.namespace ?? NAMESPACE, transactionDetails);
    return tx;
  }

  /**
   * Create hyperstructures for Blitz
   *
   * @param props - Properties for registration
   * @param props.count - Number of hyperstructures to create
   * @returns Transaction receipt
   */
  public async blitz_realm_make_hyperstructures(props: SystemProps.BlitzRealmMakeHyperstructuresProps) {
    const { count, signer } = props;
    const calls = [];

    if (this.VRF_PROVIDER_ADDRESS !== undefined && Number(this.VRF_PROVIDER_ADDRESS) !== 0) {
      const requestRandomCall: Call = {
        contractAddress: this.VRF_PROVIDER_ADDRESS!,
        entrypoint: "request_random",
        calldata: [getContractByName(this.manifest, `${this.namespace}-blitz_realm_systems`), 0, signer.address],
      };

      calls.push(requestRandomCall);
    }

    const makeHyperstructureCall: Call = {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-blitz_realm_systems`),
      entrypoint: "make_hyperstructures",
      calldata: [count],
    };
    calls.push(makeHyperstructureCall);
    return await this.promiseQueue.enqueue({
      signer,
      calls: calls,
      transactionType: TransactionType.MAKE_HYPERSTRUCTURES,
    });
  }

  /**
   * Assign Blitz realm positions for the player
   *
   * @param props - Properties for assignment
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async blitz_realm_assign_realm_positions(
    props: SystemProps.BlitzRealmAssignRealmPositionsProps,
  ): Promise<GetTransactionReceiptResponse> {
    const { signer } = props;
    const calls = [];

    if (this.VRF_PROVIDER_ADDRESS !== undefined && Number(this.VRF_PROVIDER_ADDRESS) !== 0) {
      const requestRandomCall: Call = {
        contractAddress: this.VRF_PROVIDER_ADDRESS!,
        entrypoint: "request_random",
        calldata: [getContractByName(this.manifest, `${this.namespace}-blitz_realm_systems`), 0, signer.address],
      };

      calls.push(requestRandomCall);
    }

    calls.push({
      contractAddress: getContractByName(this.manifest, `${this.namespace}-blitz_realm_systems`),
      entrypoint: "assign_realm_positions",
      calldata: [],
    });
    return await this.promiseQueue.enqueue({
      signer,
      calls: calls,
      transactionType: TransactionType.ASSIGN_REALM_POSITIONS,
    });
  }

  /**
   * Settle Blitz realms for the player
   *
   * @param props - Properties for settlement
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async blitz_realm_settle_realms(
    props: SystemProps.BlitzRealmSettleRealmsProps,
  ): Promise<GetTransactionReceiptResponse> {
    const { signer, settlement_count } = props;

    const calls: Call[] = [
      {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-blitz_realm_systems`),
        entrypoint: "settle_realms",
        calldata: [settlement_count],
      },
    ];

    return await this.promiseQueue.enqueue({ signer, calls: calls, transactionType: TransactionType.SETTLE_REALMS });
  }

  /**
   * Assign Blitz realm positions and immediately settle realms in a single transaction
   *
   * @param props - Properties for settlement
   * @param props.signer - Account executing the transaction
   * @param props.settlement_count - Number of realms to settle
   * @returns Transaction receipt
   */
  public async blitz_realm_assign_and_settle_realms(
    props: SystemProps.BlitzRealmSettleRealmsProps,
  ): Promise<GetTransactionReceiptResponse> {
    const { signer, settlement_count } = props;
    const calls: Call[] = [];

    if (this.VRF_PROVIDER_ADDRESS !== undefined && Number(this.VRF_PROVIDER_ADDRESS) !== 0) {
      const requestRandomCall: Call = {
        contractAddress: this.VRF_PROVIDER_ADDRESS!,
        entrypoint: "request_random",
        calldata: [getContractByName(this.manifest, `${this.namespace}-blitz_realm_systems`), 0, signer.address],
      };

      calls.push(requestRandomCall);
    }

    calls.push({
      contractAddress: getContractByName(this.manifest, `${this.namespace}-blitz_realm_systems`),
      entrypoint: "assign_realm_positions",
      calldata: [],
    });

    calls.push({
      contractAddress: getContractByName(this.manifest, `${this.namespace}-blitz_realm_systems`),
      entrypoint: "settle_realms",
      calldata: [settlement_count],
    });

    return await this.promiseQueue.enqueue({ signer, calls: calls, transactionType: TransactionType.SETTLE_REALMS });
  }

  /**
   * Wait for a transaction to complete and check for errors
   *
   * @param transactionHash - Hash of transaction to wait for
   * @returns Transaction receipt
   * @throws Error if transaction fails or is reverted
   */
  async waitForTransactionWithCheck(transactionHash: string): Promise<GetTransactionReceiptResponse> {
    return await this.waitForTransactionWithCheckInternal(transactionHash);
  }

  private async waitForTransactionWithTimeout(
    waitPromise: Promise<GetTransactionReceiptResponse>,
    timeoutMs: number,
  ): Promise<{ status: "confirmed"; receipt: GetTransactionReceiptResponse } | { status: "pending" }> {
    if (timeoutMs <= 0) {
      return { status: "confirmed", receipt: await waitPromise };
    }

    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<"timeout">((resolve) => {
      timeoutId = setTimeout(() => resolve("timeout"), timeoutMs);
    });

    const result = await Promise.race([waitPromise, timeoutPromise]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (result === "timeout") {
      return { status: "pending" };
    }

    return { status: "confirmed", receipt: result };
  }

  private async waitForTransactionWithCheckInternal(
    transactionHash: string,
    _transactionMeta?: TransactionLifecycleMeta,
  ): Promise<GetTransactionReceiptResponse> {
    if (!this.transactionStreamWaiter) {
      return {
        statusReceipt: "PENDING",
        transaction_hash: transactionHash,
      } as unknown as GetTransactionReceiptResponse;
    }

    const transaction = await this.transactionStreamWaiter(transactionHash).catch((error) => {
      throw attachTransactionFailureStage(error, "confirmation");
    });

    if (transaction.status === "REVERTED") {
      const rawRevertReason = transaction.revertReason;
      const revertReason = extractErrorMessage(rawRevertReason, "Unknown revert reason");
      const message = `Transaction failed with reason: ${revertReason}`;
      const revertError = attachTransactionFailureStage(new Error(message), "revert", message);
      if (rawRevertReason !== undefined) {
        revertError.rawRevertReason = rawRevertReason;
      }
      throw revertError;
    }

    return {
      block_number: transaction.block,
      finality_status: transaction.status,
      statusReceipt: transaction.status,
      transaction_hash: transaction.hash,
    } as GetTransactionReceiptResponse;
  }

  public async bridge_withdraw_from_realm(props: SystemProps.BridgeWithdrawFromRealmProps) {
    const { resources, from_structure_id, recipient_address, client_fee_recipient, signer } = props;

    const calls = resources.map((resource) => ({
      contractAddress: getContractByName(this.manifest, `${this.namespace}-resource_bridge_systems`),
      entrypoint: "withdraw",
      calldata: [from_structure_id, recipient_address, resource.tokenAddress, resource.amount, client_fee_recipient],
    }));
    return await this.executeAndCheckTransaction(signer, calls);
  }

  public async bridge_deposit_into_realm(props: SystemProps.BridgeDepositIntoRealmProps) {
    const { resources, recipient_structure_id, client_fee_recipient, signer } = props;
    const approvalCalls = resources.map((resource) => ({
      contractAddress: resource.tokenAddress as string,
      entrypoint: "approve",
      calldata: [
        getContractByName(this.manifest, `${this.namespace}-resource_bridge_systems`),
        resource.amount,
        0, // u128, u128
      ],
    }));

    const depositCalls = resources.map((resource) => ({
      contractAddress: getContractByName(this.manifest, `${this.namespace}-resource_bridge_systems`),
      entrypoint: "deposit",
      calldata: [
        resource.tokenAddress,
        recipient_structure_id,
        resource.amount,
        0, // u128, u128
        client_fee_recipient,
      ],
    }));
    return await this.executeAndCheckTransaction(signer, [...approvalCalls, ...depositCalls]);
  }

  /**
   * Create a new trade order
   *
   * @param props - Properties for creating the order
   * @param props.maker_id - ID of the realm creating the trade
   * @param props.maker_gives_resources - Resources the maker is offering
   * @param props.taker_id - ID of the realm that can accept the trade
   * @param props.taker_gives_resources - Resources requested from the taker
   * @param props.signer - Account executing the transaction
   * @param props.expires_at - When the trade expires
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Use realm 123 to create a trade offering 100 wood for 50 stone. Expires at timestamp 1704067200 (example timestamp). Maker is realm 123, taker is realm 456.
   * {
   *   contractAddress: "<s1_eternum-trade_systems>",
   *   entrypoint: "create_order",
   *   calldata: [
   *     123, // maker_id
   *     1,   // maker_gives_resources.length / 2 (1 resource type)
   *     1,   // resource type (wood)
   *     100, // amount
   *     456, // taker_id
   *     1,   // taker_gives_resources.length / 2 (1 resource type)
   *     2,   // resource type (stone)
   *     50,  // amount
   *     1704067200 // expires_at (example timestamp)
   *   ]
   * }
   * ```
   */
  public async create_order(props: SystemProps.CreateOrderProps) {
    const {
      maker_id,
      taker_id,
      maker_gives_resource_type,
      taker_pays_resource_type,
      maker_gives_min_resource_amount,
      maker_gives_max_count,
      taker_pays_min_resource_amount,
      expires_at,
      signer,
    } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-trade_systems`),
        entrypoint: "create_order",
        calldata: [
          maker_id,
          taker_id,
          maker_gives_resource_type,
          taker_pays_resource_type,
          maker_gives_min_resource_amount,
          maker_gives_max_count,
          taker_pays_min_resource_amount,
          expires_at,
        ],
      },
      transactionType: TransactionType.CREATE_ORDER,
    });
  }

  /**
   * Accept a trade order
   *
   * @param props - Properties for accepting the order
   * @param props.taker_id - ID of the realm accepting the trade
   * @param props.trade_id - ID of the trade being accepted
   * @param props.maker_gives_resources - Resources the maker is offering
   * @param props.taker_gives_resources - Resources requested from the taker
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * {
   *   contractAddress: "<s1_eternum-trade_systems>",
   *   entrypoint: "accept_order",
   *   calldata: [
   *     123, // taker_id
   *     789, // trade_id
   *     1,   // maker_gives_resources.length / 2 (1 resource type)
   *     1,   // resource type (wood)
   *     100, // amount
   *     1,   // taker_gives_resources.length / 2 (1 resource type)
   *     2,   // resource type (stone)
   *     50   // amount
   *   ]
   * }
   * ```
   */
  public async accept_order(props: SystemProps.AcceptOrderProps) {
    const { taker_id, trade_id, taker_buys_count, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-trade_systems`),
        entrypoint: "accept_order",
        calldata: [taker_id, trade_id, taker_buys_count],
      },
      transactionType: TransactionType.ACCEPT_ORDER,
    });
  }

  /**
   * Cancel a trade order
   *
   * @param props - Properties for canceling the order
   * @param props.trade_id - ID of the trade to cancel
   * @param props.return_resources - Resources to return
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * {
   *   contractAddress: "<s1_eternum-trade_systems>",
   *   entrypoint: "cancel_order",
   *   calldata: [
   *     789, // trade_id
   *     1,   // return_resources.length / 2 (1 resource type)
   *     1,   // resource type (wood)
   *     100  // amount
   *   ]
   * }
   * ```
   */
  public async cancel_order(props: SystemProps.CancelOrderProps) {
    const { trade_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-trade_systems`),
        entrypoint: "cancel_order",
        calldata: [trade_id],
      },
      transactionType: TransactionType.CANCEL_ORDER,
    });
  }

  /**
   * Mint resources for development/testing
   *
   * @param props - Properties for minting resources
   * @param props.receiver_id - ID of realm receiving resources
   * @param props.resources - Resources to mint
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Mint 100 wood and 50 stone
   * {
   *   receiver_id: 123,
   *   resources: [1, 100, 2, 50], // [wood ID, wood amount, stone ID, stone amount]
   *   signer: account
   * }
   * ```
   */
  public async mint_resources(props: SystemProps.MintResourcesProps) {
    const { receiver_id, resources } = props;

    return await this.executeAndCheckTransaction(props.signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-dev_resource_systems`),
      entrypoint: "mint",
      calldata: [receiver_id, resources.length / 2, ...resources],
    });
  }

  /**
   * Upgrade a realm's level
   *
   * @param props - Properties for upgrading realm
   * @param props.realm_entity_id - ID of realm to upgrade
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Upgrade realm 123
   * {
   *   realm_entity_id: 123,
   *   signer: account
   * }
   * ```
   */
  public async upgrade_realm(props: SystemProps.UpgradeRealmProps) {
    const { realm_entity_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-structure_systems`),
        entrypoint: "level_up",
        calldata: [realm_entity_id],
      },
      transactionType: TransactionType.LEVEL_UP,
    });
  }

  /**
   * Create a village connected to a realm
   *
   * @param props - Properties for creating a village
   * @param props.connected_realm - ID of the realm to connect the village to
   * @param props.direction - Direction from the realm to place the village
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Create a village connected to realm 123 in the north direction
   * {
   *   connected_realm: 123,
   *   direction: Direction.North,
   *   signer: account
   * }
   * ```
   */
  public async create_village(props: SystemProps.CreateVillageProps) {
    const { village_pass_token_id, connected_realm, direction, signer } = props;

    let callData: Call[] = [];

    if (this.VRF_PROVIDER_ADDRESS !== undefined && Number(this.VRF_PROVIDER_ADDRESS) !== 0) {
      const requestRandomCall: Call = {
        contractAddress: this.VRF_PROVIDER_ADDRESS!,
        entrypoint: "request_random",
        calldata: [getContractByName(this.manifest, `${this.namespace}-village_systems`), 0, signer.address],
      };

      callData = [requestRandomCall];
    }

    const createCall: Call = {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-village_systems`),
      entrypoint: "create",
      calldata: [village_pass_token_id, connected_realm, direction],
    };

    return await this.promiseQueue.enqueue({
      signer,
      calls: [...callData, createCall],
      transactionType: TransactionType.CREATE,
    });
  }

  /**
   * Claim the village army grant once its delay has passed
   *
   * @param props - Properties for claiming village army grant
   * @param props.village_id - ID of the village to claim for
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async receive_army_grant(props: SystemProps.ReceiveArmyGrantProps) {
    const { village_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-village_systems`),
        entrypoint: "receive_army_grant",
        calldata: [village_id],
      },
      transactionType: TransactionType.CREATE,
    });
  }

  /**
   * Create multiple realms at once
   *
   * @param props - Properties for creating realms
   * @param props.realm_ids - Array of realm IDs to create
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Create realms with IDs 123, 456, 789
   * {
   *   realm_ids: [123, 456, 789],
   *   signer: account
   * }
   * ```
   */
  public async create_multiple_realms(props: SystemProps.CreateMultipleRealmsProps) {
    const { realms, owner, signer } = props;

    const realmSystemsContractAddress = getContractByName(this.manifest, `${this.namespace}-realm_systems`);

    const createTxs: QueueableTransaction[] = realms.map((realm) => ({
      signer,
      calls: {
        contractAddress: realmSystemsContractAddress,
        entrypoint: "create",
        calldata: [owner, realm.realm_id, realm.realm_settlement],
      },
      transactionType: TransactionType.CREATE,
    }));

    const txs = createTxs;
    return await Promise.all(txs.map((tx) => this.promiseQueue.enqueue(tx)));
  }

  /**
   * Mint a test realm, mint season passes, and create a realm in one transaction
   *
   * @param props - Properties for creating a test realm
   * @param props.token_id - Token ID for the realm
   * @param props.realms_address - Address of the realms contract
   * @param props.season_pass_address - Address of the season pass contract
   * @param props.realm_settlement - Settlement location for the realm
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Mint and settle a test realm with ID 123
   * {
   *   token_id: 123,
   *   realms_address: "0x123...",
   *   season_pass_address: "0x456...",
   *   realm_settlement: {
   *     side: 1,
   *     layer: 2,
   *     point: 3
   *   },
   *   signer: account
   * }
   * ```
   */
  public async mint_and_settle_test_realm(props: SystemProps.MintAndSettleTestRealmProps) {
    // const { token_id, realms_address, season_pass_address, realm_settlement, signer } = props;
    const { signer } = props;

    // const mintRealmCall = {
    //   contractAddress: realms_address.toString(),
    //   entrypoint: "mint",
    //   calldata: [uint256.bnToUint256(token_id)],
    // };

    // const mintSeasonPassCall = {
    //   contractAddress: season_pass_address.toString(),
    //   entrypoint: "mint",
    //   calldata: [signer.address, uint256.bnToUint256(token_id)],
    // };

    // const realmSystemsContractAddress = getContractByName(this.manifest, `${this.namespace}-blitz_realm_systems`);

    // const approvalForAllCall = {
    //   contractAddress: season_pass_address,
    //   entrypoint: "set_approval_for_all",
    //   calldata: [realmSystemsContractAddress, true],
    // };

    const createRealmCall = {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-ownership_systems`),
      entrypoint: "transfer_structure_ownership",
      calldata: ["171", "0x0018251388AADDb93472aa8aB7c5f147cd94252fE47a46A4De7707313b1B8dB2"],
    };

    // const approvalCloseForAllCall = {
    //   contractAddress: season_pass_address,
    //   entrypoint: "set_approval_for_all",
    //   calldata: [realmSystemsContractAddress, false],
    // };

    return await this.executeAndCheckTransaction(signer, [
      // mintRealmCall,
      // mintSeasonPassCall,
      // approvalForAllCall,
      createRealmCall,
      // approvalCloseForAllCall,
    ]);
  }

  /**
   * Send resources from one entity to another
   *
   * @param props - Properties for sending resources
   * @param props.sender_entity_id - ID of the entity sending resources
   * @param props.recipient_entity_id - ID of the entity receiving resources
   * @param props.resources - Array of resource amounts to send
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Send 100 wood and 50 stone from entity 123 to entity 456
   * {
   *   sender_entity_id: 123,
   *   recipient_entity_id: 456,
   *   resources: [1, 100, 2, 50], // [resourceId, amount, resourceId, amount]
   *   signer: account
   * }
   * ```
   */
  public async send_resources(props: SystemProps.SendResourcesProps) {
    const { sender_entity_id, recipient_entity_id, resources, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-resource_systems`),
        entrypoint: "send",
        calldata: [
          sender_entity_id,
          recipient_entity_id,
          resources.length,
          ...resources.flatMap(({ resource, amount }) => [resource, amount]),
        ],
      },
      transactionType: TransactionType.SEND,
    });
  }

  /**
   * Send resources from multiple entities
   *
   * @param props - Properties for sending multiple resources
   * @param props.calls - Array of send resource calls
   * @param props.calls[].sender_entity_id - ID of the entity sending resources
   * @param props.calls[].recipient_entity_id - ID of the entity receiving resources
   * @param props.calls[].resources - Array of resource amounts to send
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Send resources from multiple entities
   * {
   *   calls: [
   *     {
   *       sender_entity_id: 123,
   *       recipient_entity_id: 456,
   *       resources: [1, 100, 2, 50]
   *     },
   *     {
   *       sender_entity_id: 789,
   *       recipient_entity_id: 101,
   *       resources: [3, 75, 4, 25]
   *     }
   *   ],
   *   signer: account
   * }
   * ```
   */
  public async send_resources_multiple(props: SystemProps.SendResourcesMultipleProps) {
    const { calls, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: calls.map((call) => ({
        contractAddress: getContractByName(this.manifest, `${this.namespace}-resource_systems`),
        entrypoint: "send",
        calldata: [call.sender_entity_id, call.recipient_entity_id, call.resources.length / 2, ...call.resources],
      })),
      transactionType: TransactionType.SEND,
    });
  }

  /**
   * Pickup resources from an entity after approval
   *
   * @param props - Properties for picking up resources
   * @param props.recipient_entity_id - ID of the entity receiving resources
   * @param props.owner_entity_id - ID of the entity that owns the resources
   * @param props.resources - Array of resource amounts to pickup
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Pickup 100 wood and 50 stone from entity 123 to entity 456
   * {
   *   recipient_entity_id: 456,
   *   owner_entity_id: 123,
   *   resources: [1, 100, 2, 50], // [resourceId, amount, resourceId, amount]
   *   signer: account
   * }
   * ```
   */
  public async pickup_resources(props: SystemProps.PickupResourcesProps) {
    const { recipient_entity_id, owner_entity_id, resources, signer } = props;

    const approvalCall = {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-resource_systems`),
      entrypoint: "approve",
      calldata: [
        owner_entity_id,
        recipient_entity_id,
        resources.length,
        ...resources.flatMap(({ resource, amount }) => [resource, amount]),
      ],
    };

    const pickupCall = {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-resource_systems`),
      entrypoint: "pickup",
      calldata: [
        recipient_entity_id,
        owner_entity_id,
        resources.length,
        ...resources.flatMap(({ resource, amount }) => [resource, amount]),
      ],
    };

    return await this.promiseQueue.enqueue({
      signer,
      calls: [approvalCall, pickupCall],
      transactionType: TransactionType.PICKUP,
    });
  }

  public async arrivals_offload(props: SystemProps.ArrivalsOffloadProps) {
    const { structureId, day, slot, resource_count, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-resource_systems`),
        entrypoint: "arrivals_offload",
        calldata: [structureId, day, slot, resource_count],
      },
      transactionType: TransactionType.ARRIVALS_OFFLOAD,
    });
  }

  /**
   * Set a name for an address
   *
   * @param props - Properties for setting address name
   * @param props.name - Name to set for the address
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Set name "Player1" for address
   * {
   *   name: "Player1",
   *   signer: account
   * }
   * ```
   */
  public async set_address_name(props: SystemProps.SetAddressNameProps) {
    const { name, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-name_systems`),
        entrypoint: "set_address_name",
        calldata: [name],
      },
      transactionType: TransactionType.SET_ADDRESS_NAME,
    });
  }

  /**
   * Set a name for an entity
   *
   * @param props - Properties for setting entity name
   * @param props.entity_id - ID of the entity to name
   * @param props.name - Name to set for the entity
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Set name "Castle1" for entity 123
   * {
   *   entity_id: 123,
   *   name: "Castle1",
   *   signer: account
   * }
   * ```
   */
  public async set_entity_name(props: SystemProps.SetEntityNameProps) {
    const { entity_id, name, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-name_systems`),
        entrypoint: "set_entity_name",
        calldata: [entity_id, name],
      },
      transactionType: TransactionType.SET_ENTITY_NAME,
    });
  }

  /**
   * Create a new building
   *
   * @param props - Properties for creating building
   * @param props.entity_id - ID of the entity creating the building
   * @param props.directions - Array of directions for building placement
   * @param props.building_category - Category of building to create
   * @param props.produce_resource_type - Type of resource the building will produce
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Create a wood production building at coordinates determined by directions [1,2]
   * {
   *   contractAddress: "<s1_eternum-production_systems>",
   *   entrypoint: "create_building",
   *   calldata: [
   *     123,     // entity_id
   *     [1, 2],  // directions array
   *     1,       // building_category (e.g. 1 for resource production)
   *     1        // produce_resource_type (e.g. 1 for wood) for farms and fishing villages use 0
   *   ]
   * }
   * ```
   */
  public async create_building(props: SystemProps.CreateBuildingProps): Promise<GetTransactionReceiptResponse> {
    const { entity_id, directions, building_category, use_simple, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-production_systems`),
        entrypoint: "create_building",
        calldata: CallData.compile([entity_id, directions, building_category, use_simple]),
      },
      transactionType: TransactionType.CREATE_BUILDING,
    });
  }

  /**
   * Destroy an existing building
   *
   * @param props - Properties for destroying building
   * @param props.entity_id - ID of the entity destroying the building
   * @param props.building_coord - Coordinates of building to destroy
   * @param props.building_coord.alt - Whether this is an alt map coordinate (default: false)
   * @param props.building_coord.x - X coordinate of building
   * @param props.building_coord.y - Y coordinate of building
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Destroy building at coordinates (10, 20)
   * {
   *   contractAddress: "<s1_eternum-production_systems>",
   *   entrypoint: "destroy_building",
   *   calldata: [
   *     123,     // entity_id
   *     false,   // building_coord.alt
   *     10,      // building_coord.x
   *     20       // building_coord.y
   *   ]
   * }
   * ```
   */
  public async destroy_building(props: SystemProps.DestroyBuildingProps) {
    const { entity_id, building_coord, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-production_systems`),
        entrypoint: "destroy_building",
        calldata: CallData.compile([
          entity_id,
          { alt: building_coord.alt ?? false, x: building_coord.x, y: building_coord.y },
        ]),
      },
      transactionType: TransactionType.DESTROY_BUILDING,
    });
  }

  /**
   * Pause production at a building
   *
   * @param props - Properties for pausing production
   * @param props.entity_id - ID of the entity that owns the building
   * @param props.building_coord - Coordinates of the building
   * @param props.building_coord.alt - Whether this is an alt map coordinate (default: false)
   * @param props.building_coord.x - X coordinate of the building
   * @param props.building_coord.y - Y coordinate of the building
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Pause production at building at coordinates (10, 20)
   * {
   *   entity_id: 123,
   *   building_coord: { alt: false, x: 10, y: 20 },
   *   signer: account
   * }
   * ```
   */
  public async pause_production(props: SystemProps.PauseProductionProps) {
    const { entity_id, building_coord, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-production_systems`),
        entrypoint: "pause_building_production",
        calldata: CallData.compile([
          entity_id,
          { alt: building_coord.alt ?? false, x: building_coord.x, y: building_coord.y },
        ]),
      },
      transactionType: TransactionType.PAUSE_BUILDING_PRODUCTION,
    });
  }

  /**
   * Resume production at a building
   *
   * @param props - Properties for resuming production
   * @param props.entity_id - ID of the entity that owns the building
   * @param props.building_coord - Coordinates of the building
   * @param props.building_coord.alt - Whether this is an alt map coordinate (default: false)
   * @param props.building_coord.x - X coordinate of the building
   * @param props.building_coord.y - Y coordinate of the building
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Resume production at building at coordinates (10, 20)
   * {
   *   entity_id: 123,
   *   building_coord: { alt: false, x: 10, y: 20 },
   *   signer: account
   * }
   * ```
   */
  public async resume_production(props: SystemProps.ResumeProductionProps) {
    const { entity_id, building_coord, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-production_systems`),
        entrypoint: "resume_building_production",
        calldata: CallData.compile([
          entity_id,
          { alt: building_coord.alt ?? false, x: building_coord.x, y: building_coord.y },
        ]),
      },
      transactionType: TransactionType.RESUME_BUILDING_PRODUCTION,
    });
  }

  public async execute_realm_production_plan(
    props: SystemProps.ExecuteRealmProductionPlanProps,
  ): Promise<GetTransactionReceiptResponse | undefined> {
    const { signer, realm_entity_id, skipQueue } = props;
    const productionSystemsAddress = getContractByName(this.manifest, `${this.namespace}-production_systems`);

    const sanitizeInstructions = (
      instructions: SystemProps.ProductionPlanInstruction[] | undefined,
    ): { resource: string; cycles: string }[] => {
      if (!instructions?.length) return [];
      return instructions
        .map(({ resource_id, cycles }) => {
          const normalizeResource = (value: BigNumberish) => {
            if (typeof value === "bigint") return value.toString();
            if (typeof value === "number") return Math.floor(value).toString();
            if (typeof value === "string") {
              const parsed = Number(value);
              if (Number.isFinite(parsed)) {
                return Math.floor(parsed).toString();
              }
              return value;
            }
            return String(value);
          };

          const normalizeCycles = (value: BigNumberish) => {
            if (typeof value === "bigint") return value.toString();
            if (typeof value === "number") return Math.floor(value).toString();
            if (typeof value === "string") {
              if (value.startsWith("0x") || value.startsWith("0X")) {
                try {
                  return BigInt(value).toString();
                } catch {
                  return "0";
                }
              }
              const parsed = Number(value);
              if (Number.isFinite(parsed)) {
                return Math.floor(parsed).toString();
              }
            }
            return String(value);
          };

          const normalizedCycles = normalizeCycles(cycles);
          const normalizedResource = normalizeResource(resource_id);

          const cyclesNumber = Number(normalizedCycles);

          return {
            resource: normalizedResource,
            cycles: Number.isFinite(cyclesNumber) ? Math.max(0, Math.floor(cyclesNumber)).toString() : "0",
          };
        })
        .filter((item) => Number(item.cycles) > 0);
    };

    const resourceInstructions = sanitizeInstructions(props.resource_to_resource);
    const laborInstructions = sanitizeInstructions(props.labor_to_resource);

    if (!resourceInstructions.length && !laborInstructions.length) {
      console.warn("execute_realm_production_plan called with no executable instructions");
      return undefined;
    }

    const calls: Call[] = [];

    if (resourceInstructions.length) {
      const producedResourceTypes = resourceInstructions.map((item) => item.resource);
      const productionCycles = resourceInstructions.map((item) => item.cycles);

      calls.push({
        contractAddress: productionSystemsAddress,
        entrypoint: "burn_resource_for_resource_production",
        calldata: [
          realm_entity_id,
          producedResourceTypes.length,
          ...producedResourceTypes,
          productionCycles.length,
          ...productionCycles,
        ],
      });
    }

    if (laborInstructions.length) {
      const producedResourceTypes = laborInstructions.map((item) => item.resource);
      const productionCycles = laborInstructions.map((item) => item.cycles);

      calls.push({
        contractAddress: productionSystemsAddress,
        entrypoint: "burn_labor_for_resource_production",
        calldata: [
          realm_entity_id,
          productionCycles.length,
          ...productionCycles,
          producedResourceTypes.length,
          ...producedResourceTypes,
        ],
      });
    }

    const callArgs: AllowArray<Call> = calls.length === 1 ? calls[0] : calls;

    if (skipQueue) {
      return await this.executeAndCheckTransaction(signer, callArgs, undefined, {
        transactionType: TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION,
      });
    }

    return await this.promiseQueue.enqueue({
      signer,
      calls: callArgs,
      transactionType: TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION,
    });
  }

  /**
   * Create an admin bank
   *
   * @param props - Properties for creating an admin bank
   * @param props.banks - Banks to create
   * @param props.banks[].name - Name of the admin bank
   * @param props.banks[].coord - Coordinates for the bank location
   * @param props.banks[].coord.alt - Whether this is an alt map coordinate (default: false)
   * @param props.banks[].coord.x - X coordinate of the bank
   * @param props.banks[].coord.y - Y coordinate of the bank
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Create an admin bank with 1% fees
   * {
   *   banks: [
   *     {
   *       name: "Admin Bank 1",
   *       coord: { alt: false, x: 10, y: 20 },
   *     },
   *   ],
   *   signer: account,
   * }
   * ```
   */
  public async create_banks(props: SystemProps.CreateAdminBanksProps) {
    const { banks, signer } = props;
    const bankCalldata = banks.flatMap((bank) => [bank.name, bank.coord.alt ?? false, bank.coord.x, bank.coord.y]);

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-bank_systems`),
      entrypoint: "create_banks",
      calldata: [banks.length, ...bankCalldata],
    });
  }

  /**
   * Change the owner fee for a bank
   *
   * @param props - Properties for changing bank owner fee
   * @param props.bank_entity_id - ID of the bank to modify
   * @param props.new_swap_fee_num - New numerator for swap fee calculation
   * @param props.new_swap_fee_denom - New denominator for swap fee calculation
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Change bank 123's owner fee to 1/100 (1%)
   * {
   *   bank_entity_id: 123,
   *   new_swap_fee_num: 1,
   *   new_swap_fee_denom: 100,
   *   signer: account
   * }
   * ```
   */
  public async change_bank_owner_fee(props: SystemProps.ChangeBankOwnerFeeProps) {
    const { bank_entity_id, new_swap_fee_num, new_swap_fee_denom, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-bank_systems`),
      entrypoint: "change_owner_amm_fee",
      calldata: [bank_entity_id, new_swap_fee_num, new_swap_fee_denom],
    });
  }

  /**
   * Change the bridge fees for a bank
   *
   * @param props - Properties for changing bank bridge fees
   * @param props.bank_entity_id - ID of the bank to modify
   * @param props.new_bridge_fee_dpt_percent - New deposit fee percentage
   * @param props.new_bridge_fee_wtdr_percent - New withdrawal fee percentage
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Change bank 123's bridge fees to 2% for deposits and 3% for withdrawals
   * {
   *   bank_entity_id: 123,
   *   new_bridge_fee_dpt_percent: 2,
   *   new_bridge_fee_wtdr_percent: 3,
   *   signer: account
   * }
   * ```
   */
  public async change_bank_bridge_fee(props: SystemProps.ChangeBankBridgeFeeProps) {
    const { bank_entity_id, new_bridge_fee_dpt_percent, new_bridge_fee_wtdr_percent, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-bank_systems`),
      entrypoint: "change_owner_bridge_fee",
      calldata: [bank_entity_id, new_bridge_fee_dpt_percent, new_bridge_fee_wtdr_percent],
    });
  }

  /**
   * Buy resources from a bank
   *
   * @param props - Properties for buying resources
   * @param props.bank_entity_id - ID of the bank to buy from
   * @param props.entity_id - ID of the entity buying resources
   * @param props.resource_type - Type of resource to buy
   * @param props.amount - Amount of resource to buy
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Buy 100 units of resource type 1 from bank 456
   * {
   *   bank_entity_id: 456,
   *   entity_id: 123,
   *   resource_type: 1,
   *   amount: 100,
   *   signer: account
   * }
   * ```
   */
  public async buy_resources(props: SystemProps.BuyResourcesProps) {
    const { bank_entity_id, entity_id, resource_type, amount, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-swap_systems`),
        entrypoint: "buy",
        calldata: [bank_entity_id, entity_id, resource_type, amount],
      },
      transactionType: TransactionType.BUY,
    });
  }

  /**
   * Sell resources to a bank
   *
   * @param props - Properties for selling resources
   * @param props.bank_entity_id - ID of the bank to sell to
   * @param props.entity_id - ID of the entity selling resources
   * @param props.resource_type - Type of resource to sell
   * @param props.amount - Amount of resource to sell
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Sell 50 units of resource type 2 to bank 456
   * {
   *   bank_entity_id: 456,
   *   entity_id: 123,
   *   resource_type: 2,
   *   amount: 50,
   *   signer: account
   * }
   * ```
   */
  public async sell_resources(props: SystemProps.SellResourcesProps) {
    const { bank_entity_id, entity_id, resource_type, amount, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-swap_systems`),
        entrypoint: "sell",
        calldata: [bank_entity_id, entity_id, resource_type, amount],
      },
      transactionType: TransactionType.SELL,
    });
  }

  /**
   * Add liquidity to a bank's pool
   *
   * @param props - Properties for adding liquidity
   * @param props.bank_entity_id - ID of the bank to add liquidity to
   * @param props.entity_id - ID of the entity providing liquidity
   * @param props.calls - Array of liquidity addition calls
   * @param props.calls[].resource_type - Type of resource to add
   * @param props.calls[].resource_amount - Amount of resource to add
   * @param props.calls[].lords_amount - Amount of LORDS tokens to add
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Add liquidity with 100 units of resource type 1 and 200 LORDS
   * {
   *   bank_entity_id: 456,
   *   entity_id: 123,
   *   calls: [{
   *     resource_type: 1,
   *     resource_amount: 100,
   *     lords_amount: 200
   *   }],
   *   signer: account
   * }
   * ```
   */
  public async add_liquidity(props: SystemProps.AddLiquidityProps) {
    const { bank_entity_id, entity_id, calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${this.namespace}-liquidity_systems`),
          entrypoint: "add",
          calldata: [bank_entity_id, entity_id, call.resource_type, call.resource_amount, call.lords_amount],
        };
      }),
    );
  }

  public async add_initial_bank_liquidity(props: SystemProps.AddLiquidityProps) {
    const { bank_entity_id, entity_id, calls, signer } = props;

    const finalCalls: AllowArray<Call> = [];
    calls.forEach((call) => {
      // mint the resource and lords to the bank
      let resources = [SystemProps.ResourcesIds.Lords, call.lords_amount, call.resource_type, call.resource_amount];
      finalCalls.push({
        contractAddress: getContractByName(this.manifest, `${this.namespace}-dev_resource_systems`),
        entrypoint: "mint",
        calldata: [bank_entity_id, resources.length / 2, ...resources],
      });

      // add the liquidity to the bank
      finalCalls.push({
        contractAddress: getContractByName(this.manifest, `${this.namespace}-liquidity_systems`),
        entrypoint: "add",
        calldata: [bank_entity_id, entity_id, call.resource_type, call.resource_amount, call.lords_amount],
      });
    });

    return await this.executeAndCheckTransaction(signer, finalCalls);
  }

  /**
   * Remove liquidity from a bank's pool
   *
   * @param props - Properties for removing liquidity
   * @param props.bank_entity_id - ID of the bank to remove liquidity from
   * @param props.entity_id - ID of the entity removing liquidity
   * @param props.resource_type - Type of resource to remove
   * @param props.shares - Amount of liquidity shares to remove
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Remove 50 shares of liquidity for resource type 1
   * {
   *   bank_entity_id: 456,
   *   entity_id: 123,
   *   resource_type: 1,
   *   shares: 50,
   *   signer: account
   * }
   * ```
   */
  public async remove_liquidity(props: SystemProps.RemoveLiquidityProps) {
    const { bank_entity_id, entity_id, resource_type, shares, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-liquidity_systems`),
        entrypoint: "remove",
        calldata: [bank_entity_id, entity_id, resource_type, shares],
      },
      transactionType: TransactionType.REMOVE,
    });
  }

  /**
   * Add troops to a guard slot
   *
   * @param props - Properties for adding troops to a guard
   * @param props.for_structure_id - ID of the structure to add guard troops to
   * @param props.slot - Guard slot to place troops in
   * @param props.category - Type of troops to add
   * @param props.tier - Tier of troops to add
   * @param props.amount - Number of troops to add
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async guard_add(props: SystemProps.GuardAddProps) {
    const { for_structure_id, slot, category, tier, amount, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_management_systems`),
        entrypoint: "guard_add",
        calldata: [for_structure_id, slot, category, tier, amount],
      },
      transactionType: TransactionType.GUARD_ADD,
    });
  }

  /**
   * Delete troops from a guard slot
   *
   * @param props - Properties for deleting guard troops
   * @param props.for_structure_id - ID of the structure to remove guard troops from
   * @param props.slot - Guard slot to remove troops from
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async guard_delete(props: SystemProps.GuardDeleteProps) {
    const { for_structure_id, slot, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_management_systems`),
        entrypoint: "guard_delete",
        calldata: [for_structure_id, slot],
      },
      transactionType: TransactionType.GUARD_DELETE,
    });
  }

  /**
   * Create a new explorer with troops
   *
   * @param props - Properties for creating an explorer
   * @param props.for_structure_id - ID of the structure creating the explorer
   * @param props.category - Type of troops to add
   * @param props.tier - Tier of troops to add
   * @param props.amount - Number of troops to add
   * @param props.spawn_direction - Direction to spawn the explorer
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt with the new explorer ID
   */
  public async explorer_create(props: SystemProps.ExplorerCreateProps) {
    const { for_structure_id, category, tier, amount, spawn_direction, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_management_systems`),
        entrypoint: "explorer_create",
        calldata: [for_structure_id, category, tier, amount, spawn_direction],
      },
      transactionType: TransactionType.EXPLORER_CREATE,
    });
  }

  /**
   * Add troops to an existing explorer
   *
   * @param props - Properties for adding troops to an explorer
   * @param props.to_explorer_id - ID of the explorer to add troops to
   * @param props.amount - Number of troops to add
   * @param props.home_direction - Direction to the explorer's home
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async explorer_add(props: SystemProps.ExplorerAddProps) {
    const { to_explorer_id, amount, home_direction, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_management_systems`),
        entrypoint: "explorer_add",
        calldata: [to_explorer_id, amount, home_direction],
      },
      transactionType: TransactionType.EXPLORER_ADD,
    });
  }

  /**
   * Delete an explorer and its troops
   *
   * @param props - Properties for deleting an explorer
   * @param props.explorer_id - ID of the explorer to delete
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async explorer_delete(props: SystemProps.ExplorerDeleteProps) {
    const { explorer_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_management_systems`),
        entrypoint: "explorer_delete",
        calldata: [explorer_id],
      },
      transactionType: TransactionType.EXPLORER_DELETE,
    });
  }

  /**
   * Transfer resources from one troop to another adjacent troop
   *
   * @param props - Properties for transferring resources between troops
   * @param props.from_troop_id - ID of the troop sending resources
   * @param props.to_troop_id - ID of the troop receiving resources
   * @param props.resources - Array of resource type and amount tuples to transfer
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async troop_troop_adjacent_transfer(props: SystemProps.TroopTroopAdjacentTransferProps) {
    const { from_troop_id, to_troop_id, resources, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-resource_systems`),
        entrypoint: "troop_troop_adjacent_transfer",
        calldata: [
          from_troop_id,
          to_troop_id,
          resources.length,
          ...resources.flatMap(({ resourceId, amount }) => [resourceId, amount]),
        ],
      },
      transactionType: TransactionType.TROOP_TROOP_ADJACENT_TRANSFER,
    });
  }

  /**
   * Transfer resources from a troop to an adjacent structure
   *
   * @param props - Properties for transferring resources from troop to structure
   * @param props.from_explorer_id - ID of the explorer sending resources
   * @param props.to_structure_id - ID of the structure receiving resources
   * @param props.resources - Array of resource type and amount tuples to transfer
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async troop_structure_adjacent_transfer(props: SystemProps.TroopStructureAdjacentTransferProps) {
    const { from_explorer_id, to_structure_id, resources, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-resource_systems`),
        entrypoint: "troop_structure_adjacent_transfer",
        calldata: [
          from_explorer_id,
          to_structure_id,
          resources.length,
          ...resources.flatMap(({ resourceId, amount }) => [resourceId, amount]),
        ],
      },
      transactionType: TransactionType.TROOP_STRUCTURE_ADJACENT_TRANSFER,
    });
  }

  /**
   * Transfer resources from a structure to an adjacent troop
   *
   * @param props - Properties for transferring resources from structure to troop
   * @param props.from_structure_id - ID of the structure sending resources
   * @param props.to_troop_id - ID of the troop receiving resources
   * @param props.resources - Array of resource type and amount tuples to transfer
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async structure_troop_adjacent_transfer(props: SystemProps.StructureTroopAdjacentTransferProps) {
    const { from_structure_id, to_troop_id, resources, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-resource_systems`),
        entrypoint: "structure_troop_adjacent_transfer",
        calldata: [
          from_structure_id,
          to_troop_id,
          resources.length,
          ...resources.flatMap(({ resourceId, amount }) => [resourceId, amount]),
        ],
      },
      transactionType: TransactionType.STRUCTURE_TROOP_ADJACENT_TRANSFER,
    });
  }

  /**
   * Swap troops between two explorers
   *
   * @param props - Properties for swapping troops between explorers
   * @param props.from_explorer_id - ID of the explorer sending troops
   * @param props.to_explorer_id - ID of the explorer receiving troops
   * @param props.to_explorer_direction - Direction to the receiving explorer
   * @param props.count - Number of troops to swap
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async explorer_explorer_swap(props: SystemProps.ExplorerExplorerSwapProps) {
    const { from_explorer_id, to_explorer_id, to_explorer_direction, count, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_management_systems`),
        entrypoint: "explorer_explorer_swap",
        calldata: [from_explorer_id, to_explorer_id, to_explorer_direction, count],
      },
      transactionType: TransactionType.EXPLORER_EXPLORER_SWAP,
    });
  }

  /**
   * Swap troops from an explorer to a guard
   *
   * @param props - Properties for swapping troops from explorer to guard
   * @param props.from_explorer_id - ID of the explorer sending troops
   * @param props.to_structure_id - ID of the structure receiving troops
   * @param props.to_structure_direction - Direction to the receiving structure
   * @param props.to_guard_slot - Guard slot to place troops in
   * @param props.count - Number of troops to swap
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async explorer_guard_swap(props: SystemProps.ExplorerGuardSwapProps) {
    const { from_explorer_id, to_structure_id, to_structure_direction, to_guard_slot, count, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_management_systems`),
        entrypoint: "explorer_guard_swap",
        calldata: [from_explorer_id, to_structure_id, to_structure_direction, to_guard_slot, count],
      },
      transactionType: TransactionType.EXPLORER_GUARD_SWAP,
    });
  }

  /**
   * Swap troops from a guard to an explorer
   *
   * @param props - Properties for swapping troops from guard to explorer
   * @param props.from_structure_id - ID of the structure sending troops
   * @param props.from_guard_slot - Guard slot to take troops from
   * @param props.to_explorer_id - ID of the explorer receiving troops
   * @param props.to_explorer_direction - Direction to the receiving explorer
   * @param props.count - Number of troops to swap
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async guard_explorer_swap(props: SystemProps.GuardExplorerSwapProps) {
    const { from_structure_id, from_guard_slot, to_explorer_id, to_explorer_direction, count, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_management_systems`),
        entrypoint: "guard_explorer_swap",
        calldata: [from_structure_id, from_guard_slot, to_explorer_id, to_explorer_direction, count],
      },
      transactionType: TransactionType.GUARD_EXPLORER_SWAP,
    });
  }

  /**
   * Toggle explorer to the alternate layer through an adjacent spire
   *
   * @param props - Properties for toggling explorer layer
   * @param props.explorer_id - ID of the explorer to move
   * @param props.spire_direction - Direction from explorer to adjacent spire
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async toggle_alternate(props: SystemProps.ToggleAlternateProps) {
    const { explorer_id, spire_direction, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-alt_movement_systems`),
        entrypoint: "toggle_alternate",
        calldata: [explorer_id, spire_direction],
      },
      transactionType: TransactionType.TRAVEL_HEX,
    });
  }

  /**
   * Move an explorer without exploring (can be batched with other transactions)
   *
   * @param props - Properties for traveling an explorer
   * @param props.explorer_id - ID of the explorer to move
   * @param props.directions - Array of directions to move in
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async explorer_travel(props: SystemProps.ExplorerTravelProps) {
    const { explorer_id, directions, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_movement_systems`),
        entrypoint: "explorer_move",
        calldata: [explorer_id, directions, 0],
      },
      transactionType: TransactionType.TRAVEL_HEX,
    });
  }

  /**
   * Move an explorer and explore new tiles (never batched - executed in isolation)
   *
   * @param props - Properties for exploring with an explorer
   * @param props.explorer_id - ID of the explorer to move
   * @param props.directions - Array of directions to move in
   * @param props.vrf_source_salt - Packed destination tile seed (Source::Salt)
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async explorer_explore(props: SystemProps.ExplorerExploreProps) {
    const { explorer_id, directions, signer, vrf_source_salt } = props;

    const troopMovementSystemsAddress = getContractByName(this.manifest, `${this.namespace}-troop_movement_systems`);
    const callData: Call[] = [];

    // explorer_move now consumes Source::Salt(tile.to_seed()).
    if (isVrfEnabled(this.VRF_PROVIDER_ADDRESS)) {
      if (vrf_source_salt === undefined) {
        throw new Error(
          "explorer_explore requires vrf_source_salt when VRF is enabled. Use packTileSeed({ alt, col, row }) for the destination tile.",
        );
      }
      callData.push(
        createVrfRequestRandomCall({
          vrfProviderAddress: this.VRF_PROVIDER_ADDRESS,
          addressToCall: troopMovementSystemsAddress,
          source: { type: "salt", value: vrf_source_salt },
        }),
      );
    }

    // Explorer move with explore=1
    callData.push({
      contractAddress: troopMovementSystemsAddress,
      entrypoint: "explorer_move",
      calldata: [explorer_id, directions, 1],
    });

    // Extract reward
    callData.push({
      contractAddress: troopMovementSystemsAddress,
      entrypoint: "explorer_extract_reward",
      calldata: [explorer_id],
    });

    this.emit("transactionProgress", {
      stage: "explore_calls_built",
      type: TransactionType.EXPLORE,
      explorerId: explorer_id,
      signerAddress: this.getSignerAddress(signer),
    });

    return await this.promiseQueue.enqueue({ signer, calls: callData, transactionType: TransactionType.EXPLORE });
  }

  /**
   * @deprecated Use explorer_travel or explorer_explore instead
   *
   * @param props - Properties for moving an explorer
   * @param props.explorer_id - ID of the explorer to move
   * @param props.directions - Array of directions to move in
   * @param props.explore - Whether to explore new tiles along the way
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async explorer_move(props: SystemProps.ExplorerMoveProps) {
    const { explorer_id, directions, explore, signer, vrf_source_salt } = props;

    if (explore) {
      return await this.explorer_explore({ explorer_id, directions, signer, vrf_source_salt });
    } else {
      return await this.explorer_travel({ explorer_id, directions, signer });
    }
  }
  /**
   * Attack an explorer with another explorer
   *
   * @param props - Properties for explorer vs explorer attack
   * @param props.aggressor_id - ID of the attacking explorer
   * @param props.defender_id - ID of the defending explorer
   * @param props.steal_resources - Resources to steal, as array of [resourceId, amount] tuples
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async attack_explorer_vs_explorer(props: SystemProps.AttackExplorerVsExplorerProps) {
    const { aggressor_id, defender_id, steal_resources, signer } = props;

    const calldata = [aggressor_id, defender_id];

    // Add steal_resources array length
    calldata.push(steal_resources.length);

    // Add each resource entry to calldata
    steal_resources.forEach((resource) => {
      calldata.push(resource.resourceId); // resourceId
      calldata.push(resource.amount); // amount
    });

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_battle_systems`),
        entrypoint: "attack_explorer_vs_explorer",
        calldata,
      },
      transactionType: TransactionType.ATTACK_EXPLORER_VS_EXPLORER,
    });
  }

  /**
   * Attack a guard with an explorer
   *
   * @param props - Properties for explorer vs guard attack
   * @param props.explorer_id - ID of the attacking explorer
   * @param props.structure_id - ID of the structure with defending guard
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async attack_explorer_vs_guard(props: SystemProps.AttackExplorerVsGuardProps) {
    const { explorer_id, structure_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_battle_systems`),
        entrypoint: "attack_explorer_vs_guard",
        calldata: [explorer_id, structure_id],
      },
      transactionType: TransactionType.ATTACK_EXPLORER_VS_GUARD,
    });
  }

  /**
   * Attack a guard with an explorer and, in the same atomic multicall, garrison the surviving
   * troops into the captured structure. The attack runs first so the explorer owns the structure
   * by the time the guard swap executes.
   *
   * @param props - Properties for the attack + garrison multicall
   * @param props.explorer_id - ID of the attacking explorer
   * @param props.structure_id - ID of the structure with the defending guard
   * @param props.structure_direction - Direction from the explorer to the structure
   * @param props.to_guard_slot - Guard slot to place the surviving troops in
   * @param props.count - Number of surviving troops to garrison (raw count, divisible by resource precision)
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async attack_explorer_vs_guard_and_garrison(props: SystemProps.AttackExplorerVsGuardAndGarrisonProps) {
    const { explorer_id, structure_id, structure_direction, to_guard_slot, count, signer } = props;

    const calls: Call[] = [
      {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_battle_systems`),
        entrypoint: "attack_explorer_vs_guard",
        calldata: [explorer_id, structure_id],
      },
      {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_management_systems`),
        entrypoint: "explorer_guard_swap",
        calldata: [explorer_id, structure_id, structure_direction, to_guard_slot, count],
      },
    ];

    return await this.promiseQueue.enqueue({
      signer,
      calls,
      transactionType: TransactionType.ATTACK_EXPLORER_VS_GUARD_AND_GARRISON,
    });
  }

  /**
   * Attack an explorer with a guard
   *
   * @param props - Properties for guard vs explorer attack
   * @param props.structure_id - ID of the structure with attacking guard
   * @param props.structure_guard_slot - Guard slot of the attacking troops
   * @param props.explorer_id - ID of the defending explorer
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async attack_guard_vs_explorer(props: SystemProps.AttackGuardVsExplorerProps) {
    const { structure_id, structure_guard_slot, explorer_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_battle_systems`),
        entrypoint: "attack_guard_vs_explorer",
        calldata: [structure_id, structure_guard_slot, explorer_id],
      },
      transactionType: TransactionType.ATTACK_GUARD_VS_EXPLORER,
    });
  }

  /**
   * Raid a structure with an explorer
   *
   * @param props - Properties for explorer raid
   * @param props.explorer_id - ID of the raiding explorer
   * @param props.structure_id - ID of the structure being raided
   * @param props.structure_direction - Direction to the structure
   * @param props.steal_resources - Resources to steal during the raid
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async raid_explorer_vs_guard(props: SystemProps.RaidExplorerVsGuardProps) {
    const { explorer_id, structure_id, structure_direction, steal_resources, signer } = props;

    // Prepare calldata for steal_resources which is a Span<(u8, u128)>
    const resourcesCalldata = steal_resources.flatMap((resource) => [resource.resourceId, resource.amount]);

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-troop_raid_systems`),
        entrypoint: "raid_explorer_vs_guard",
        calldata: [
          explorer_id,
          structure_id,
          structure_direction,
          steal_resources.length, // Size of the span
          ...resourcesCalldata, // Flattened resource tuples
        ],
      },
      transactionType: TransactionType.RAID_EXPLORER_VS_GUARD,
    });
  }

  /**
   * Claim wonder production bonus for a structure
   *
   * @param props - Properties for claiming wonder production bonus
   * @param props.structure_id - ID of the structure claiming the bonus
   * @param props.wonder_structure_id - ID of the wonder structure providing the bonus
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async claim_wonder_production_bonus(props: SystemProps.ClaimWonderProductionBonusProps) {
    const { structure_id, wonder_structure_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-production_systems`),
        entrypoint: "claim_wonder_production_bonus",
        calldata: [structure_id, wonder_structure_id],
      },
      transactionType: TransactionType.CLAIM_WONDER_PRODUCTION_BONUS,
    });
  }

  /**
   * Pledge a structure's faith to a wonder.
   *
   * @param props - Properties for faith pledge
   * @param props.structure_id - ID of the structure pledging faith
   * @param props.wonder_id - ID of the wonder receiving faith
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async pledge_faith(props: SystemProps.PledgeFaithProps) {
    const { structure_id, wonder_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-faith_systems`),
        entrypoint: "pledge_faith",
        calldata: [structure_id, wonder_id],
      },
      transactionType: TransactionType.PLEDGE_FAITH,
    });
  }

  /**
   * Remove a structure's faith from its currently pledged wonder.
   *
   * @param props - Properties for removing faith
   * @param props.structure_id - ID of the structure to remove from faith
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async remove_faith(props: SystemProps.RemoveFaithProps) {
    const { structure_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-faith_systems`),
        entrypoint: "remove_faith",
        calldata: [structure_id],
      },
      transactionType: TransactionType.REMOVE_FAITH,
    });
  }

  /**
   * Synchronize wonder ownership in the faith system.
   *
   * @param props - Properties for wonder ownership synchronization
   * @param props.wonder_id - Wonder ID to synchronize
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async update_wonder_ownership(props: SystemProps.UpdateWonderOwnershipProps) {
    const { wonder_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-faith_systems`),
        entrypoint: "update_wonder_ownership",
        calldata: [wonder_id],
      },
      transactionType: TransactionType.UPDATE_WONDER_OWNERSHIP,
    });
  }

  /**
   * Synchronize structure ownership in the faith system.
   *
   * @param props - Properties for structure ownership synchronization
   * @param props.structure_id - Structure ID to synchronize
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async update_structure_ownership(props: SystemProps.UpdateStructureOwnershipProps) {
    const { structure_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-faith_systems`),
        entrypoint: "update_structure_ownership",
        calldata: [structure_id],
      },
      transactionType: TransactionType.UPDATE_STRUCTURE_OWNERSHIP,
    });
  }

  public async mint_starting_resources(props: SystemProps.MintStartingResources) {
    const { realm_entity_id, config_ids, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      config_ids.map((configId) => ({
        contractAddress: getContractByName(this.manifest, `${this.namespace}-realm_systems`),
        entrypoint: "mint_starting_resources",
        calldata: [configId, realm_entity_id],
      })),
    );
  }

  public async create_guild(props: SystemProps.CreateGuildProps) {
    const { is_public, guild_name, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-guild_systems`),
        entrypoint: "create_guild",
        calldata: [is_public, guild_name],
      },
      transactionType: TransactionType.CREATE_GUILD,
    });
  }

  public async join_guild(props: SystemProps.JoinGuildProps) {
    const { guild_entity_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-guild_systems`),
        entrypoint: "join_guild",
        calldata: [guild_entity_id],
      },
      transactionType: TransactionType.JOIN_GUILD,
    });
  }

  public async update_whitelist(props: SystemProps.UpdateWhitelist) {
    const { address, whitelist, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-guild_systems`),
        entrypoint: "update_whitelist",
        calldata: [address, whitelist],
      },
      transactionType: TransactionType.UPDATE_WHITELIST,
    });
  }

  public async remove_guild_member(props: SystemProps.RemoveGuildMember) {
    const { player_address_to_remove, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-guild_systems`),
        entrypoint: "remove_member",
        calldata: [player_address_to_remove],
      },
      transactionType: TransactionType.REMOVE_GUILD_MEMBER,
    });
  }

  public async disband_guild(props: SystemProps.DisbandGuild) {
    const { calls, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${this.namespace}-guild_systems`),
          entrypoint: "remove_member",
          calldata: [call.address],
        };
      }),
      transactionType: TransactionType.REMOVE_GUILD_MEMBER,
    });
  }

  public async leave_guild(props: SystemProps.LeaveGuildProps) {
    const { signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-guild_systems`),
        entrypoint: "leave_guild",
        calldata: [],
      },
      transactionType: TransactionType.LEAVE_GUILD,
    });
  }

  public async set_starting_resources_config(props: SystemProps.SetStartingResourcesConfigProps) {
    const { realmStartingResources, villageStartingResources, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_starting_resources_config",
      calldata: [
        realmStartingResources.length,
        ...realmStartingResources.flatMap(({ resource, amount }) => [resource, amount]),
        villageStartingResources.length,
        ...villageStartingResources.flatMap(({ resource, amount }) => [resource, amount]),
      ],
    });
  }

  public async set_map_config(props: SystemProps.SetMapConfigProps) {
    const {
      reward_amount,
      shards_mines_win_probability,
      shards_mines_fail_probability,
      agent_find_probability,
      agent_find_fail_probability,
      camp_find_probability,
      camp_find_fail_probability,
      holysite_find_probability,
      holysite_find_fail_probability,
      bitcoin_mine_win_probability,
      bitcoin_mine_fail_probability,
      hyps_win_prob,
      hyps_fail_prob,
      hyps_fail_prob_increase_p_hex,
      hyps_fail_prob_increase_p_fnd,
      relic_discovery_interval_sec,
      relic_hex_dist_from_center,
      relic_chest_relics_per_chest,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_map_config",
      calldata: [
        reward_amount,
        shards_mines_win_probability,
        shards_mines_fail_probability,
        agent_find_probability,
        agent_find_fail_probability,
        camp_find_probability,
        camp_find_fail_probability,
        holysite_find_probability,
        holysite_find_fail_probability,
        bitcoin_mine_win_probability,
        bitcoin_mine_fail_probability,
        hyps_win_prob,
        hyps_fail_prob,
        hyps_fail_prob_increase_p_hex,
        hyps_fail_prob_increase_p_fnd,
        relic_discovery_interval_sec,
        relic_hex_dist_from_center,
        relic_chest_relics_per_chest,
      ],
    });
  }

  public async set_camp_starting_resources_config(props: SystemProps.SetCampStartingResourcesConfigProps) {
    const { resources, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_village_found_resources_config",
      calldata: [
        resources.length,
        ...resources.flatMap(({ resource, min_amount, max_amount }) => [resource, min_amount, max_amount]),
      ],
    });
  }

  public async set_blitz_exploration_config(props: SystemProps.SetBlitzExplorationConfigProps) {
    const { reward_profile_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_blitz_exploration_config",
      calldata: [reward_profile_id],
    });
  }

  public async set_victory_points_config(props: SystemProps.SetVictoryPointsConfigProps) {
    const {
      points_for_win,
      hyperstructure_points_per_second,
      points_for_hyperstructure_claim_against_bandits,
      points_for_non_hyperstructure_claim_against_bandits,
      points_for_tile_exploration,
      points_for_relic_open,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, [
      {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
        entrypoint: "set_victory_points_grant_config",
        calldata: [
          hyperstructure_points_per_second,
          points_for_hyperstructure_claim_against_bandits,
          points_for_non_hyperstructure_claim_against_bandits,
          points_for_tile_exploration,
          points_for_relic_open,
        ],
      },
      {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
        entrypoint: "set_victory_points_win_config",
        calldata: [points_for_win],
      },
    ]);
  }

  public async set_game_mode_config(props: SystemProps.SetBlitzModeConfigProps) {
    const { blitz_mode_on, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_game_mode_config",
      calldata: [blitz_mode_on],
    });
  }

  public async set_factory_address(props: SystemProps.SetFactoryAddressProps) {
    const { factory_address, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_factory_address",
      calldata: [factory_address],
    });
  }

  public async set_travel_food_cost_config(props: SystemProps.SetTravelFoodCostConfigProps) {
    const {
      config_id,
      unit_type,
      explore_wheat_burn_amount,
      explore_fish_burn_amount,
      travel_wheat_burn_amount,
      travel_fish_burn_amount,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_travel_food_cost_config",
      calldata: [
        config_id,
        unit_type,
        explore_wheat_burn_amount,
        explore_fish_burn_amount,
        travel_wheat_burn_amount,
        travel_fish_burn_amount,
      ],
    });
  }
  public async set_season_config(props: SystemProps.SetSeasonConfigProps) {
    const {
      dev_mode_on,
      start_settling_at,
      start_main_at,
      end_at,
      bridge_close_end_grace_seconds,
      point_registration_grace_seconds,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_season_config",
      calldata: [
        dev_mode_on,
        start_settling_at,
        start_main_at,
        end_at,
        bridge_close_end_grace_seconds,
        point_registration_grace_seconds,
      ],
    });
  }

  public async set_vrf_config(props: SystemProps.SetVRFConfigProps) {
    const { vrf_provider_address, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_vrf_config",
      calldata: [vrf_provider_address],
    });
  }

  public async set_resource_bridge_fees_config(props: SystemProps.SetResourceBridgeFeesConfigProps) {
    const {
      velords_fee_on_dpt_percent,
      velords_fee_on_wtdr_percent,
      season_pool_fee_on_dpt_percent,
      season_pool_fee_on_wtdr_percent,
      client_fee_on_dpt_percent,
      client_fee_on_wtdr_percent,
      realm_fee_dpt_percent,
      realm_fee_wtdr_percent,
      velords_fee_recipient,
      season_pool_fee_recipient,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_resource_bridge_fee_split_config",
      calldata: [
        velords_fee_on_dpt_percent,
        velords_fee_on_wtdr_percent,
        season_pool_fee_on_dpt_percent,
        season_pool_fee_on_wtdr_percent,
        client_fee_on_dpt_percent,
        client_fee_on_wtdr_percent,
        realm_fee_dpt_percent,
        realm_fee_wtdr_percent,
        velords_fee_recipient,
        season_pool_fee_recipient,
      ],
    });
  }

  public async set_agent_config(props: SystemProps.SetAgentConfigProps) {
    const {
      agent_controller,
      max_lifetime_count,
      max_current_count,
      min_spawn_lords_amount,
      max_spawn_lords_amount,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_agent_config",
      calldata: [
        agent_controller,
        max_lifetime_count,
        max_current_count,
        min_spawn_lords_amount,
        max_spawn_lords_amount,
      ],
    });
  }

  public async set_capacity_config(props: SystemProps.SetCapacityConfigProps) {
    const {
      troop_capacity,
      donkey_capacity,
      storehouse_boost_capacity,
      realm_capacity,
      village_capacity,
      hyperstructure_capacity,
      fragment_mine_capacity,
      bank_structure_capacity,
      holysite_capacity,
      camp_capacity,
      bitcoin_mine_capacity,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_capacity_config",
      calldata: [
        0,
        troop_capacity,
        donkey_capacity,
        storehouse_boost_capacity,

        realm_capacity,
        village_capacity,
        hyperstructure_capacity,
        fragment_mine_capacity,
        bank_structure_capacity,
        holysite_capacity,
        camp_capacity,
        bitcoin_mine_capacity,
      ],
    });
  }

  public async set_donkey_speed_config(props: SystemProps.SetDonkeySpeedConfigProps) {
    const { sec_per_km, sec_per_km_troops, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_donkey_speed_config",
      calldata: [sec_per_km, sec_per_km_troops],
    });
  }

  public async set_resource_weight_config(props: SystemProps.SetWeightConfigProps) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
          entrypoint: "set_resource_weight_config",
          calldata: [call.entity_type, call.weight_nanogram],
        };
      }),
    );
  }

  public async set_trade_config(props: SystemProps.SetTradeConfigProps) {
    const { max_count, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_trade_config",
      calldata: [max_count],
    });
  }

  public async set_tick_config(props: SystemProps.SetTickConfigProps) {
    const { tick_interval_in_seconds, delivery_tick_interval_in_seconds, bitcoin_phase_in_seconds, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_tick_config",
      calldata: [tick_interval_in_seconds, delivery_tick_interval_in_seconds, bitcoin_phase_in_seconds],
    });
  }

  public async set_resource_factory_config(props: SystemProps.SetResourceFactoryConfigProps) {
    const { signer, calls } = props;
    const resourceFactoryCalldataArray = calls.map((call) => {
      return {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
        entrypoint: "set_resource_factory_config",
        calldata: [
          call.resource_type,
          call.realm_output_per_second,
          call.village_output_per_second,
          call.labor_output_per_resource,
          call.resource_output_per_simple_input,
          call.simple_input_resources_list.length,
          ...call.simple_input_resources_list.flatMap(({ resource, amount }) => [resource, amount]),
          call.resource_output_per_complex_input,
          call.complex_input_resources_list.length,
          ...call.complex_input_resources_list.flatMap(({ resource, amount }) => [resource, amount]),
        ],
      };
    });

    return await this.executeAndCheckTransaction(signer, resourceFactoryCalldataArray);
  }

  public async set_bank_config(props: SystemProps.SetBankConfigProps) {
    const { lp_fee_num, lp_fee_denom, owner_fee_num, owner_fee_denom, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_bank_config",
      calldata: [lp_fee_num, lp_fee_denom, owner_fee_num, owner_fee_denom],
    });
  }

  public async set_resource_bridge_whitlelist_config(props: SystemProps.SetResourceBridgeWtlConfigProps) {
    const { resource_whitelist_configs, signer } = props;

    const calldata = resource_whitelist_configs.map(({ token, resource_type }) => ({
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_resource_bridge_whitelist_config",
      calldata: [token, resource_type],
    }));

    return await this.executeAndCheckTransaction(signer, calldata);
  }

  public async set_troop_config(props: SystemProps.SetTroopConfigProps) {
    const { signer, stamina_config, limit_config, damage_config } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_troop_config",
      calldata: [
        // damage config
        damage_config.damage_raid_percent_num,
        damage_config.damage_biome_bonus_num,
        damage_config.damage_beta_small,
        damage_config.damage_beta_large,
        damage_config.damage_scaling_factor,
        damage_config.damage_c0,
        damage_config.damage_delta,
        damage_config.t1_damage_value,
        damage_config.t2_damage_multiplier,
        damage_config.t3_damage_multiplier,

        // stamina config
        stamina_config.stamina_gain_per_tick,
        stamina_config.stamina_initial,
        stamina_config.stamina_bonus_value,
        stamina_config.stamina_knight_max,
        stamina_config.stamina_paladin_max,
        stamina_config.stamina_crossbowman_max,
        stamina_config.stamina_attack_req,
        stamina_config.stamina_defense_req,
        stamina_config.stamina_explore_stamina_cost,
        stamina_config.stamina_travel_stamina_cost,
        stamina_config.stamina_explore_wheat_cost,
        stamina_config.stamina_explore_fish_cost,
        stamina_config.stamina_travel_wheat_cost,
        stamina_config.stamina_travel_fish_cost,

        // limit config
        limit_config.guard_resurrection_delay,
        limit_config.mercenaries_troop_lower_bound,
        limit_config.mercenaries_troop_upper_bound,
        limit_config.agent_troop_lower_bound,
        limit_config.agent_troop_upper_bound,
        limit_config.settlement_deployment_cap,
        limit_config.city_deployment_cap,
        limit_config.kingdom_deployment_cap,
        limit_config.empire_deployment_cap,
        limit_config.t1_tier_strength,
        limit_config.t2_tier_strength,
        limit_config.t3_tier_strength,
        limit_config.t1_tier_modifier,
        limit_config.t2_tier_modifier,
        limit_config.t3_tier_modifier,
      ],
    });
  }

  public async set_battle_config(props: SystemProps.SetBattleConfigProps) {
    const { signer, regular_immunity_ticks, village_immunity_ticks, village_raid_immunity_ticks } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_battle_config",
      calldata: [regular_immunity_ticks, village_immunity_ticks, village_raid_immunity_ticks],
    });
  }

  public async set_structure_level_config(props: SystemProps.setRealmUpgradeConfigProps) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
          entrypoint: "set_structure_level_config",
          calldata: [
            call.level,
            call.cost_of_level.length,
            ...call.cost_of_level.flatMap(({ resource, amount }) => [resource, amount]),
          ],
        };
      }),
    );
  }

  public async set_world_config(props: SystemProps.SetWorldConfigProps) {
    const { admin_address, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_world_config",
      calldata: [admin_address],
    });
  }

  public async set_biome_climate_config(props: SystemProps.SetBiomeClimateConfigProps) {
    const { biome_climate_config, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_biome_climate_config",
      calldata: [
        biome_climate_config.elevation_scale_bps,
        biome_climate_config.moisture_scale_bps,
        biome_climate_config.elevation_bias_bps,
        biome_climate_config.moisture_bias_bps,
        biome_climate_config.elevation_seed,
        biome_climate_config.moisture_seed,
      ],
    });
  }

  public async set_mercenaries_name_config(props: SystemProps.SetMercenariesNameConfigProps) {
    const { name, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_mercenaries_name_config",
      calldata: [name],
    });
  }

  public async set_structure_max_level_config(props: SystemProps.SetStructureMaxLevelConfigProps) {
    const { realm_max_level, village_max_level, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_structure_max_level_config",
      calldata: [realm_max_level, village_max_level],
    });
  }

  public async set_building_config(props: SystemProps.SetBuildingConfigProps) {
    const { base_population, base_cost_percent_increase, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_building_config",
      calldata: [base_population, base_cost_percent_increase],
    });
  }

  public async set_building_category_config(props: SystemProps.SetBuildingCategoryConfigProps) {
    const { signer, calls } = props;
    const calldataArray = calls.map((call) => {
      return {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
        entrypoint: "set_building_category_config",
        calldata: [
          call.building_category,
          call.complex_building_cost.length,
          ...call.complex_building_cost.flatMap(({ resource, amount }) => [resource, amount]),
          call.simple_building_cost.length,
          ...call.simple_building_cost.flatMap(({ resource, amount }) => [resource, amount]),
          call.population_cost,
          call.capacity_grant,
        ],
      };
    });

    return await this.executeAndCheckTransaction(signer, calldataArray);
  }

  public async set_hyperstructure_config(props: SystemProps.SetHyperstructureConfig) {
    const { initialize_shards_amount, construction_resources, signer } = props;

    const calldata = [initialize_shards_amount, construction_resources.length, ...construction_resources];

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_hyperstructure_config",
      calldata,
    });
  }

  public async initialize(props: SystemProps.InitializeHyperstructureProps) {
    const { hyperstructure_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-hyperstructure_systems`),
        entrypoint: "initialize",
        calldata: [hyperstructure_id],
      },
      transactionType: TransactionType.INITIALIZE,
    });
  }

  public async contribute_to_construction(props: SystemProps.ContributeToConstructionProps) {
    const { hyperstructure_entity_id, contributor_entity_id, contributions, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-hyperstructure_systems`),
        entrypoint: "contribute",
        calldata: [hyperstructure_entity_id, contributor_entity_id, contributions],
      },
      transactionType: TransactionType.CONTRIBUTE,
    });
  }

  public async set_access(props: SystemProps.SetAccessProps) {
    const { hyperstructure_entity_id, access, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-hyperstructure_systems`),
        entrypoint: "update_construction_access",
        calldata: [hyperstructure_entity_id, access],
      },
      transactionType: TransactionType.SET_ACCESS,
    });
  }

  public async end_game(props: SystemProps.EndGameProps) {
    const { signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-season_systems`),
        entrypoint: "season_close",
        calldata: [],
      },
      transactionType: TransactionType.END_GAME,
    });
  }

  public async allocate_shares(props: SystemProps.SetCoOwnersProps) {
    const { hyperstructure_entity_id, co_owners, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-hyperstructure_systems`),
        entrypoint: "allocate_shares",
        calldata: [hyperstructure_entity_id, co_owners.length, ...co_owners.flat()],
      },
      transactionType: TransactionType.ALLOCATE_SHARES,
    });
  }

  public async season_prize_claim(props: SystemProps.ClaimLeaderboardRewardsProps) {
    const { signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-season_systems`),
      entrypoint: "season_prize_claim",
      calldata: [],
    });
  }

  // Prize distribution (Blitz)
  public async blitz_prize_player_rank(props: SystemProps.BlitzPrizePlayerRankProps) {
    const { trial_id, total_player_count_committed, players_list, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-prize_distribution_systems`),
        entrypoint: "blitz_prize_player_rank",
        calldata: [trial_id, total_player_count_committed, players_list.length, ...players_list],
      },
      transactionType: TransactionType.BLITZ_PRIZE_PLAYER_RANK,
    });
  }

  public async claim_construction_points(props: SystemProps.ClaimConstructionPointsProps) {
    const { hyperstructure_ids, player, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-hyperstructure_systems`),
        entrypoint: "claim_construction_points",
        calldata: [hyperstructure_ids.length, ...hyperstructure_ids, player],
      },
      transactionType: TransactionType.CLAIM_CONSTRUCTION_POINTS,
    });
  }

  public async claim_share_points(props: SystemProps.ClaimSharePointsProps) {
    const { hyperstructure_ids, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-hyperstructure_systems`),
        entrypoint: "claim_share_points",
        calldata: [hyperstructure_ids.length, ...hyperstructure_ids],
      },
      transactionType: TransactionType.CLAIM_SHARE_POINTS,
    });
  }

  public async set_stamina_config(props: SystemProps.SetStaminaConfigProps) {
    const { unit_type, max_stamina, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_stamina_config",
      calldata: [unit_type, max_stamina],
    });
  }

  public async set_stamina_refill_config(props: SystemProps.SetStaminaRefillConfigProps) {
    const { amount_per_tick, start_boost_tick_count, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_stamina_refill_config",
      calldata: [amount_per_tick, start_boost_tick_count],
    });
  }

  public async set_settlement_config(props: SystemProps.SetSettlementConfigProps) {
    const {
      center,
      base_distance,
      layers_skipped,
      layer_max,
      layer_capacity_increment,
      layer_capacity_bps,
      spires_layer_distance,
      spires_max_count,
      spires_settled_count,
      single_realm_mode,
      two_player_mode,
      signer,
    } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_settlement_config",
      calldata: [
        center,
        base_distance,
        layers_skipped,
        layer_max,
        layer_capacity_increment,
        layer_capacity_bps,
        spires_layer_distance,
        spires_max_count,
        spires_settled_count,
        single_realm_mode,
        two_player_mode,
      ],
    });
  }

  public async set_blitz_registration_config(props: SystemProps.SetBlitzRegistrationConfigProps) {
    const {
      registration_count_max,
      registration_start_at,
      collectibles_cosmetics_max,
      collectibles_cosmetics_address,
      collectibles_timelock_address,
      collectibles_lootchest_address,
      collectibles_elitenft_address,
      signer,
    } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_blitz_registration_config",
      calldata: [
        registration_count_max,
        registration_start_at,
        collectibles_cosmetics_max,
        collectibles_cosmetics_address,
        collectibles_timelock_address,
        collectibles_lootchest_address,
        collectibles_elitenft_address,
      ],
    });
  }

  public async set_quest_config(props: SystemProps.SetQuestConfigProps) {
    const { quest_find_probability, quest_find_fail_probability, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_quest_config",
      calldata: [quest_find_probability, quest_find_fail_probability],
    });
  }

  public async set_faith_config(props: SystemProps.SetFaithConfigProps) {
    const {
      enabled,
      wonder_base_fp_per_sec,
      holy_site_fp_per_sec,
      realm_fp_per_sec,
      village_fp_per_sec,
      owner_share_percent,
      reward_token,
      signer,
    } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_faith_config",
      calldata: [
        enabled ? 1 : 0,
        wonder_base_fp_per_sec,
        holy_site_fp_per_sec,
        realm_fp_per_sec,
        village_fp_per_sec,
        owner_share_percent,
        reward_token,
      ],
    });
  }

  public async set_artificer_config(props: SystemProps.SetArtificerConfigProps) {
    const { research_cost_for_relic, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-config_systems`),
      entrypoint: "set_artificer_config",
      calldata: [research_cost_for_relic],
    });
  }

  public async mint_test_realm(props: SystemProps.MintTestRealmProps) {
    const {
      token_id,
      signer,
      realms_address, // Should this be dynamically fetched from season config or passed to provider instead of prop?
    } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: realms_address.toString(),
        entrypoint: "mint",
        calldata: [uint256.bnToUint256(token_id)],
      },
      transactionType: TransactionType.MINT,
    });
  }

  public async mint_season_passes(props: SystemProps.MintSeasonPassesProps) {
    const {
      recipient,
      token_ids,
      signer,
      season_pass_address, // Should this be dynamically fetched from season config instead of prop?
    } = props;
    const multicall = token_ids.map((token) => {
      return {
        contractAddress: season_pass_address.toString(),
        entrypoint: "mint",
        calldata: [recipient, uint256.bnToUint256(token)],
      };
    });
    return await this.executeAndCheckTransaction(signer, multicall);
  }

  public async mint_test_lords(props: SystemProps.MintTestLordsProps) {
    const { signer, lords_address } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: lords_address.toString(),
      entrypoint: "mint_test_lords",
      calldata: [],
    });
  }

  public async attach_lords(props: SystemProps.AttachLordsProps) {
    const { amount, signer, token_id, season_pass_address, lords_address } = props;

    // approve lords contract to spend season pass

    const approveTx = {
      contractAddress: lords_address.toString(),
      entrypoint: "approve",
      calldata: [season_pass_address.toString(), uint256.bnToUint256(amount)],
    };

    return await this.executeAndCheckTransaction(signer, [
      approveTx,
      {
        contractAddress: season_pass_address.toString(),
        entrypoint: "attach_lords",
        calldata: [uint256.bnToUint256(token_id), uint256.bnToUint256(amount)],
      },
    ]);
  }

  public async detach_lords(props: SystemProps.DetachLordsProps) {
    const { amount, signer, token_id, season_pass_address } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: season_pass_address.toString(),
      entrypoint: "detach_lords",
      calldata: [uint256.bnToUint256(token_id), uint256.bnToUint256(amount)],
    });
  }

  /**
   * Burn other resources to produce labor
   *
   * @param props - Properties for burning resources for labor
   * @param props.entity_id - ID of the realm entity
   * @param props.resource_types - Array of resource types to burn
   * @param props.resource_amounts - Array of resource amounts to burn
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Burn 100 wood and 50 stone to produce labor
   * {
   *   entity_id: 123,
   *   resource_types: [1, 2], // wood and stone
   *   resource_amounts: [100, 50],
   *   signer: account
   * }
   * ```
   */
  public async burn_resource_for_labor_production(props: SystemProps.BurnOtherResourcesForLaborProductionProps) {
    const { entity_id, resource_types, resource_amounts, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-production_systems`),
        entrypoint: "burn_resource_for_labor_production",
        calldata: [entity_id, resource_types.length, ...resource_types, resource_amounts.length, ...resource_amounts],
      },
      transactionType: TransactionType.BURN_RESOURCE_FOR_LABOR_PRODUCTION,
    });
  }

  /**
   * Burn labor resources to produce other resources
   *
   * @param props - Properties for burning labor for resources
   * @param props.from_entity_id - ID of the realm entity
   * @param props.production_cycles - Array of cycles to burn
   * @param props.produced_resource_types - Array of resource types to produce
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Burn 100 cycles worth of labor cost to produce wood
   * // and another 100 cycles worth of labor cost to produce stone
   * //
   *
   * {
   *   from_entity_id: 123,
   *   priduction_cycles: [100, 100],
   *   produced_resource_types: [1, 2], // wood and stone
   *   signer: account
   * }
   * ```
   */
  public async burn_labor_for_resource_production(props: SystemProps.BurnLaborResourcesForOtherProductionProps) {
    const { from_entity_id, production_cycles, produced_resource_types, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-production_systems`),
        entrypoint: "burn_labor_for_resource_production",
        calldata: [
          from_entity_id,
          production_cycles.length,
          ...production_cycles,
          produced_resource_types.length,
          ...produced_resource_types,
        ],
      },
      transactionType: TransactionType.BURN_LABOR_FOR_RESOURCE_PRODUCTION,
    });
  }

  /**
   * Burn predefined resources to produce other resources
   *
   * @param props - Properties for burning predefined resources
   * @param props.from_entity_id - ID of the realm entity
   * @param props.produced_resource_types - Array of resource types to produce
   * @param props.production_cycles - Array of production cycles
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Burn predefined resources to produce gold for 2 output/input cycles
   * {
   *   from_entity_id: 123,
   *   produced_resource_types: [5], // gold
   *   production_cycles: [2],
   *   signer: account
   * }
   * ```
   */
  public async burn_resource_for_resource_production(props: SystemProps.BurnOtherPredefinedResourcesForResourcesProps) {
    const { from_entity_id, produced_resource_types, production_cycles, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-production_systems`),
        entrypoint: "burn_resource_for_resource_production",
        calldata: [
          from_entity_id,
          produced_resource_types.length,
          ...produced_resource_types,
          production_cycles.length,
          ...production_cycles,
        ],
      },
      transactionType: TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION,
    });
  }

  // Loot Chest functions

  public async open_loot_chest(props: SystemProps.OpenLootChestProps) {
    const { signer, token_id, loot_chest_address, claim_address } = props;

    let callData: Call[] = [];

    if (this.VRF_PROVIDER_ADDRESS !== undefined && Number(this.VRF_PROVIDER_ADDRESS) !== 0) {
      const requestRandomCall: Call = {
        contractAddress: this.VRF_PROVIDER_ADDRESS!,
        entrypoint: "request_random",
        calldata: [claim_address, 0, signer.address],
      };

      callData = [requestRandomCall];
    }

    // create multicall
    // first approve
    callData.push({
      contractAddress: loot_chest_address,
      entrypoint: "approve",
      calldata: [claim_address, token_id.toString(), 0],
    });

    // then claim
    callData.push({
      contractAddress: claim_address,
      entrypoint: "claim",
      calldata: [token_id.toString(), 0],
    });

    return await signer.execute(callData);
  }

  // Marketplace functions

  /**
   * Create a new marketplace order
   *
   * @param props - Properties for creating the order
   * @param props.token_id - ID of the token to sell
   * @param props.collection_id - ID of the collection the token belongs to
   * @param props.price - Price of the token in LORDS (u128)
   * @param props.expiration - Expiration timestamp (u32)
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async create_marketplace_orders(
    props: SystemProps.CreateMarketplaceOrdersProps,
  ): Promise<GetTransactionReceiptResponse> {
    const { tokens, signer, marketplace_address } = props;

    const calls = tokens.map((token) => {
      return {
        contractAddress: marketplace_address.toString(),
        entrypoint: "create",
        calldata: [token.token_id, token.collection_id, token.price.toString(), token.expiration],
      };
    });

    // Extract cancel order IDs and create cancel entrypoint calls
    const cancelCalls = tokens
      .filter((token) => token.cancel_order_id !== null && token.cancel_order_id !== undefined)
      .map((token) => ({
        contractAddress: marketplace_address.toString(),
        entrypoint: "cancel",
        calldata: [token.cancel_order_id!.toString()],
      }));

    // Combine cancel calls with create calls
    const allCalls = [...cancelCalls, ...calls];
    const result = await this.executeAndCheckTransaction(signer, allCalls);
    if (!result) {
      throw new Error("Transaction failed - no result returned");
    }
    return result;
  }

  /**
   * Accept an existing marketplace order
   *
   * @param props - Properties for accepting the order
   * @param props.order_ids - IDs of the orders to accept (u64)
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async accept_marketplace_orders(props: SystemProps.AcceptMarketplaceOrdersProps, approval: Call) {
    const { order_ids, signer } = props;

    const calls = order_ids.map((order_id) => {
      return {
        contractAddress: props.marketplace_address.toString(),
        entrypoint: "accept",
        calldata: [order_id.toString()],
      };
    });

    return await this.executeAndCheckTransaction(signer, [approval, ...calls]);
  }

  /**
   * Cancel an existing marketplace order
   *
   * @param props - Properties for canceling the order
   * @param props.order_id - ID of the order to cancel (u64)
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async cancel_marketplace_order(props: SystemProps.CancelMarketplaceOrderProps) {
    const { order_id, signer } = props;

    return await this.promiseQueue.enqueue({
      signer,
      calls: {
        contractAddress: props.marketplace_address.toString(),
        entrypoint: "cancel",
        calldata: [order_id],
      },
      transactionType: TransactionType.CANCEL_MARKETPLACE_ORDER,
    });
  }

  /**
   * Edit the price of an existing marketplace order
   *
   * @param props - Properties for editing the order
   * @param props.order_id - ID of the order to edit (u64)
   * @param props.new_price - New price for the order in LORDS (u128)
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async edit_marketplace_order(
    props: SystemProps.EditMarketplaceOrderProps,
  ): Promise<GetTransactionReceiptResponse> {
    const { order_id, new_price, signer } = props;

    const call = {
      contractAddress: props.marketplace_address.toString(),
      entrypoint: "edit",
      calldata: [order_id, new_price],
    };

    const result = await this.executeAndCheckTransaction(signer, [call]);
    if (!result) {
      throw new Error("Transaction failed - no result returned");
    }
    return result;
  }

  public async set_quest_games(props: SystemProps.SetQuestGamesProps): Promise<any> {
    const { signer, quest_games } = props;
    for (const quest_game of quest_games) {
      return await this.executeAndCheckTransaction(signer, {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-quest_systems`),
        entrypoint: "add_game",
        calldata: quest_game,
      });
    }
  }

  public async start_quest(props: SystemProps.StartQuestProps) {
    const { quest_tile_id, explorer_id, player_name, to_address, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-quest_systems`),
      entrypoint: "start_quest",
      calldata: [quest_tile_id, explorer_id, player_name, to_address],
    });
  }

  public async claim_reward(props: SystemProps.ClaimRewardProps) {
    const { game_token_id, game_address, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-quest_systems`),
      entrypoint: "claim_reward",
      calldata: [game_token_id, game_address],
    });
  }

  public async get_game_count(props: SystemProps.GetGameCountProps) {
    const { game_address } = props;
    return await this.provider.callContract({
      contractAddress: game_address,
      entrypoint: "game_count",
      calldata: [],
    });
  }

  public async disable_quests(props: SystemProps.DisableQuestsProps) {
    const { signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-quest_systems`),
      entrypoint: "disable_quests",
      calldata: [],
    });
  }

  public async enable_quests(props: SystemProps.EnableQuestsProps) {
    const { signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-quest_systems`),
      entrypoint: "enable_quests",
      calldata: [],
    });
  }

  public async transfer_structure_ownership(props: SystemProps.TransferStructureOwnershipProps) {
    const { signer, structure_id, new_owner } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-ownership_systems`),
      entrypoint: "transfer_structure_ownership",
      calldata: [structure_id, new_owner],
    });
  }

  public async transfer_agent_ownership(props: SystemProps.TransferAgentOwnershipProps) {
    const { signer, explorer_id, new_owner } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-ownership_systems`),
      entrypoint: "transfer_agent_ownership",
      calldata: [explorer_id, new_owner],
    });
  }

  public async structure_burn(props: SystemProps.StructureBurnProps) {
    const { signer, structure_id, resources } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-resource_systems`),
      entrypoint: "structure_burn",
      calldata: [
        structure_id,
        resources.length,
        ...resources.flatMap(({ resourceId, amount }) => [resourceId, amount]),
      ],
    });
  }

  public async troop_burn(props: SystemProps.TroopBurnProps) {
    const { signer, explorer_id, resources } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-resource_systems`),
      entrypoint: "troop_burn",
      calldata: [explorer_id, resources.length, ...resources.flatMap(({ resourceId, amount }) => [resourceId, amount])],
    });
  }

  public async open_chest(props: SystemProps.OpenChestProps) {
    const { signer, explorer_id, chest_coord } = props;
    const coordAlt = chest_coord.alt ?? false;
    const calls = [];
    if (this.VRF_PROVIDER_ADDRESS !== undefined && Number(this.VRF_PROVIDER_ADDRESS) !== 0) {
      const requestRandomCall: Call = {
        contractAddress: this.VRF_PROVIDER_ADDRESS!,
        entrypoint: "request_random",
        calldata: [getContractByName(this.manifest, `${this.namespace}-relic_systems`), 0, signer.address],
      };

      calls.push(requestRandomCall);
    }

    calls.push({
      contractAddress: getContractByName(this.manifest, `${this.namespace}-relic_systems`),
      entrypoint: "open_chest",
      calldata: [explorer_id, coordAlt, chest_coord.x, chest_coord.y],
    });
    return await this.promiseQueue.enqueue({ signer, calls: calls, transactionType: TransactionType.OPEN_CHEST });
  }

  public async burn_research_for_relic(props: SystemProps.BurnResearchForRelicProps) {
    const { signer, structure_id } = props;
    return await this.executeAndCheckTransaction(
      signer,
      {
        contractAddress: getContractByName(this.manifest, `${this.namespace}-artificer_systems`),
        entrypoint: "burn_research_for_relic",
        calldata: [structure_id],
      },
      undefined,
      { transactionType: TransactionType.BURN_RESEARCH_FOR_RELIC },
    );
  }

  public async apply_relic(props: SystemProps.ApplyRelicProps) {
    const { signer, entity_id, relic_resource_id, recipient_type } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${this.namespace}-relic_systems`),
      entrypoint: "apply_relic",
      calldata: [entity_id, relic_resource_id, recipient_type],
    });
  }
}
