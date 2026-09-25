import { requireNativeExecutionOutcome } from "./native-batch";
import type { NativeTicketIdentity } from "@bibliothecadao/types";
export { completeNativeBatches, nativeExecutionOutcomes, requireNativeExecutionOutcome } from "./native-batch";
export type { BatchTransactionReceipt, NativeExecutionOutcome } from "@bibliothecadao/types";
import { requireBatchReceipt } from "./native-batch";
export {
  ActionOutcomeUnknownError,
  createNativeTicketSubmission,
  signGameplayIntent,
  StaleActionNonceError,
  StaleGameReleaseError,
} from "./native-ticket";
import { ActionOutcomeUnknownError } from "./native-ticket";
export type { SignedNativeIntent } from "./native-ticket";
export { encodeNativeCommand, frameNativeIntent } from "./native-command";
export type { NativeCommand, NativeCommandPayloads } from "./native-command";
/**
 * Provider class for interacting with the Eternum game contracts
 *
 * @param contracts - The shard's command entrypoint and bridge addresses
 * @param url - Optional RPC URL for the provider
 */
import { encodeNativeCommand, type NativeCommand, type NativeCommandPayloads } from "./native-command";
import type { Abi } from "starknet";
import * as SystemProps from "@bibliothecadao/types";
import EventEmitter from "eventemitter3";
import {
  Account,
  AccountInterface,
  AllowArray,
  BigNumberish,
  Call,
  CallData,
  GetTransactionReceiptResponse,
  RpcProvider,
  uint256,
  shortString,
} from "starknet";
import { extractErrorMessage } from "./classify-transaction-error";
import { PromiseQueue } from "./promise-queue";
import { ExecutionOptions } from "./transaction-executor";
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
export type NativeSubmission = (
  signer: AccountInterface,
  calls: AllowArray<Call>,
) => Promise<{ transaction_hash: string; ticket: NativeTicketIdentity }>;
type SubmittedTransaction = { transaction_hash: string; ticket?: NativeTicketIdentity };

