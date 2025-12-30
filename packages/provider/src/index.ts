/**
 * Provider class for interacting with the Eternum game contracts
 *
 * @param katana - The katana manifest containing contract addresses and ABIs
 * @param url - Optional RPC URL for the provider
 */
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
  uint256,
} from "starknet";
import { ProviderHeartbeatManager, type ProviderDesyncStatus } from "./provider-heartbeat-manager";
import { TransactionType, type ProviderHeartbeat, type ProviderHeartbeatSource, type ProviderSyncState } from "./types";
export const NAMESPACE = "s1_eternum";
export { TransactionType };
export type { ProviderDesyncStatus, ProviderHeartbeat, ProviderHeartbeatSource, ProviderSyncState };
export const PROVIDER_HEARTBEAT_EVENT = "providerHeartbeat";
type TransactionFailureMeta = {
  type?: TransactionType;
  transactionCount?: number;
  transactionHash?: string;
};

/**
 * Gets a contract address from the manifest by name
 *
 * @param manifest - The manifest containing contract information
 * @param name - The name/tag of the contract to find
 * @returns The contract address
 * @throws Error if contract not found
 */
export const getContractByName = (manifest: any, name: string) => {
  const contract = manifest.contracts.find((contract: any) => contract.tag === name);
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
class PromiseQueue {
  private queue: Array<{
    providerCall: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    batchId?: string; // Added batchId to group related calls
  }> = [];
  private processing = false;
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 0; // ms to wait for batching
  private readonly MAX_BATCH_SIZE = 2; // Maximum number of calls to batch together

  constructor(private provider: EternumProvider) {}

  async enqueue<T>(providerCall: () => Promise<T>, batchId?: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ providerCall, resolve, reject, batchId });
      this.scheduleProcessing();
    });
  }

  private scheduleProcessing() {
    if (this.processing) return;

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.queue.length >= this.MAX_BATCH_SIZE) {
      void this.processQueue();
      return;
    }

    if (this.BATCH_DELAY <= 0) {
      void this.processQueue();
      return;
    }

    this.batchTimeout = setTimeout(() => {
      this.batchTimeout = null;
      void this.processQueue();
    }, this.BATCH_DELAY);
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        // Group calls by batchId
        const batchGroups = new Map<string | undefined, typeof this.queue>();
        this.queue.forEach((item) => {
          const group = batchGroups.get(item.batchId) || [];
          group.push(item);
          batchGroups.set(item.batchId, group);
        });

        // Process each batch group
        for (const [batchId, group] of batchGroups) {
          // Clear processed items from queue
          this.queue = this.queue.filter((item) => item.batchId !== batchId);

          // Split into chunks if needed while keeping batched items together
          const chunks = [];
          for (let i = 0; i < group.length; i += this.MAX_BATCH_SIZE) {
            chunks.push(group.slice(i, i + this.MAX_BATCH_SIZE));
          }

          // Process each chunk
          for (const batch of chunks) {
            console.log("Processing batch of size:", batch.length); // Debug log

            if (batch.length === 1) {
              const { providerCall, resolve, reject } = batch[0];
              console.log({ providerCall, batch });
              try {
                const result = await providerCall();
                resolve(result);
              } catch (error) {
                reject(error);
              }
            } else {
              console.log("batch", batch);
              try {
                // Extract the actual calls from the providerCalls
                const allCalls = await Promise.all(
                  batch.map(async ({ providerCall }) => {
                    // Access the internal call object
                    const fn = providerCall as any;
                    const calls = fn._transactionDetails;
                    // Handle both single calls and arrays of calls
                    return Array.isArray(calls) ? calls : [calls];
                  }),
                );

                // Flatten all calls into a single array
                const flattenedCalls = allCalls.flat();
                console.log("Batched calls:", flattenedCalls); // Debug log

                // Get signer from first call
                const signer = (batch[0].providerCall as any)._signer;

                // Execute the batched transaction
                const result = await this.provider.executeAndCheckTransaction(signer, flattenedCalls);

                // Resolve all promises with the result
                batch.forEach((item) => item.resolve(result));
              } catch (error) {
                console.error("Batch processing error:", error); // Debug log
                batch.forEach((item) => item.reject(error));
              }
            }
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

export const buildVrfCalls = async ({
  account,
  call,
  vrfProviderAddress,
  addressToCall,
}: {
  account: AccountInterface;
  call: Call;
  vrfProviderAddress: string | undefined;
  addressToCall: string;
}): Promise<Call[]> => {
  if (!account) return [];
  if (!vrfProviderAddress) throw new Error("VRF provider address is not defined");

  const requestRandomCall: Call = {
    contractAddress: vrfProviderAddress,
    entrypoint: "request_random",
    calldata: [addressToCall, 0, account.address],
  };

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
  private heartbeatManager: ProviderHeartbeatManager;
  private readonly TRANSACTION_CONFIRM_TIMEOUT_MS = 10_000;
  /**
   * Create a new EternumProvider instance
   *
   * @param katana - The katana manifest containing contract info
   * @param url - Optional RPC URL
   */
  constructor(
    katana: any,
    url?: string,
    private VRF_PROVIDER_ADDRESS?: string,
  ) {
    super(katana, url);
    this.manifest = katana;

    this.getWorldAddress = function () {
      const worldAddress = this.manifest.world.address;
      return worldAddress;
    };
    this.promiseQueue = new PromiseQueue(this);
    this.heartbeatManager = new ProviderHeartbeatManager((heartbeat) => {
      this.emit(PROVIDER_HEARTBEAT_EVENT, heartbeat);
    });
  }

  public getSyncState(): ProviderSyncState {
    return this.heartbeatManager.getSyncState();
  }

  public getDesyncStatus(thresholdMs = 10_000): ProviderDesyncStatus {
    return this.heartbeatManager.getDesyncStatus(thresholdMs);
  }

  public simulateHeartbeat(
    options: {
      source?: ProviderHeartbeatSource;
      timestamp?: number;
      offsetMs?: number;
      blockNumber?: number;
      transactionHash?: string;
    } = {},
  ): ProviderHeartbeat {
    return this.heartbeatManager.simulateHeartbeat(options);
  }

  public recordStreamActivity(meta?: { blockNumber?: number; timestamp?: number }) {
    this.heartbeatManager.recordStreamActivity(meta);
  }

  private recordTransactionSubmission() {
    this.heartbeatManager.recordTransactionSubmission();
  }

  private recordTransactionConfirmation({
    transactionHash,
    blockNumber,
  }: {
    transactionHash: string;
    blockNumber?: number | null;
  }) {
    this.heartbeatManager.recordTransactionConfirmation({
      transactionHash,
      blockNumber,
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
   * @returns Transaction receipt
   */
  async executeAndCheckTransaction(signer: Account | AccountInterface, transactionDetails: AllowArray<Call>) {
    this.recordTransactionSubmission();
    if (typeof window !== "undefined") {
      console.log({ signer, transactionDetails });
    }
    const isMultipleTransactions = Array.isArray(transactionDetails);

    // Get the transaction type based on the entrypoint name
    let txType: TransactionType;

    if (isMultipleTransactions) {
      // For multiple calls, use the first call's entrypoint
      txType =
        TransactionType[
          transactionDetails
            // remove VRF provider call from the list to define the transaction type
            .filter((detail) => detail.contractAddress !== this.VRF_PROVIDER_ADDRESS)[0]
            ?.entrypoint.toUpperCase() as keyof typeof TransactionType
        ];
    } else {
      txType = TransactionType[transactionDetails.entrypoint.toUpperCase() as keyof typeof TransactionType];
    }

    const transactionMeta = {
      type: txType,
      ...(isMultipleTransactions && { transactionCount: transactionDetails.length }),
    };

    let tx;
    try {
      tx = await this.execute(signer as any, transactionDetails, NAMESPACE, { version: 3 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("transactionFailed", `Transaction failed to submit: ${message}`, transactionMeta);
      throw error;
    }

    const waitPromise = this.waitForTransactionWithCheckInternal(tx.transaction_hash, {
      ...transactionMeta,
      transactionHash: tx.transaction_hash,
    });
    const waitResult = await this.waitForTransactionWithTimeout(waitPromise, this.TRANSACTION_CONFIRM_TIMEOUT_MS);

    if (waitResult.status === "pending") {
      this.emit("transactionPending", {
        transactionHash: tx.transaction_hash,
        ...transactionMeta,
      });
      void waitPromise
        .then((receipt) => {
          this.emit("transactionComplete", {
            details: receipt,
            ...transactionMeta,
          });
        })
        .catch((error) => {
          console.error(`Error waiting for transaction ${tx.transaction_hash}`, error);
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
    if (typeof window !== "undefined") {
      console.log({ signer, transactionDetails });
    }
    const tx = await this.call(NAMESPACE, transactionDetails);
    return tx;
  }

  /**
   * Register a player for Blitz Realm
   *
   * @param props - Properties for registration
   * @param props.entryTokenAddress - Optional ERC721 contract address for entry tokens
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async blitz_realm_obtain_entry_token(props: SystemProps.BlitzRealmObtainEntryTokenProps) {
    const { signer, feeToken, feeAmount } = props;
    const blitzRealmSystemsAddress = getContractByName(this.manifest, `${NAMESPACE}-blitz_realm_systems`);

    const calls: Call[] = [];

    if (feeToken && feeAmount !== undefined) {
      try {
        const amountBigInt = typeof feeAmount === "bigint" ? feeAmount : BigInt(feeAmount as any);
        if (amountBigInt > 0n) {
          const amountUint256 = uint256.bnToUint256(amountBigInt);
          calls.push({
            contractAddress: feeToken,
            entrypoint: "approve",
            calldata: CallData.compile([blitzRealmSystemsAddress, amountUint256.low, amountUint256.high]),
          });
        }
      } catch (error) {
        console.error("Failed to prepare approval for entry token fee", error);
      }
    }

    calls.push({
      contractAddress: blitzRealmSystemsAddress,
      entrypoint: "obtain_entry_token",
      calldata: [],
    });

    const callArgs: AllowArray<Call> = calls.length === 1 ? calls[0] : calls;
    const call = this.createProviderCall(signer, callArgs);
    return await this.promiseQueue.enqueue(call);
  }

  public async blitz_realm_register(props: SystemProps.BlitzRealmRegisterProps) {
    const { signer, name, tokenId, entryTokenAddress, lockId } = props;

    const registerCall: Call = {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-blitz_realm_systems`),
      entrypoint: "register",
      calldata: [name, tokenId, 0],
    };

    if (entryTokenAddress) {
      const tokenIdUint256 = uint256.bnToUint256(tokenId);
      const entryTokenContractAddress =
        typeof entryTokenAddress === "string" && entryTokenAddress.startsWith("0x")
          ? entryTokenAddress
          : `0x${BigInt(entryTokenAddress as string).toString(16)}`;

      const tokenLockCall: Call = {
        contractAddress: entryTokenContractAddress,
        entrypoint: "token_lock",
        calldata: CallData.compile([tokenIdUint256, lockId ?? 69]),
      };

      const call = this.createProviderCall(signer, [tokenLockCall, registerCall]);
      return await this.promiseQueue.enqueue(call);
    }

    const call = this.createProviderCall(signer, registerCall);
    return await this.promiseQueue.enqueue(call);
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
        calldata: [getContractByName(this.manifest, `${NAMESPACE}-blitz_realm_systems`), 0, signer.address],
      };

      calls.push(requestRandomCall);
    }

    const makeHyperstructureCall: Call = {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-blitz_realm_systems`),
      entrypoint: "make_hyperstructures",
      calldata: [count],
    };
    calls.push(makeHyperstructureCall);
    return await this.promiseQueue.enqueue(this.createProviderCall(signer, calls));
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
        calldata: [getContractByName(this.manifest, `${NAMESPACE}-blitz_realm_systems`), 0, signer.address],
      };

      calls.push(requestRandomCall);
    }

    calls.push({
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-blitz_realm_systems`),
      entrypoint: "assign_realm_positions",
      calldata: [],
    });
    return await this.promiseQueue.enqueue(this.createProviderCall(signer, calls));
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
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-blitz_realm_systems`),
        entrypoint: "settle_realms",
        calldata: [settlement_count],
      },
    ];

    return await this.promiseQueue.enqueue(this.createProviderCall(signer, calls));
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
        calldata: [getContractByName(this.manifest, `${NAMESPACE}-blitz_realm_systems`), 0, signer.address],
      };

      calls.push(requestRandomCall);
    }

    calls.push({
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-blitz_realm_systems`),
      entrypoint: "assign_realm_positions",
      calldata: [],
    });

    calls.push({
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-blitz_realm_systems`),
      entrypoint: "settle_realms",
      calldata: [settlement_count],
    });

    return await this.promiseQueue.enqueue(this.createProviderCall(signer, calls));
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
    transactionMeta?: TransactionFailureMeta,
  ): Promise<GetTransactionReceiptResponse> {
    let receipt;
    try {
      receipt = await this.provider.waitForTransaction(transactionHash, {
        retryInterval: 500,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("transactionFailed", `Transaction failed while waiting for confirmation: ${message}`, {
        ...transactionMeta,
        transactionHash,
      });
      console.error(`Error waiting for transaction ${transactionHash}`);
      throw error;
    }

    const receiptAny = receipt as any;
    const blockNumber =
      typeof receiptAny?.block_number === "number"
        ? receiptAny.block_number
        : typeof receiptAny?.blockNumber === "number"
          ? receiptAny.blockNumber
          : undefined;

    this.recordTransactionConfirmation({
      transactionHash,
      blockNumber,
    });

    // Check if the transaction was reverted and throw an error if it was
    if (receipt.isReverted()) {
      const revertReason =
        typeof receiptAny?.revert_reason === "string"
          ? receiptAny.revert_reason
          : typeof receiptAny?.revertReason === "string"
            ? receiptAny.revertReason
            : "Unknown revert reason";
      const message = `Transaction failed with reason: ${revertReason}`;
      this.emit("transactionFailed", message, {
        ...transactionMeta,
        transactionHash,
      });
      throw new Error(message);
    }

    return receipt;
  }

  public async bridge_withdraw_from_realm(props: SystemProps.BridgeWithdrawFromRealmProps) {
    const { resources, from_structure_id, recipient_address, client_fee_recipient, signer } = props;

    const calls = resources.map((resource) => ({
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_bridge_systems`),
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
        getContractByName(this.manifest, `${NAMESPACE}-resource_bridge_systems`),
        resource.amount,
        0, // u128, u128
      ],
    }));

    const depositCalls = resources.map((resource) => ({
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_bridge_systems`),
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-trade_systems`),
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
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-trade_systems`),
      entrypoint: "accept_order",
      calldata: [taker_id, trade_id, taker_buys_count],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-trade_systems`),
      entrypoint: "cancel_order",
      calldata: [trade_id],
    });

    return await this.promiseQueue.enqueue(call);
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-dev_resource_systems`),
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-structure_systems`),
      entrypoint: "level_up",
      calldata: [realm_entity_id],
    });

    return await this.promiseQueue.enqueue(call);
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
    const { village_pass_token_id, connected_realm, direction, village_pass_address, signer } = props;

    let callData: Call[] = [];

    const approvalForAllCall: Call = {
      contractAddress: village_pass_address,
      entrypoint: "set_approval_for_all",
      calldata: [getContractByName(this.manifest, `${NAMESPACE}-village_systems`), true],
    };

    if (this.VRF_PROVIDER_ADDRESS !== undefined && Number(this.VRF_PROVIDER_ADDRESS) !== 0) {
      const requestRandomCall: Call = {
        contractAddress: this.VRF_PROVIDER_ADDRESS!,
        entrypoint: "request_random",
        calldata: [getContractByName(this.manifest, `${NAMESPACE}-village_systems`), 0, signer.address],
      };

      callData = [requestRandomCall];
    }

    const createCall: Call = {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-village_systems`),
      entrypoint: "create",
      calldata: [village_pass_token_id, connected_realm, direction],
    };

    const call = this.createProviderCall(signer, [approvalForAllCall, ...callData, createCall]);

    return await this.promiseQueue.enqueue(call);
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
    let { realms, owner, frontend, signer, season_pass_address } = props;

    const realmSystemsContractAddress = getContractByName(this.manifest, `${NAMESPACE}-realm_systems`);

    const approvalForAllCall = this.createProviderCall(signer, {
      contractAddress: season_pass_address,
      entrypoint: "set_approval_for_all",
      calldata: [realmSystemsContractAddress, true],
    });

    const createCalls = realms.map((realm) =>
      this.createProviderCall(signer, {
        contractAddress: realmSystemsContractAddress,
        entrypoint: "create",
        calldata: [owner, realm.realm_id, frontend, realm.realm_settlement],
      }),
    );

    const approvalCloseForAllCall = this.createProviderCall(signer, {
      contractAddress: season_pass_address,
      entrypoint: "set_approval_for_all",
      calldata: [realmSystemsContractAddress, false],
    });

    const calls = [approvalForAllCall, ...createCalls, approvalCloseForAllCall];
    return await Promise.all(calls.map((call) => this.promiseQueue.enqueue(call)));
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

    // const realmSystemsContractAddress = getContractByName(this.manifest, `${NAMESPACE}-blitz_realm_systems`);

    // const approvalForAllCall = {
    //   contractAddress: season_pass_address,
    //   entrypoint: "set_approval_for_all",
    //   calldata: [realmSystemsContractAddress, true],
    // };

    const createRealmCall = {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-ownership_systems`),
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
      entrypoint: "send",
      calldata: [
        sender_entity_id,
        recipient_entity_id,
        resources.length,
        ...resources.flatMap(({ resource, amount }) => [resource, amount]),
      ],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(
      signer,
      calls.map((call) => ({
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
        entrypoint: "send",
        calldata: [call.sender_entity_id, call.recipient_entity_id, call.resources.length / 2, ...call.resources],
      })),
    );

    return await this.promiseQueue.enqueue(call);
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
      entrypoint: "approve",
      calldata: [
        owner_entity_id,
        recipient_entity_id,
        resources.length,
        ...resources.flatMap(({ resource, amount }) => [resource, amount]),
      ],
    };

    const pickupCall = {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
      entrypoint: "pickup",
      calldata: [
        recipient_entity_id,
        owner_entity_id,
        resources.length,
        ...resources.flatMap(({ resource, amount }) => [resource, amount]),
      ],
    };

    const call = this.createProviderCall(signer, [approvalCall, pickupCall]);

    return await this.promiseQueue.enqueue(call);
  }

  public async arrivals_offload(props: SystemProps.ArrivalsOffloadProps) {
    const { structureId, day, slot, resource_count, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
      entrypoint: "arrivals_offload",
      calldata: [structureId, day, slot, resource_count],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-name_systems`),
      entrypoint: "set_address_name",
      calldata: [name],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-name_systems`),
      entrypoint: "set_entity_name",
      calldata: [entity_id, name],
    });

    return await this.promiseQueue.enqueue(call);
  }

  private createProviderCall(signer: Account | AccountInterface, transactionDetails: AllowArray<Call>) {
    const call = async () => {
      return await this.executeAndCheckTransaction(signer, transactionDetails);
    };
    // Explicitly store the details
    Object.defineProperties(call, {
      _signer: { value: signer },
      _transactionDetails: { value: transactionDetails },
    });
    return call;
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-production_systems`),
      entrypoint: "create_building",
      calldata: CallData.compile([entity_id, directions, building_category, use_simple]),
    });

    return await this.promiseQueue.enqueue(call);
  }

  /**
   * Destroy an existing building
   *
   * @param props - Properties for destroying building
   * @param props.entity_id - ID of the entity destroying the building
   * @param props.building_coord - Coordinates of building to destroy
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
   *     10,      // building_coord.x
   *     20       // building_coord.y
   *   ]
   * }
   * ```
   */
  public async destroy_building(props: SystemProps.DestroyBuildingProps) {
    const { entity_id, building_coord, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-production_systems`),
      entrypoint: "destroy_building",
      calldata: [entity_id, building_coord.x, building_coord.y],
    });

    return await this.promiseQueue.enqueue(call);
  }

  /**
   * Pause production at a building
   *
   * @param props - Properties for pausing production
   * @param props.entity_id - ID of the entity that owns the building
   * @param props.building_coord - Coordinates of the building
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
   *   building_coord: { x: 10, y: 20 },
   *   signer: account
   * }
   * ```
   */
  public async pause_production(props: SystemProps.PauseProductionProps) {
    const { entity_id, building_coord, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-production_systems`),
      entrypoint: "pause_building_production",
      calldata: [entity_id, building_coord.x, building_coord.y],
    });

    return await this.promiseQueue.enqueue(call);
  }

  /**
   * Resume production at a building
   *
   * @param props - Properties for resuming production
   * @param props.entity_id - ID of the entity that owns the building
   * @param props.building_coord - Coordinates of the building
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
   *   building_coord: { x: 10, y: 20 },
   *   signer: account
   * }
   * ```
   */
  public async resume_production(props: SystemProps.ResumeProductionProps) {
    const { entity_id, building_coord, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-production_systems`),
      entrypoint: "resume_building_production",
      calldata: [entity_id, building_coord.x, building_coord.y],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async execute_realm_production_plan(
    props: SystemProps.ExecuteRealmProductionPlanProps,
  ): Promise<GetTransactionReceiptResponse | undefined> {
    const { signer, realm_entity_id } = props;
    const productionSystemsAddress = getContractByName(this.manifest, `${NAMESPACE}-production_systems`);

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
    const call = this.createProviderCall(signer, callArgs);
    return await this.promiseQueue.enqueue(call);
  }

  /**
   * Create an admin bank
   *
   * @param props - Properties for creating an admin bank
   * @param props.name - Name of the admin bank
   * @param props.coord - Coordinates for the bank location
   * @param props.owner_fee_num - Numerator for owner fee calculation
   * @param props.owner_fee_denom - Denominator for owner fee calculation
   * @param props.owner_bridge_fee_dpt_percent - Owner bridge fee percentage for deposits
   * @param props.owner_bridge_fee_wtdr_percent - Owner bridge fee percentage for withdrawals
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Create an admin bank with 1% fees
   * {
   *   name: "Admin Bank 1",
   *   coord: 456,
   *   owner_fee_num: 1,
   *   owner_fee_denom: 100,
   *   owner_bridge_fee_dpt_percent: 100,
   *   owner_bridge_fee_wtdr_percent: 100,
   *   signer: account
   * }
   * ```
   */
  public async create_banks(props: SystemProps.CreateAdminBanksProps) {
    const { banks, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-bank_systems`),
      entrypoint: "create_banks",
      calldata: [banks.length, ...banks.flatMap((bank) => [bank.name, bank.coord.x, bank.coord.y])],
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-bank_systems`),
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-bank_systems`),
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-swap_systems`),
      entrypoint: "buy",
      calldata: [bank_entity_id, entity_id, resource_type, amount],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-swap_systems`),
      entrypoint: "sell",
      calldata: [bank_entity_id, entity_id, resource_type, amount],
    });

    return await this.promiseQueue.enqueue(call);
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
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-liquidity_systems`),
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
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-dev_resource_systems`),
        entrypoint: "mint",
        calldata: [bank_entity_id, resources.length / 2, ...resources],
      });

      // add the liquidity to the bank
      finalCalls.push({
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-liquidity_systems`),
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-liquidity_systems`),
      entrypoint: "remove",
      calldata: [bank_entity_id, entity_id, resource_type, shares],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_management_systems`),
      entrypoint: "guard_add",
      calldata: [for_structure_id, slot, category, tier, amount],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_management_systems`),
      entrypoint: "guard_delete",
      calldata: [for_structure_id, slot],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_management_systems`),
      entrypoint: "explorer_create",
      calldata: [for_structure_id, category, tier, amount, spawn_direction],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_management_systems`),
      entrypoint: "explorer_add",
      calldata: [to_explorer_id, amount, home_direction],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_management_systems`),
      entrypoint: "explorer_delete",
      calldata: [explorer_id],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
      entrypoint: "troop_troop_adjacent_transfer",
      calldata: [
        from_troop_id,
        to_troop_id,
        resources.length,
        ...resources.flatMap(({ resourceId, amount }) => [resourceId, amount]),
      ],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
      entrypoint: "troop_structure_adjacent_transfer",
      calldata: [
        from_explorer_id,
        to_structure_id,
        resources.length,
        ...resources.flatMap(({ resourceId, amount }) => [resourceId, amount]),
      ],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
      entrypoint: "structure_troop_adjacent_transfer",
      calldata: [
        from_structure_id,
        to_troop_id,
        resources.length,
        ...resources.flatMap(({ resourceId, amount }) => [resourceId, amount]),
      ],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_management_systems`),
      entrypoint: "explorer_explorer_swap",
      calldata: [from_explorer_id, to_explorer_id, to_explorer_direction, count],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_management_systems`),
      entrypoint: "explorer_guard_swap",
      calldata: [from_explorer_id, to_structure_id, to_structure_direction, to_guard_slot, count],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_management_systems`),
      entrypoint: "guard_explorer_swap",
      calldata: [from_structure_id, from_guard_slot, to_explorer_id, to_explorer_direction, count],
    });

    return await this.promiseQueue.enqueue(call);
  }

  /**
   * Move an explorer along a path of directions
   *
   * @param props - Properties for moving an explorer
   * @param props.explorer_id - ID of the explorer to move
   * @param props.directions - Array of directions to move in
   * @param props.explore - Whether to explore new tiles along the way
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async explorer_move(props: SystemProps.ExplorerMoveProps) {
    const { explorer_id, directions, explore, signer } = props;

    let callData: Call[] = [];

    if (explore && this.VRF_PROVIDER_ADDRESS !== undefined && Number(this.VRF_PROVIDER_ADDRESS) !== 0) {
      const requestRandomCall: Call = {
        contractAddress: this.VRF_PROVIDER_ADDRESS!,
        entrypoint: "request_random",
        calldata: [getContractByName(this.manifest, `${NAMESPACE}-troop_movement_systems`), 0, signer.address],
      };

      callData = [requestRandomCall];
    }

    const moveCall: Call = {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_movement_systems`),
      entrypoint: "explorer_move",
      calldata: [explorer_id, directions, explore ? 1 : 0],
    };

    const call = this.createProviderCall(signer, [...callData, moveCall]);

    console.log({ call });

    return await this.promiseQueue.enqueue(call);
  }
  /**
   * Attack an explorer with another explorer
   *
   * @param props - Properties for explorer vs explorer attack
   * @param props.aggressor_id - ID of the attacking explorer
   * @param props.defender_id - ID of the defending explorer
   * @param props.defender_direction - Direction to the defender
   * @param props.steal_resources - Resources to steal, as array of [resourceId, amount] tuples
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async attack_explorer_vs_explorer(props: SystemProps.AttackExplorerVsExplorerProps) {
    const { aggressor_id, defender_id, defender_direction, steal_resources, signer } = props;

    const calldata = [aggressor_id, defender_id, defender_direction];

    // Add steal_resources array length
    calldata.push(steal_resources.length);

    // Add each resource entry to calldata
    steal_resources.forEach((resource) => {
      calldata.push(resource.resourceId); // resourceId
      calldata.push(resource.amount); // amount
    });

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_battle_systems`),
      entrypoint: "attack_explorer_vs_explorer",
      calldata,
    });

    return await this.promiseQueue.enqueue(call);
  }

  /**
   * Attack a guard with an explorer
   *
   * @param props - Properties for explorer vs guard attack
   * @param props.explorer_id - ID of the attacking explorer
   * @param props.structure_id - ID of the structure with defending guard
   * @param props.structure_direction - Direction to the structure
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async attack_explorer_vs_guard(props: SystemProps.AttackExplorerVsGuardProps) {
    const { explorer_id, structure_id, structure_direction, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_battle_systems`),
      entrypoint: "attack_explorer_vs_guard",
      calldata: [explorer_id, structure_id, structure_direction],
    });

    return await this.promiseQueue.enqueue(call);
  }

  /**
   * Attack an explorer with a guard
   *
   * @param props - Properties for guard vs explorer attack
   * @param props.structure_id - ID of the structure with attacking guard
   * @param props.structure_guard_slot - Guard slot of the attacking troops
   * @param props.explorer_id - ID of the defending explorer
   * @param props.explorer_direction - Direction to the explorer
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async attack_guard_vs_explorer(props: SystemProps.AttackGuardVsExplorerProps) {
    const { structure_id, structure_guard_slot, explorer_id, explorer_direction, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_battle_systems`),
      entrypoint: "attack_guard_vs_explorer",
      calldata: [structure_id, structure_guard_slot, explorer_id, explorer_direction],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_raid_systems`),
      entrypoint: "raid_explorer_vs_guard",
      calldata: [
        explorer_id,
        structure_id,
        structure_direction,
        steal_resources.length, // Size of the span
        ...resourcesCalldata, // Flattened resource tuples
      ],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-production_systems`),
      entrypoint: "claim_wonder_production_bonus",
      calldata: [structure_id, wonder_structure_id],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async mint_starting_resources(props: SystemProps.MintStartingResources) {
    const { realm_entity_id, config_ids, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      config_ids.map((configId) => ({
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-realm_systems`),
        entrypoint: "mint_starting_resources",
        calldata: [configId, realm_entity_id],
      })),
    );
  }

  public async create_guild(props: SystemProps.CreateGuildProps) {
    const { is_public, guild_name, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "create_guild",
      calldata: [is_public, guild_name],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async join_guild(props: SystemProps.JoinGuildProps) {
    const { guild_entity_id, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "join_guild",
      calldata: [guild_entity_id],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async update_whitelist(props: SystemProps.UpdateWhitelist) {
    const { address, whitelist, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "update_whitelist",
      calldata: [address, whitelist],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async remove_guild_member(props: SystemProps.RemoveGuildMember) {
    const { player_address_to_remove, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "remove_member",
      calldata: [player_address_to_remove],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async disband_guild(props: SystemProps.DisbandGuild) {
    const { calls, signer } = props;

    const call = this.createProviderCall(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
          entrypoint: "remove_member",
          calldata: [call.address],
        };
      }),
    );

    return await this.promiseQueue.enqueue(call);
  }

  public async leave_guild(props: SystemProps.LeaveGuildProps) {
    const { signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "leave_guild",
      calldata: [],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async set_starting_resources_config(props: SystemProps.SetStartingResourcesConfigProps) {
    const { realmStartingResources, villageStartingResources, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
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
      village_find_probability,
      village_find_fail_probability,
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_map_config",
      calldata: [
        reward_amount,
        shards_mines_win_probability,
        shards_mines_fail_probability,
        agent_find_probability,
        agent_find_fail_probability,
        village_find_probability,
        village_find_fail_probability,
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

  public async set_discoverable_village_starting_resources_config(
    props: SystemProps.SetDiscoveredVillageSpawnResourcesConfigProps,
  ) {
    const { resources, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_village_found_resources_config",
      calldata: [
        resources.length,
        ...resources.flatMap(({ resource, min_amount, max_amount }) => [resource, min_amount, max_amount]),
      ],
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
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
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
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
        entrypoint: "set_victory_points_win_config",
        calldata: [points_for_win],
      },
    ]);
  }

  public async set_game_mode_config(props: SystemProps.SetBlitzModeConfigProps) {
    const { blitz_mode_on, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_game_mode_config",
      calldata: [blitz_mode_on],
    });
  }

  public async set_blitz_previous_game(props: SystemProps.SetBlitzPreviousGameProps) {
    const { prev_prize_distribution_systems, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_blitz_previous_game",
      calldata: [prev_prize_distribution_systems],
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
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
      season_pass_address,
      realms_address,
      lords_address,
      start_settling_at,
      start_main_at,
      end_at,
      bridge_close_end_grace_seconds,
      point_registration_grace_seconds,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_season_config",
      calldata: [
        dev_mode_on,
        season_pass_address,
        realms_address,
        lords_address,
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
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

  public async set_village_token_config(props: SystemProps.SetVillageTokenProps) {
    const { village_mint_initial_recipient, village_pass_nft_address, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_village_token_config",
      calldata: [village_pass_nft_address, village_mint_initial_recipient],
    });
  }

  public async set_wonder_bonus_config(props: SystemProps.SetWonderBonusConfigProps) {
    const { within_tile_distance, bonus_percent_num, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_wonder_bonus_config",
      calldata: [within_tile_distance, bonus_percent_num],
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
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
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
      ],
    });
  }

  public async set_donkey_speed_config(props: SystemProps.SetDonkeySpeedConfigProps) {
    const { sec_per_km, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_donkey_speed_config",
      calldata: [sec_per_km],
    });
  }

  public async set_resource_weight_config(props: SystemProps.SetWeightConfigProps) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
          entrypoint: "set_resource_weight_config",
          calldata: [call.entity_type, call.weight_nanogram],
        };
      }),
    );
  }

  public async set_trade_config(props: SystemProps.SetTradeConfigProps) {
    const { max_count, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_trade_config",
      calldata: [max_count],
    });
  }

  public async set_tick_config(props: SystemProps.SetTickConfigProps) {
    const { tick_interval_in_seconds, delivery_tick_interval_in_seconds, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_tick_config",
      calldata: [tick_interval_in_seconds, delivery_tick_interval_in_seconds],
    });
  }

  public async set_resource_factory_config(props: SystemProps.SetResourceFactoryConfigProps) {
    const { signer, calls } = props;
    const resourceFactoryCalldataArray = calls.map((call) => {
      return {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_bank_config",
      calldata: [lp_fee_num, lp_fee_denom, owner_fee_num, owner_fee_denom],
    });
  }

  public async set_resource_bridge_whitlelist_config(props: SystemProps.SetResourceBridgeWtlConfigProps) {
    const { resource_whitelist_configs, signer } = props;

    const calldata = resource_whitelist_configs.map(({ token, resource_type }) => ({
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_resource_bridge_whitelist_config",
      calldata: [token, resource_type],
    }));

    return await this.executeAndCheckTransaction(signer, calldata);
  }

  public async set_troop_config(props: SystemProps.SetTroopConfigProps) {
    const { signer, stamina_config, limit_config, damage_config } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
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
        limit_config.explorer_max_party_count,
        limit_config.explorer_guard_max_troop_count,
        limit_config.guard_resurrection_delay,
        limit_config.mercenaries_troop_lower_bound,
        limit_config.mercenaries_troop_upper_bound,
        limit_config.agent_troop_lower_bound,
        limit_config.agent_troop_upper_bound,
      ],
    });
  }

  public async set_battle_config(props: SystemProps.SetBattleConfigProps) {
    const { signer, regular_immunity_ticks, hyperstructure_immunity_ticks } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_battle_config",
      calldata: [regular_immunity_ticks, hyperstructure_immunity_ticks],
    });
  }

  public async set_structure_level_config(props: SystemProps.setRealmUpgradeConfigProps) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_world_config",
      calldata: [admin_address],
    });
  }
  public async set_mercenaries_name_config(props: SystemProps.SetMercenariesNameConfigProps) {
    const { name, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_mercenaries_name_config",
      calldata: [name],
    });
  }

  public async set_structure_max_level_config(props: SystemProps.SetStructureMaxLevelConfigProps) {
    const { realm_max_level, village_max_level, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_structure_max_level_config",
      calldata: [realm_max_level, village_max_level],
    });
  }

  public async set_building_config(props: SystemProps.SetBuildingConfigProps) {
    const { base_population, base_cost_percent_increase, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_building_config",
      calldata: [base_population, base_cost_percent_increase],
    });
  }

  public async set_building_category_config(props: SystemProps.SetBuildingCategoryConfigProps) {
    const { signer, calls } = props;
    const calldataArray = calls.map((call) => {
      return {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_hyperstructure_config",
      calldata,
    });
  }

  public async initialize(props: SystemProps.InitializeHyperstructureProps) {
    const { hyperstructure_id, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "initialize",
      calldata: [hyperstructure_id],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async contribute_to_construction(props: SystemProps.ContributeToConstructionProps) {
    const { hyperstructure_entity_id, contributor_entity_id, contributions, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "contribute",
      calldata: [hyperstructure_entity_id, contributor_entity_id, contributions],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async set_access(props: SystemProps.SetAccessProps) {
    const { hyperstructure_entity_id, access, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "update_construction_access",
      calldata: [hyperstructure_entity_id, access],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async end_game(props: SystemProps.EndGameProps) {
    const { signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-season_systems`),
      entrypoint: "season_close",
      calldata: [],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async allocate_shares(props: SystemProps.SetCoOwnersProps) {
    const { hyperstructure_entity_id, co_owners, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "allocate_shares",
      calldata: [hyperstructure_entity_id, co_owners.length, ...co_owners.flat()],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async season_prize_claim(props: SystemProps.ClaimLeaderboardRewardsProps) {
    const { signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-season_systems`),
      entrypoint: "season_prize_claim",
      calldata: [],
    });
  }

  // Prize distribution (Blitz)
  public async blitz_prize_player_rank(props: SystemProps.BlitzPrizePlayerRankProps) {
    const { trial_id, total_player_count_committed, players_list, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-prize_distribution_systems`),
      entrypoint: "blitz_prize_player_rank",
      calldata: [trial_id, total_player_count_committed, players_list.length, ...players_list],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async blitz_prize_claim(props: SystemProps.BlitzPrizeClaimProps) {
    const { players, signer } = props;

    const calls = [];
    if (this.VRF_PROVIDER_ADDRESS !== undefined && Number(this.VRF_PROVIDER_ADDRESS) !== 0) {
      const requestRandomCall: Call = {
        contractAddress: this.VRF_PROVIDER_ADDRESS!,
        entrypoint: "request_random",
        calldata: [getContractByName(this.manifest, `${NAMESPACE}-prize_distribution_systems`), 0, signer.address],
      };

      calls.push(requestRandomCall);
    }

    calls.push({
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-prize_distribution_systems`),
      entrypoint: "blitz_prize_claim",
      calldata: [players.length, ...players],
    });
    return await this.promiseQueue.enqueue(this.createProviderCall(signer, calls));
  }

  // Blitz prize: single-registrant no-game claim
  public async blitz_prize_claim_no_game(props: SystemProps.BlitzPrizeClaimNoGameProps) {
    const { registered_player, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-prize_distribution_systems`),
      entrypoint: "blitz_prize_claim_no_game",
      calldata: [registered_player],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async claim_construction_points(props: SystemProps.ClaimConstructionPointsProps) {
    const { hyperstructure_ids, player, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "claim_construction_points",
      calldata: [hyperstructure_ids.length, ...hyperstructure_ids, player],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async claim_share_points(props: SystemProps.ClaimSharePointsProps) {
    const { hyperstructure_ids, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "claim_share_points",
      calldata: [hyperstructure_ids.length, ...hyperstructure_ids],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async set_stamina_config(props: SystemProps.SetStaminaConfigProps) {
    const { unit_type, max_stamina, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_stamina_config",
      calldata: [unit_type, max_stamina],
    });
  }

  public async set_stamina_refill_config(props: SystemProps.SetStaminaRefillConfigProps) {
    const { amount_per_tick, start_boost_tick_count, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_stamina_refill_config",
      calldata: [amount_per_tick, start_boost_tick_count],
    });
  }

  public async set_settlement_config(props: SystemProps.SetSettlementConfigProps) {
    const { center, base_distance, subsequent_distance, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_settlement_config",
      calldata: [center, base_distance, subsequent_distance],
    });
  }

  public async grant_collectible_minter_role(props: {
    collectible_address: string;
    minter_address: string;
    signer: Account | AccountInterface;
  }) {
    const { collectible_address, minter_address, signer } = props;
    const MINTER_ROLE = "0x032df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: collectible_address,
      entrypoint: "grant_role",
      calldata: [MINTER_ROLE, minter_address],
    });
  }

  public async set_blitz_registration_config(props: SystemProps.SetBlitzRegistrationConfigProps) {
    const {
      fee_token,
      fee_recipient,
      fee_amount,
      registration_count_max,
      registration_start_at,
      entry_token_class_hash,
      entry_token_deploy_calldata,
      entry_token_ipfs_cid,
      collectibles_cosmetics_max,
      collectibles_cosmetics_address,
      collectibles_timelock_address,
      collectibles_lootchest_address,
      collectibles_elitenft_address,
      signer,
    } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_blitz_registration_config",
      calldata: [
        fee_token,
        fee_recipient,
        fee_amount,
        0,
        registration_count_max,
        registration_start_at,
        entry_token_class_hash,
        entry_token_deploy_calldata.length,
        ...entry_token_deploy_calldata,
        entry_token_ipfs_cid,

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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_quest_config",
      calldata: [quest_find_probability, quest_find_fail_probability],
    });
  }

  public async mint_test_realm(props: SystemProps.MintTestRealmProps) {
    const {
      token_id,
      signer,
      realms_address, // Should this be dynamically fetched from season config or passed to provider instead of prop?
    } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: realms_address.toString(),
      entrypoint: "mint",
      calldata: [uint256.bnToUint256(token_id)],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-production_systems`),
      entrypoint: "burn_resource_for_labor_production",
      calldata: [entity_id, resource_types.length, ...resource_types, resource_amounts.length, ...resource_amounts],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-production_systems`),
      entrypoint: "burn_labor_for_resource_production",
      calldata: [
        from_entity_id,
        production_cycles.length,
        ...production_cycles,
        produced_resource_types.length,
        ...produced_resource_types,
      ],
    });

    return await this.promiseQueue.enqueue(call);
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-production_systems`),
      entrypoint: "burn_resource_for_resource_production",
      calldata: [
        from_entity_id,
        produced_resource_types.length,
        ...produced_resource_types,
        production_cycles.length,
        ...production_cycles,
      ],
    });

    return await this.promiseQueue.enqueue(call);
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

    console.log("approval", approval);
    const calls = order_ids.map((order_id) => {
      return {
        contractAddress: props.marketplace_address.toString(),
        entrypoint: "accept",
        calldata: [order_id.toString()],
      };
    });
    console.log(calls);

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

    const call = this.createProviderCall(signer, {
      contractAddress: props.marketplace_address.toString(),
      entrypoint: "cancel",
      calldata: [order_id],
    });

    return await this.promiseQueue.enqueue(call);
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
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-quest_systems`),
        entrypoint: "add_game",
        calldata: quest_game,
      });
    }
  }

  public async start_quest(props: SystemProps.StartQuestProps) {
    const { quest_tile_id, explorer_id, player_name, to_address, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-quest_systems`),
      entrypoint: "start_quest",
      calldata: [quest_tile_id, explorer_id, player_name, to_address],
    });
  }

  public async claim_reward(props: SystemProps.ClaimRewardProps) {
    const { game_token_id, game_address, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-quest_systems`),
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-quest_systems`),
      entrypoint: "disable_quests",
      calldata: [],
    });
  }

  public async enable_quests(props: SystemProps.EnableQuestsProps) {
    const { signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-quest_systems`),
      entrypoint: "enable_quests",
      calldata: [],
    });
  }

  public async transfer_structure_ownership(props: SystemProps.TransferStructureOwnershipProps) {
    const { signer, structure_id, new_owner } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-ownership_systems`),
      entrypoint: "transfer_structure_ownership",
      calldata: [structure_id, new_owner],
    });
  }

  public async transfer_agent_ownership(props: SystemProps.TransferAgentOwnershipProps) {
    const { signer, explorer_id, new_owner } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-ownership_systems`),
      entrypoint: "transfer_agent_ownership",
      calldata: [explorer_id, new_owner],
    });
  }

  public async structure_burn(props: SystemProps.StructureBurnProps) {
    const { signer, structure_id, resources } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
      entrypoint: "troop_burn",
      calldata: [explorer_id, resources.length, ...resources.flatMap(({ resourceId, amount }) => [resourceId, amount])],
    });
  }

  public async open_chest(props: SystemProps.OpenChestProps) {
    const { signer, explorer_id, chest_coord } = props;
    const calls = [];
    if (this.VRF_PROVIDER_ADDRESS !== undefined && Number(this.VRF_PROVIDER_ADDRESS) !== 0) {
      const requestRandomCall: Call = {
        contractAddress: this.VRF_PROVIDER_ADDRESS!,
        entrypoint: "request_random",
        calldata: [getContractByName(this.manifest, `${NAMESPACE}-relic_systems`), 0, signer.address],
      };

      calls.push(requestRandomCall);
    }

    calls.push({
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-relic_systems`),
      entrypoint: "open_chest",
      calldata: [explorer_id, chest_coord.x, chest_coord.y],
    });
    return await this.promiseQueue.enqueue(this.createProviderCall(signer, calls));
  }

  public async apply_relic(props: SystemProps.ApplyRelicProps) {
    const { signer, entity_id, relic_resource_id, recipient_type } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-relic_systems`),
      entrypoint: "apply_relic",
      calldata: [entity_id, relic_resource_id, recipient_type],
    });
  }
}