export {
  CATEGORY_BATCH_LIMITS,
  getTransactionCategory,
  TransactionCostCategory,
  getDelayForTransaction,
} from "./batch-config";
export type { BatchDelayConfig } from "./batch-config";
export { classifyTransactionError, extractErrorMessage, formatErrorForConsole } from "./classify-transaction-error";
export type { ClassifiedTransactionError } from "./classify-transaction-error";
export { PromiseQueue } from "./promise-queue";
export type { QueueableTransaction } from "./promise-queue";
export type { TransactionExecutor, ExecutionOptions } from "./transaction-executor";
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
  if (error instanceof ActionOutcomeUnknownError) {
    return {
      failureKind: "action_outcome_unknown",
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

type ActorExecutionLock = {
  completed: Promise<void>;
  resolve: () => void;
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

/** The shard contracts a provider submits to. */
export interface ProviderContracts {
  world: string;
  bridge?: string;
}

export class EternumProvider extends EventEmitter {
  readonly contracts: ProviderContracts;
  readonly provider: RpcProvider;
  promiseQueue: PromiseQueue;
  private pendingActorExecutionLocks = new Map<string, ActorExecutionLock>();
  private nativeSubmission?: NativeSubmission;
  private commandAbi?: Abi;
  private resolveOwnedStructure?: (actor: string) => number;
  private transactionSubmitGuard?: TransactionSubmitGuard;
  private transactionStreamWaiter?: TransactionStreamWaiter;
  private transactionStreamSubmitObserver?: (transactionHash: string) => void;
  /** Active game within the persistent world. */
  private readonly gameId: number;

  /**
   * Create a new EternumProvider instance
   *
   * @param contracts - The shard's command entrypoint and bridge addresses
   * @param url - Optional RPC URL
   * @param scope - Game scope
   */
  constructor(
    contracts: ProviderContracts,
    url?: string,
    scope?: {
      gameId?: number;
      transactionStreamWaiter?: TransactionStreamWaiter;
    },
  ) {
    super();
    this.contracts = contracts;
    this.provider = new RpcProvider({ nodeUrl: url });
    this.gameId = scope?.gameId ?? 0;
    this.transactionStreamWaiter = scope?.transactionStreamWaiter;

    // No timed batching: appchain txs land in <1s, so waiting to merge actions only adds
    // latency (and a merged multicall makes one revert fail unrelated actions). The queue
    // stays for per-signer serialization; a backlog still coalesces naturally.
    this.promiseQueue = new PromiseQueue(
      { executeAndCheckTransaction: (...args) => this.executeAndCheckTransaction(...args) },
      { batchDelayMs: 0, batchCalls: false },
    );
  }

  public setNativeSubmission(submit: NativeSubmission, abi: Abi, ownedStructure: (actor: string) => number): void {
    this.nativeSubmission = submit;
    this.commandAbi = abi;
    this.resolveOwnedStructure = ownedStructure;
  }

  public submitCommand(
    signer: AccountInterface,
    command: NativeCommand,
    transactionType?: TransactionType,
  ): Promise<GetTransactionReceiptResponse> {
    if (!this.commandAbi) throw new Error("Native command ABI is not configured");
    return this.promiseQueue.enqueue({
      signer,
      transactionType,
      calls: {
        contractAddress: this.contracts.world,
        entrypoint: command.kind,
        calldata: [String(this.gameId), ...encodeNativeCommand(this.commandAbi, command)],
      },
    });
  }
  private ownedStructure(actor: string): number {
    if (!this.resolveOwnedStructure) throw new Error("Native player facts are not configured");
    return this.resolveOwnedStructure(actor);
  }
  private bridgeAddress(): string {
    if (!this.contracts.bridge) throw new Error("Native bridge is not configured");
    return this.contracts.bridge;
  }

  public setTransactionStreamWaiter(
    waiter: TransactionStreamWaiter | undefined,
    submitObserver?: (transactionHash: string) => void,
  ): void {
    this.transactionStreamWaiter = waiter;
    this.transactionStreamSubmitObserver = submitObserver;
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

  private getTransactionCalls(transactionDetails: AllowArray<Call>): Call[] {
    return Array.isArray(transactionDetails) ? transactionDetails : [transactionDetails];
  }

  private getExploreTransactionExplorerId(calls: AllowArray<Call>): string | undefined {
    const call = this.getTransactionCalls(calls).find(
      ({ entrypoint }) => entrypoint === "Explore" || entrypoint === "Move",
    );
    return Array.isArray(call?.calldata) ? this.normalizeAddress(String(call.calldata[2])) : undefined;
  }

  private getTransactionSerializationKey(signer: Account | AccountInterface): string {
    return `native:${this.gameId}:${this.normalizeAddress(signer.address)}`;
  }

  private createActorExecutionLock(): ActorExecutionLock {
    let resolve!: () => void;
    const completed = new Promise<void>((innerResolve) => {
      resolve = innerResolve;
    });

    return { completed, resolve };
  }

  private async acquireActorExecutionLock(key: string): Promise<() => void> {
    while (true) {
      const existingLock = this.pendingActorExecutionLocks.get(key);
      if (!existingLock) {
        const lock = this.createActorExecutionLock();
        this.pendingActorExecutionLocks.set(key, lock);

        let released = false;
        return () => {
          if (released) {
            return;
          }
          released = true;

          const currentLock = this.pendingActorExecutionLocks.get(key);
          if (currentLock === lock) {
            this.pendingActorExecutionLocks.delete(key);
          }
          lock.resolve();
        };
      }

      await existingLock.completed;
    }
  }

  /** Every command is a signed intent through the shard's admission; there is no other way to submit. */
  private async submitTransaction(
    signer: Account | AccountInterface,
    transactionDetails: AllowArray<Call>,
  ): Promise<SubmittedTransaction> {
    if (!this.nativeSubmission) throw new Error("Native submission is not configured");
    return this.nativeSubmission(signer, transactionDetails);
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

  private emitTransactionSubmitted(
    transactionHash: string,
    transactionMeta: TransactionLifecycleMeta,
    ticket?: NativeTicketIdentity,
  ): void {
    this.transactionStreamSubmitObserver?.(transactionHash);
    this.emit("transactionSubmitted", {
      transactionHash,
      ...transactionMeta,
      ...(ticket ? { ticket } : {}),
    });
  }

  private emitTransactionPending(transactionHash: string, transactionMeta: TransactionLifecycleMeta): void {
    this.emit("transactionPending", {
      transactionHash,
      ...transactionMeta,
    });
  }

  /**
   * Execute a transaction and check its result
   *
   * @param signer - Account that will sign the transaction
   * @param transactionDetails - Transaction call data
   * @param batchDetails - Optional details about batched transactions (from PromiseQueue)
   * @returns Transaction receipt
   */
  private async executeAndCheckTransaction(
    signer: Account | AccountInterface,
    rawTransactionDetails: AllowArray<Call>,
    batchDetails?: BatchedTransactionDetail[],
    options?: ExecutionOptions & { transactionType?: TransactionType },
  ) {
    const transactionDetails = rawTransactionDetails;

    const isMultipleTransactions = Array.isArray(transactionDetails);

    // Get the transaction type based on the entrypoint name
    let txType: TransactionType;

    if (isMultipleTransactions) {
      // For multiple calls, use the first call's entrypoint
      txType = TransactionType[transactionDetails[0]?.entrypoint.toUpperCase() as keyof typeof TransactionType];
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
    await this.runTransactionSubmitGuard(signer, transactionMeta);
    if (txType === TransactionType.EXPLORE) {
      this.emit("transactionProgress", {
        stage: "explore_submit_guard_released",
        type: txType,
        explorerId: this.getExploreTransactionExplorerId(transactionDetails),
        signerAddress: transactionMeta.signerAddress,
      });
    }

    // Native actions share the player's recorded nonce; the next command signs only after Herald applies it.
    let releaseActorExecutionLock: (() => void) | undefined = await this.acquireActorExecutionLock(
      this.getTransactionSerializationKey(signer),
    );
    if (txType === TransactionType.EXPLORE) {
      this.emit("transactionProgress", {
        stage: "explore_provider_lock_acquired",
        type: txType,
        explorerId: this.getExploreTransactionExplorerId(transactionDetails),
        signerAddress: transactionMeta.signerAddress,
      });
    }

    let tx: SubmittedTransaction;
    // Admission to visible: from sending the ticket to the stream reporting its outcome with its facts applied.
    let submitStartedAt = 0;
    try {
      if (txType === TransactionType.EXPLORE) {
        this.emit("transactionProgress", {
          stage: "explore_sign_send_started",
          type: txType,
          explorerId: this.getExploreTransactionExplorerId(transactionDetails),
          signerAddress: transactionMeta.signerAddress,
        });
      }
      submitStartedAt = Date.now();
      tx = await this.submitTransaction(signer, transactionDetails);
    } catch (error) {
      const message = extractErrorMessage(error);
      const submitFailure = classifySubmitFailure(error);
      releaseActorExecutionLock?.();
      releaseActorExecutionLock = undefined;
      this.emitTransactionFailure({
        ...transactionMeta,
        message: `Transaction failed to submit: ${message}`,
        stage: "submit",
        ...submitFailure,
        ...buildFailureDiagnostics(error),
      });
      throw error;
    }

    // Emit immediately so UI can show pending state
    this.emitTransactionSubmitted(tx.transaction_hash, transactionMeta, tx.ticket);

    const waitForConfirmation = options?.waitForConfirmation ?? true;
    const transactionMetaWithHash = {
      ...transactionMeta,
      transactionHash: tx.transaction_hash,
    };
    if (!this.transactionStreamWaiter) {
      releaseActorExecutionLock?.();
      releaseActorExecutionLock = undefined;
      this.emitTransactionPending(tx.transaction_hash, transactionMeta);
      return {
        statusReceipt: "PENDING",
        transaction_hash: tx.transaction_hash,
      } as unknown as GetTransactionReceiptResponse;
    }
    const streamReceipt = this.waitForTransactionWithCheckInternal(
      tx.transaction_hash,
      transactionMetaWithHash,
      tx.ticket,
    );
    // The actor's next command signs only after Herald applies this one, so it never carries a stale nonce.
    const waitPromise = releaseActorExecutionLock
      ? streamReceipt.finally(() => {
          releaseActorExecutionLock?.();
          releaseActorExecutionLock = undefined;
        })
      : streamReceipt;

    if (!waitForConfirmation) {
      this.emitTransactionPending(tx.transaction_hash, transactionMeta);
      void waitPromise
        .then((receipt) => {
          this.emit("transactionComplete", {
            details: receipt,
            admissionToVisibleMs: Date.now() - submitStartedAt,
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

    let receipt: GetTransactionReceiptResponse;
    try {
      receipt = await waitPromise;
    } catch (error) {
      this.emitTransactionFailure({
        ...transactionMetaWithHash,
        message: extractErrorMessage(error),
        stage: resolveTransactionFailureStage(error, "confirmation"),
        ...buildFailureDiagnostics(error),
      });
      throw error;
    }

    this.emit("transactionComplete", {
      details: receipt,
      admissionToVisibleMs: Date.now() - submitStartedAt,
      ...transactionMeta,
    });

    return receipt;
  }

  private async waitForTransactionWithCheckInternal(
    transactionHash: string,
    _transactionMeta?: TransactionLifecycleMeta,
    ticket?: NativeTicketIdentity,
  ): Promise<GetTransactionReceiptResponse> {
    if (!this.transactionStreamWaiter) {
      return {
        statusReceipt: "PENDING",
        transaction_hash: transactionHash,
      } as unknown as GetTransactionReceiptResponse;
    }

    let transaction = await this.transactionStreamWaiter(transactionHash, ticket).catch((error) => {
      throw attachTransactionFailureStage(error, "confirmation");
    });

    if (ticket && transaction.status !== "REVERTED") {
      const outcome = requireNativeExecutionOutcome(transaction.executions, ticket);
      transaction = {
        ...transaction,
        status: outcome.status === "REVERTED" ? "REVERTED" : transaction.status,
        revertReason:
          outcome.status === "REVERTED"
            ? `Native action rejected: ${outcome.statusClass}: ${outcome.reason}`
            : undefined,
        batchRemaining: outcome.batchRemaining,
      };
    }

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
      ...(transaction.batchRemaining !== undefined ? { batch_remaining: transaction.batchRemaining } : {}),
      transaction_hash: transaction.hash,
    } as GetTransactionReceiptResponse;
  }

  public async create_order(props: SystemProps.CreateOrderProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "CreateTradeOrder",
        value: {
          maker_id: props.maker_id,
          taker_id: props.taker_id,
          offered_resource: props.maker_gives_resource_type,
          requested_resource: props.taker_pays_resource_type,
          offered_per_lot: props.maker_gives_min_resource_amount,
          requested_per_lot: props.taker_pays_min_resource_amount,
          lots: props.maker_gives_max_count,
          expires_at: props.expires_at,
        },
      },
      TransactionType.CREATE_ORDER,
    );
  }

  public async accept_order(props: SystemProps.AcceptOrderProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "AcceptTradeOrder",
        value: { trade_id: props.trade_id, taker_id: props.taker_id, lots: props.taker_buys_count },
      },
      TransactionType.ACCEPT_ORDER,
    );
  }

  public async cancel_order(props: SystemProps.CancelOrderProps) {
    return this.submitCommand(
      props.signer,
      { kind: "CancelTradeOrder", value: props.trade_id },
      TransactionType.CANCEL_ORDER,
    );
  }

  public async create_hyperstructure(props: SystemProps.SystemSigner & { x: number; y: number; alt: boolean }) {
    return this.submitCommand(
      props.signer,
      { kind: "CreateReservedHyperstructure", value: { alt: props.alt, x: props.x, y: props.y } },
      TransactionType.INITIALIZE,
    );
  }

  public async enter_depth(props: SystemProps.SystemSigner & { explorerId: number; depth: number }) {
    return this.submitCommand(
      props.signer,
      { kind: "EnterDepth", value: { explorer_id: props.explorerId, depth: props.depth } },
      TransactionType.ENTER_DEPTH,
    );
  }

  public async buy_realm_upgrade(
    props: SystemProps.SystemSigner & { structureId: number; lane: "Barracks" | "Attunement" },
  ) {
    return this.submitCommand(
      props.signer,
      {
        kind: "BuyRealmUpgrade",
        value: { structure_id: props.structureId, lane: { kind: props.lane, value: undefined } },
      },
      TransactionType.BUY_REALM_UPGRADE,
    );
  }

  public async settle_season(props: SystemProps.SystemSigner & { name: string; selectedRealm?: number }) {
    return this.submitCommand(
      props.signer,
      {
        kind: "SettleSeason",
        value: {
          name: props.name,
          selected_realm:
            props.selectedRealm === undefined
              ? { kind: "None", value: undefined }
              : { kind: "Some", value: props.selectedRealm },
        },
      },
      TransactionType.SETTLE,
    );
  }

  public async upgrade_realm(props: SystemProps.UpgradeRealmProps) {
    return this.submitCommand(
      props.signer,
      { kind: "LevelUp", value: props.realm_entity_id },
      TransactionType.LEVEL_UP,
    );
  }

  public async receive_army_grant(props: SystemProps.ReceiveArmyGrantProps) {
    return this.submitCommand(
      props.signer,
      { kind: "ReceiveVillageArmy", value: props.village_id },
      TransactionType.CREATE,
    );
  }

  public async arrivals_offload(props: SystemProps.ArrivalsOffloadProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "OffloadArrival",
        value: { entity_id: props.structureId, day: props.day, slot: props.slot, resource_count: props.resource_count },
      },
      TransactionType.ARRIVALS_OFFLOAD,
    );
  }

  public async set_entity_name(props: SystemProps.SetEntityNameProps) {
    return this.submitCommand(
      props.signer,
      { kind: "SetEntityName", value: { entity_id: props.entity_id, name: shortString.encodeShortString(props.name) } },
      TransactionType.SET_ENTITY_NAME,
    );
  }

  public async create_building(props: SystemProps.CreateBuildingProps): Promise<GetTransactionReceiptResponse> {
    return this.submitCommand(
      props.signer,
      {
        kind: "CreateBuilding",
        value: {
          structure_id: props.entity_id,
          directions: props.directions,
          category: props.building_category,
          use_simple: props.use_simple,
        },
      },
      TransactionType.CREATE_BUILDING,
    );
  }

  public async guard_add(props: SystemProps.GuardAddProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "ManageTroops",
        value: {
          kind: "RecruitGuard",
          value: {
            guard: { structure_id: props.for_structure_id, slot: props.slot },
            category: unitVariant(props.category, ["Knight", "Paladin", "Crossbowman"] as const),
            tier: unitVariant(props.tier, ["T1", "T2", "T3"] as const),
            amount: props.amount,
          },
        },
      },
      TransactionType.GUARD_ADD,
    );
  }

  public async guard_delete(props: SystemProps.GuardDeleteProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "ManageTroops",
        value: { kind: "RemoveGuard", value: { structure_id: props.for_structure_id, slot: props.slot } },
      },
      TransactionType.GUARD_DELETE,
    );
  }

  public async explorer_create(props: SystemProps.ExplorerCreateProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "CreateExplorer",
        value: {
          structure_id: props.for_structure_id,
          category: props.category,
          tier: props.tier,
          amount: props.amount,
          direction: props.spawn_direction,
        },
      },
      TransactionType.EXPLORER_CREATE,
    );
  }

  public async explorer_add(props: SystemProps.ExplorerAddProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "ManageTroops",
        value: { kind: "RecruitExplorer", value: { explorer_id: props.to_explorer_id, amount: props.amount } },
      },
      TransactionType.EXPLORER_ADD,
    );
  }

  public async explorer_delete(props: SystemProps.ExplorerDeleteProps) {
    return this.submitCommand(
      props.signer,
      { kind: "ManageTroops", value: { kind: "RemoveExplorer", value: props.explorer_id } },
      TransactionType.EXPLORER_DELETE,
    );
  }

  public async bitcoin_mine_contribute_labor(props: SystemProps.BitcoinMineContributeLaborProps) {
    return this.submitCommand(
      props.signer,
      { kind: "ContributeBitcoinLabor", value: { structure_id: props.structure_id, amount: props.labor_amount } },
      TransactionType.BITCOIN_MINE_CONTRIBUTE_LABOR,
    );
  }

  public async bitcoin_mine_claim_phase_reward(props: SystemProps.BitcoinMineClaimPhaseRewardProps) {
    return requireBatchReceipt(
      await this.submitCommand(
        props.signer,
        { kind: "ClaimBitcoinPhase", value: { phase: props.phase_id, mine_ids: props.mine_ids } },
        TransactionType.BITCOIN_MINE_CLAIM_PHASE_REWARD,
      ),
    );
  }

  public async bitcoin_mine_close_phase(props: SystemProps.BitcoinMinePhaseProps) {
    return this.submitCommand(props.signer, { kind: "CloseBitcoinPhase", value: props.phase_id });
  }

  public async bitcoin_mine_bind_phase(props: SystemProps.BitcoinMinePhaseProps) {
    return this.submitCommand(props.signer, { kind: "BindBitcoinPhase", value: props.phase_id });
  }

  public async toggle_alternate(props: SystemProps.ToggleAlternateProps) {
    return this.submitCommand(
      props.signer,
      { kind: "ToggleAlternate", value: { explorer_id: props.explorer_id, spire_direction: props.spire_direction } },
      TransactionType.TRAVEL_HEX,
    );
  }

  public async explorer_travel(props: SystemProps.ExplorerTravelProps) {
    return this.submitCommand(
      props.signer,
      { kind: "Move", value: { explorer_id: props.explorer_id, directions: props.directions } },
      TransactionType.TRAVEL_HEX,
    );
  }

  public async attack_explorer_vs_explorer(props: SystemProps.AttackExplorerVsExplorerProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "Battle",
        value: {
          attacker_id: props.aggressor_id,
          defender_id: props.defender_id,
          steal_resources: resourceAmounts(props.steal_resources),
        },
      },
      TransactionType.ATTACK_EXPLORER_VS_EXPLORER,
    );
  }

  public async attack_explorer_vs_guard(props: SystemProps.AttackExplorerVsGuardProps) {
    return this.submitCommand(
      props.signer,
      { kind: "BattleGuard", value: { attacker_id: props.explorer_id, defender_id: props.structure_id } },
      TransactionType.ATTACK_EXPLORER_VS_GUARD,
    );
  }

  public async attack_guard_vs_explorer(props: SystemProps.AttackGuardVsExplorerProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "GuardAttack",
        value: {
          guard: { structure_id: props.structure_id, slot: props.structure_guard_slot },
          explorer_id: props.explorer_id,
        },
      },
      TransactionType.ATTACK_GUARD_VS_EXPLORER,
    );
  }

  public async raid_explorer_vs_guard(props: SystemProps.RaidExplorerVsGuardProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "Raid",
        value: {
          explorer_id: props.explorer_id,
          structure_id: props.structure_id,
          steal_resources: resourceAmounts(props.steal_resources),
        },
      },
      TransactionType.RAID_EXPLORER_VS_GUARD,
    );
  }

  public async pledge_faith(props: SystemProps.PledgeFaithProps) {
    return this.submitCommand(
      props.signer,
      { kind: "PledgeFaith", value: { structure_id: props.structure_id, wonder_id: props.wonder_id } },
      TransactionType.PLEDGE_FAITH,
    );
  }

  public async remove_faith(props: SystemProps.RemoveFaithProps) {
    return this.submitCommand(
      props.signer,
      { kind: "RemoveFaith", value: props.structure_id },
      TransactionType.REMOVE_FAITH,
    );
  }

  public async update_wonder_ownership(props: SystemProps.UpdateWonderOwnershipProps) {
    return this.submitCommand(
      props.signer,
      { kind: "UpdateWonderOwnership", value: props.wonder_id },
      TransactionType.UPDATE_WONDER_OWNERSHIP,
    );
  }

  public async update_structure_ownership(props: SystemProps.UpdateStructureOwnershipProps) {
    return this.submitCommand(
      props.signer,
      { kind: "UpdateFaithfulOwnership", value: props.structure_id },
      TransactionType.UPDATE_STRUCTURE_OWNERSHIP,
    );
  }

  public async create_guild(props: SystemProps.CreateGuildProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "CreateGuild",
        value: {
          owned_structure_id: this.ownedStructure(props.signer.address),
          public: props.is_public,
          name: props.guild_name,
        },
      },
      TransactionType.CREATE_GUILD,
    );
  }

  public async join_guild(props: SystemProps.JoinGuildProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "JoinGuild",
        value: { owned_structure_id: this.ownedStructure(props.signer.address), guild_id: props.guild_entity_id },
      },
      TransactionType.JOIN_GUILD,
    );
  }

  public async update_whitelist(props: SystemProps.UpdateWhitelist) {
    return this.submitCommand(
      props.signer,
      {
        kind: "SetGuildWhitelist",
        value: {
          owned_structure_id: this.ownedStructure(props.signer.address),
          player: props.address,
          allowed: props.whitelist,
        },
      },
      TransactionType.UPDATE_WHITELIST,
    );
  }

  public async remove_guild_member(props: SystemProps.RemoveGuildMember) {
    return this.submitCommand(
      props.signer,
      { kind: "RemoveGuildMember", value: props.player_address_to_remove },
      TransactionType.REMOVE_GUILD_MEMBER,
    );
  }

  public async leave_guild(props: SystemProps.LeaveGuildProps) {
    return this.submitCommand(props.signer, { kind: "LeaveGuild", value: undefined }, TransactionType.LEAVE_GUILD);
  }

  public async initialize(props: SystemProps.InitializeHyperstructureProps) {
    return this.submitCommand(
      props.signer,
      { kind: "InitializeHyperstructure", value: props.hyperstructure_id },
      TransactionType.INITIALIZE,
    );
  }

  public async contribute_to_construction(props: SystemProps.ContributeToConstructionProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "ContributeHyperstructure",
        value: {
          hyperstructure_id: props.hyperstructure_entity_id,
          from_structure_id: props.contributor_entity_id,
          resources: props.contributions.map(({ resource, amount }) => ({ resource_type: resource, amount })),
        },
      },
      TransactionType.CONTRIBUTE,
    );
  }

  public async set_access(props: SystemProps.SetAccessProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "SetConstructionAccess",
        value: {
          hyperstructure_id: props.hyperstructure_entity_id,
          access: unitVariant(props.access, ["Public", "Private", "GuildOnly"] as const),
        },
      },
      TransactionType.SET_ACCESS,
    );
  }

  public async end_game(props: SystemProps.EndGameProps) {
    return requireBatchReceipt(
      await this.submitCommand(props.signer, { kind: "CloseSeason", value: undefined }, TransactionType.END_GAME),
    );
  }

  public async allocate_shares(props: SystemProps.SetCoOwnersProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "AllocateHyperstructureShares",
        value: {
          hyperstructure_id: props.hyperstructure_entity_id,
          shareholders: props.co_owners.map((owner) => ({ player: owner[0], bps: owner[1] })),
        },
      },
      TransactionType.ALLOCATE_SHARES,
    );
  }

  public async burn_labor_for_resource_production(props: SystemProps.BurnLaborResourcesForOtherProductionProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "BurnLaborForResourceProduction",
        value: {
          structure_id: props.from_entity_id,
          resource_types: props.produced_resource_types,
          amounts: props.production_cycles,
        },
      },
      TransactionType.BURN_LABOR_FOR_RESOURCE_PRODUCTION,
    );
  }

  public async burn_resource_for_resource_production(props: SystemProps.BurnOtherPredefinedResourcesForResourcesProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "BurnResourceForResourceProduction",
        value: {
          structure_id: props.from_entity_id,
          resource_types: props.produced_resource_types,
          amounts: props.production_cycles,
        },
      },
      TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION,
    );
  }

  public async open_chest(props: SystemProps.OpenChestProps) {
    return this.submitCommand(
      props.signer,
      { kind: "OpenRelicChest", value: { explorer_id: props.explorer_id, coord: props.chest_coord } },
      TransactionType.OPEN_CHEST,
    );
  }

  public async burn_research_for_relic(props: SystemProps.BurnResearchForRelicProps) {
    return this.submitCommand(
      props.signer,
      { kind: "CraftRelic", value: props.structure_id },
      TransactionType.BURN_RESEARCH_FOR_RELIC,
    );
  }

  public async apply_relic(props: SystemProps.ApplyRelicProps) {
    return this.submitCommand(props.signer, {
      kind: "ApplyRelic",
      value: {
        entity_id: props.entity_id,
        relic_id: props.relic_resource_id,
        recipient: unitVariant(props.recipient_type, ["Explorer", "StructureProduction", "StructureGuard"] as const),
      },
    });
  }

  public async transfer_structure_ownership(props: SystemProps.TransferStructureOwnershipProps) {
    return this.submitCommand(props.signer, {
      kind: "TransferStructureOwnership",
      value: { entity_id: props.structure_id, new_owner: props.new_owner },
    });
  }

  public async structure_burn(props: SystemProps.StructureBurnProps) {
    return this.submitCommand(props.signer, {
      kind: "BurnStructureResources",
      value: { entity_id: props.structure_id, resources: resourceAmounts(props.resources) },
    });
  }

  public async destroy_building(props: SystemProps.DestroyBuildingProps) {
    return this.submitCommand(
      props.signer,
      { kind: "DestroyBuilding", value: { structure_id: props.entity_id, coord: props.building_coord } },
      TransactionType.DESTROY_BUILDING,
    );
  }

  public async pause_production(props: SystemProps.PauseProductionProps) {
    return this.submitCommand(
      props.signer,
      { kind: "PauseBuildingProduction", value: { structure_id: props.entity_id, coord: props.building_coord } },
      TransactionType.PAUSE_BUILDING_PRODUCTION,
    );
  }

  public async resume_production(props: SystemProps.ResumeProductionProps) {
    return this.submitCommand(
      props.signer,
      { kind: "ResumeBuildingProduction", value: { structure_id: props.entity_id, coord: props.building_coord } },
      TransactionType.RESUME_BUILDING_PRODUCTION,
    );
  }

  public async buy_resources(props: SystemProps.BuyResourcesProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "BuyFromBank",
        value: {
          bank_id: props.bank_entity_id,
          structure_id: props.entity_id,
          resource_type: props.resource_type,
          amount: props.amount,
        },
      },
      TransactionType.BUY,
    );
  }

  public async sell_resources(props: SystemProps.SellResourcesProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "SellToBank",
        value: {
          bank_id: props.bank_entity_id,
          structure_id: props.entity_id,
          resource_type: props.resource_type,
          amount: props.amount,
        },
      },
      TransactionType.SELL,
    );
  }

  public async remove_liquidity(props: SystemProps.RemoveLiquidityProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "RemoveBankLiquidity",
        value: {
          bank_id: props.bank_entity_id,
          structure_id: props.entity_id,
          resource_type: props.resource_type,
          shares: props.shares,
        },
      },
      TransactionType.REMOVE,
    );
  }

  public async troop_troop_adjacent_transfer(props: SystemProps.TroopTroopAdjacentTransferProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "TransferExplorerResources",
        value: {
          from_entity_id: props.from_troop_id,
          to_entity_id: props.to_troop_id,
          resources: resourceAmounts(props.resources),
        },
      },
      TransactionType.TROOP_TROOP_ADJACENT_TRANSFER,
    );
  }

  public async troop_structure_adjacent_transfer(props: SystemProps.TroopStructureAdjacentTransferProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "TransferExplorerResourcesToStructure",
        value: {
          from_entity_id: props.from_explorer_id,
          to_entity_id: props.to_structure_id,
          resources: resourceAmounts(props.resources),
        },
      },
      TransactionType.TROOP_STRUCTURE_ADJACENT_TRANSFER,
    );
  }

  public async structure_troop_adjacent_transfer(props: SystemProps.StructureTroopAdjacentTransferProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "TransferStructureResourcesToExplorer",
        value: {
          from_entity_id: props.from_structure_id,
          to_entity_id: props.to_troop_id,
          resources: resourceAmounts(props.resources),
        },
      },
      TransactionType.STRUCTURE_TROOP_ADJACENT_TRANSFER,
    );
  }

  public async explorer_explorer_swap(props: SystemProps.ExplorerExplorerSwapProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "ManageTroops",
        value: {
          kind: "Transfer",
          value: {
            source: { kind: "Explorer", value: props.from_explorer_id },
            target: { kind: "Explorer", value: props.to_explorer_id },
            amount: props.count,
          },
        },
      },
      TransactionType.EXPLORER_EXPLORER_SWAP,
    );
  }

  public async explorer_guard_swap(props: SystemProps.ExplorerGuardSwapProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "ManageTroops",
        value: {
          kind: "Transfer",
          value: {
            source: { kind: "Explorer", value: props.from_explorer_id },
            target: { kind: "Guard", value: { structure_id: props.to_structure_id, slot: props.to_guard_slot } },
            amount: props.count,
          },
        },
      },
      TransactionType.EXPLORER_GUARD_SWAP,
    );
  }

  public async guard_explorer_swap(props: SystemProps.GuardExplorerSwapProps) {
    return this.submitCommand(
      props.signer,
      {
        kind: "ManageTroops",
        value: {
          kind: "Transfer",
          value: {
            source: { kind: "Guard", value: { structure_id: props.from_structure_id, slot: props.from_guard_slot } },
            target: { kind: "Explorer", value: props.to_explorer_id },
            amount: props.count,
          },
        },
      },
      TransactionType.GUARD_EXPLORER_SWAP,
    );
  }

  public async provision_realm(props: SystemProps.UpgradeRealmProps & { upgrade?: boolean }) {
    return this.submitCommand(
      props.signer,
      { kind: props.upgrade ? "ProvisionAndUpgradeRealm" : "ProvisionRealm", value: props.realm_entity_id },
      TransactionType.PROVISION_REALM,
    );
  }

  public async explorer_explore(props: SystemProps.ExplorerExploreProps) {
    if (props.directions.length !== 1) throw new Error("Exploration requires exactly one direction");
    return this.submitCommand(
      props.signer,
      { kind: "Explore", value: { explorer_id: props.explorer_id, direction: props.directions[0] } },
      TransactionType.EXPLORE,
    );
  }

  public async disband_guild(props: SystemProps.DisbandGuild) {
    let receipt: GetTransactionReceiptResponse | undefined;
    for (const player of props.calls)
      receipt = await this.remove_guild_member({ signer: props.signer, player_address_to_remove: player.address });
    if (!receipt) throw new Error("Guild disband requires members");
    return receipt;
  }

  public async add_liquidity(props: SystemProps.AddLiquidityProps) {
    let receipt: GetTransactionReceiptResponse | undefined;
    for (const value of props.calls)
      receipt = await this.submitCommand(props.signer, {
        kind: "AddBankLiquidity",
        value: { bank_id: props.bank_entity_id, structure_id: props.entity_id, ...value },
      });
    if (!receipt) throw new Error("Liquidity deposit requires resources");
    return receipt;
  }

  public async send_resources_multiple(props: SystemProps.SendResourcesMultipleProps) {
    let receipt: GetTransactionReceiptResponse | undefined;
    for (const call of props.calls)
      receipt = await this.submitCommand(
        props.signer,
        {
          kind: "SendResources",
          value: {
            from_entity_id: call.sender_entity_id,
            to_entity_id: call.recipient_entity_id,
            resources: pairedResources(call.resources),
          },
        },
        TransactionType.SEND,
      );
    if (!receipt) throw new Error("Resource transfer requires recipients");
    return receipt;
  }

  public async execute_realm_production_plan(
    props: SystemProps.ExecuteRealmProductionPlanProps,
  ): Promise<GetTransactionReceiptResponse | undefined> {
    let receipt: GetTransactionReceiptResponse | undefined;
    for (const [kind, instructions] of [
      ["BurnResourceForResourceProduction", props.resource_to_resource],
      ["BurnLaborForResourceProduction", props.labor_to_resource],
    ] as const) {
      const selected = instructions?.filter(({ cycles }) => BigInt(cycles) > 0n) ?? [];
      if (!selected.length) continue;
      receipt = await this.submitCommand(
        props.signer,
        {
          kind,
          value: {
            structure_id: props.realm_entity_id,
            resource_types: selected.map(({ resource_id }) => resource_id),
            amounts: selected.map(({ cycles }) => cycles),
          },
        },
        TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION,
      );
    }
    return receipt;
  }

  public async attack_explorer_vs_guard_and_garrison(props: SystemProps.AttackExplorerVsGuardAndGarrisonProps) {
    await this.attack_explorer_vs_guard(props);
    return this.explorer_guard_swap({
      signer: props.signer,
      from_explorer_id: props.explorer_id,
      to_structure_id: props.structure_id,
      to_structure_direction: props.structure_direction,
      to_guard_slot: props.to_guard_slot,
      count: props.count,
    });
  }

  public async bridge_deposit_into_realm(props: SystemProps.BridgeDepositIntoRealmProps) {
    let receipt: GetTransactionReceiptResponse | undefined;
    for (const resource of props.resources) {
      const approval = await props.signer.execute({
        contractAddress: String(resource.tokenAddress),
        entrypoint: "approve",
        calldata: CallData.compile({ spender: this.bridgeAddress(), amount: uint256.bnToUint256(resource.amount) }),
      });
      await this.provider.waitForTransaction(approval.transaction_hash);
      receipt = await this.submitCommand(props.signer, {
        kind: "DepositResource",
        value: {
          structure_id: props.recipient_structure_id,
          resource_type: resource.resource_type,
          amount: resource.amount,
          client_fee_recipient: props.client_fee_recipient,
        },
      });
    }
    if (!receipt) throw new Error("Bridge deposit requires resources");
    return receipt;
  }

  public async bridge_withdraw_from_realm(props: SystemProps.BridgeWithdrawFromRealmProps) {
    let receipt: GetTransactionReceiptResponse | undefined;
    for (const resource of props.resources)
      receipt = await this.submitCommand(props.signer, {
        kind: "WithdrawResource",
        value: {
          structure_id: props.from_structure_id,
          resource_type: resource.resource_type,
          amount: resource.amount,
          recipient: props.recipient_address,
          client_fee_recipient: props.client_fee_recipient,
        },
      });
    if (!receipt) throw new Error("Bridge withdrawal requires resources");
    return receipt;
  }

  public async claim_wonder_points(
    props: SystemProps.SystemSigner & { value: NativeCommandPayloads["ClaimWonderPoints"] },
  ) {
    return this.submitCommand(props.signer, { kind: "ClaimWonderPoints", value: props.value });
  }

  public async claim_player_faith_points(
    props: SystemProps.SystemSigner & { value: NativeCommandPayloads["ClaimPlayerFaithPoints"] },
  ) {
    return this.submitCommand(props.signer, { kind: "ClaimPlayerFaithPoints", value: props.value });
  }
}

function resourceAmounts(resources: readonly { resourceId: BigNumberish; amount: BigNumberish }[]) {
  return resources.map(({ resourceId, amount }) => ({ resource_type: resourceId, amount }));
}
function pairedResources(resources: readonly BigNumberish[]) {
  if (resources.length % 2 !== 0) throw new Error("Resource transfer requires id/amount pairs");
  return Array.from({ length: resources.length / 2 }, (_, index) => ({
    resource_type: resources[index * 2],
    amount: resources[index * 2 + 1],
  }));
}
function unitVariant<const T extends readonly string[]>(
  value: BigNumberish,
  variants: T,
): { kind: T[number]; value: undefined } {
  const kind = variants[Number(value)];
  if (!kind) throw new Error("Invalid command enum value");
  return { kind, value: undefined };
}
