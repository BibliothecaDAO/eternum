/**
 * Provider class for interacting with the Eternum game contracts
 *
 * @param katana - The katana manifest containing contract addresses and ABIs
 * @param url - Optional RPC URL for the provider
 */
import { DojoCall, DojoProvider } from "@dojoengine/core";
import EventEmitter from "eventemitter3";
import { Account, AccountInterface, AllowArray, Call, CallData, uint256 } from "starknet";
import * as SystemProps from "../types/provider";
import { TransactionType } from "./types";
export const NAMESPACE = "s0_eternum";
export { TransactionType };

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
  private readonly BATCH_DELAY = 2000; // ms to wait for batching
  private readonly MAX_BATCH_SIZE = 3; // Maximum number of calls to batch together

  constructor(private provider: EternumProvider) {}

  async enqueue<T>(providerCall: () => Promise<T>, batchId?: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ providerCall, resolve, reject, batchId });

      // Only set timeout if we're not already processing
      if (!this.processing) {
        if (this.batchTimeout) {
          clearTimeout(this.batchTimeout);
        }

        this.batchTimeout = setTimeout(() => {
          this.processQueue();
        }, this.BATCH_DELAY);
      }
    });
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
              try {
                const result = await providerCall();
                resolve(result);
              } catch (error) {
                reject(error);
              }
            } else {
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
  }

  /**
   * Execute a transaction and check its result
   *
   * @param signer - Account that will sign the transaction
   * @param transactionDetails - Transaction call data
   * @returns Transaction receipt
   */
  async executeAndCheckTransaction(signer: Account | AccountInterface, transactionDetails: AllowArray<Call>) {
    if (typeof window !== "undefined") {
      console.log({ signer, transactionDetails });
    }
    const tx = await this.execute(signer, transactionDetails, NAMESPACE);
    const transactionResult = await this.waitForTransactionWithCheck(tx.transaction_hash);

    // Get the transaction type based on the entrypoint name
    let txType: TransactionType;
    const isMultipleTransactions = Array.isArray(transactionDetails);

    if (isMultipleTransactions) {
      // For multiple calls, use the first call's entrypoint
      console.log({ entrypoint: transactionDetails[0].entrypoint });
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

    this.emit("transactionComplete", {
      details: transactionResult,
      type: txType,
      ...(isMultipleTransactions && { transactionCount: transactionDetails.length }),
    });

    return transactionResult;
  }

  async callAndReturnResult(signer: Account | AccountInterface, transactionDetails: DojoCall | Call) {
    if (typeof window !== "undefined") {
      console.log({ signer, transactionDetails });
    }
    const tx = await this.call(NAMESPACE, transactionDetails);
    return tx;
  }

  /**
   * Wait for a transaction to complete and check for errors
   *
   * @param transactionHash - Hash of transaction to wait for
   * @returns Transaction receipt
   * @throws Error if transaction fails or is reverted
   */
  async waitForTransactionWithCheck(transactionHash: string) {
    let receipt;
    try {
      receipt = await this.provider.waitForTransaction(transactionHash, {
        retryInterval: 500,
      });
    } catch (error) {
      console.error(`Error waiting for transaction ${transactionHash}`);
      throw error;
    }

    // Check if the transaction was reverted and throw an error if it was
    if (receipt.isReverted()) {
      this.emit("transactionFailed", `Transaction failed with reason: ${receipt.revert_reason}`);
      throw new Error(`Transaction failed with reason: ${receipt.revert_reason}`);
    }

    return receipt;
  }

  public async bridge_start_withdraw_from_realm(props: SystemProps.BridgeStartWithdrawFromRealmProps) {
    const { resources, through_bank_id, from_realm_entity_id, signer } = props;

    const calls = resources.map((resource) => ({
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_bridge_systems`),
      entrypoint: "start_withdraw",
      calldata: [through_bank_id, from_realm_entity_id, resource.tokenAddress, resource.amount],
    }));
    return await this.executeAndCheckTransaction(signer, calls);
  }

  public async bridge_finish_withdraw_from_realm(props: SystemProps.BridgeFinishWithdrawFromRealmProps) {
    const { donkey_resources, through_bank_id, recipient_address, client_fee_recipient, signer } = props;

    const calls = donkey_resources.map((donkey_resource) => ({
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_bridge_systems`),
      entrypoint: "finish_withdraw",
      calldata: [
        through_bank_id,
        donkey_resource.from_entity_id,
        donkey_resource.tokenAddress,
        recipient_address,
        client_fee_recipient,
      ],
    }));

    return await this.executeAndCheckTransaction(signer, calls);
  }

  public async bridge_resources_into_realm(props: SystemProps.BridgeResourcesIntoRealmProps) {
    const { resources, through_bank_id, recipient_realm_entity_id, client_fee_recipient, signer } = props;
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
        through_bank_id,
        recipient_realm_entity_id,
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
   *   contractAddress: "<s0_eternum-trade_systems>",
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
    const { maker_id, maker_gives_resources, taker_id, taker_gives_resources, signer, expires_at } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-trade_systems`),
      entrypoint: "create_order",
      calldata: [
        maker_id,
        maker_gives_resources.length / 2,
        ...maker_gives_resources,
        taker_id,
        taker_gives_resources.length / 2,
        ...taker_gives_resources,
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
   *   contractAddress: "<s0_eternum-trade_systems>",
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
    const { taker_id, trade_id, maker_gives_resources, taker_gives_resources, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-trade_systems`),
      entrypoint: "accept_order",
      calldata: [
        taker_id,
        trade_id,
        maker_gives_resources.length / 2,
        ...maker_gives_resources,
        taker_gives_resources.length / 2,
        ...taker_gives_resources,
      ],
    });

    return await this.promiseQueue.enqueue(call);
  }

  /**
   * Accept part of a trade order
   *
   * @param props - Properties for accepting the partial order
   * @param props.taker_id - ID of the realm accepting the trade
   * @param props.trade_id - ID of the trade being accepted
   * @param props.maker_gives_resources - Resources the maker is offering
   * @param props.taker_gives_resources - Resources requested from the taker
   * @param props.taker_gives_actual_amount - Actual amount taker will give
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * {
   *   contractAddress: "<s0_eternum-trade_systems>",
   *   entrypoint: "accept_partial_order",
   *   calldata: [
   *     123, // taker_id
   *     789, // trade_id
   *     1,   // maker_gives_resources.length / 2 (1 resource type)
   *     1,   // resource type (wood)
   *     100, // amount
   *     1,   // taker_gives_resources.length / 2 (1 resource type)
   *     2,   // resource type (stone)
   *     50,  // amount
   *     25   // taker_gives_actual_amount
   *   ]
   * }
   * ```
   */
  public async accept_partial_order(props: SystemProps.AcceptPartialOrderProps) {
    const { taker_id, trade_id, maker_gives_resources, taker_gives_resources, taker_gives_actual_amount, signer } =
      props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-trade_systems`),
      entrypoint: "accept_partial_order",
      calldata: [
        taker_id,
        trade_id,
        maker_gives_resources.length / 2,
        ...maker_gives_resources,
        taker_gives_resources.length / 2,
        ...taker_gives_resources,
        taker_gives_actual_amount,
      ],
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
   *   contractAddress: "<s0_eternum-trade_systems>",
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
    const { trade_id, return_resources, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-trade_systems`),
      entrypoint: "cancel_order",
      calldata: [trade_id, return_resources.length / 2, ...return_resources],
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
   * Claim completed quests
   *
   * @param props - Properties for claiming quests
   * @param props.receiver_id - ID of realm claiming rewards
   * @param props.quest_ids - IDs of quests to claim
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Claim rewards for quests 1 and 2
   * {
   *   receiver_id: 123,
   *   quest_ids: [1, 2],
   *   signer: account
   * }
   * ```
   */
  public async claim_quest(props: SystemProps.ClaimQuestProps) {
    const { receiver_id, quest_ids, signer } = props;

    const calldata = [
      ...quest_ids.map((questId) => ({
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-realm_systems`),
        entrypoint: "quest_claim",
        calldata: [questId, receiver_id],
      })),
    ];

    return await this.executeAndCheckTransaction(signer, calldata);
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-realm_systems`),
      entrypoint: "upgrade_level",
      calldata: [realm_entity_id],
    });

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
  public async create_multiple_realms_dev(props: SystemProps.CreateMultipleRealmsDevProps) {
    let { realm_ids, signer } = props;

    let calldata = realm_ids.flatMap((realm_id) => {
      let calldata = [
        {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-dev_realm_systems`),
          entrypoint: "create",
          calldata: [realm_id, "0x46f957b7fe3335010607174edd5c4c3fae87b12c3760dc167ac738959d8c03b"],
        },
      ];
      return calldata;
    });

    return await this.executeAndCheckTransaction(signer, calldata);
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
    let { realm_ids, owner, frontend, signer, season_pass_address } = props;

    const realmSystemsContractAddress = getContractByName(this.manifest, `${NAMESPACE}-realm_systems`);

    const approvalForAllCall = {
      contractAddress: season_pass_address,
      entrypoint: "set_approval_for_all",
      calldata: [realmSystemsContractAddress, true],
    };

    const createCalls = realm_ids.map((realm_id) => ({
      contractAddress: realmSystemsContractAddress,
      entrypoint: "create",
      calldata: [owner, realm_id, frontend],
    }));

    const approvalCloseForAllCall = {
      contractAddress: season_pass_address,
      entrypoint: "set_approval_for_all",
      calldata: [realmSystemsContractAddress, false],
    };

    return await this.executeAndCheckTransaction(signer, [approvalForAllCall, ...createCalls, approvalCloseForAllCall]);
  }

  /**
   * Transfer resources between entities
   *
   * @param props - Properties for transferring resources
   * @param props.sending_entity_id - ID of the entity sending resources
   * @param props.receiving_entity_id - ID of the entity receiving resources
   * @param props.resources - Array of resource amounts to transfer
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Transfer 100 wood and 50 stone from entity 123 to entity 456
   * {
   *   sending_entity_id: 123,
   *   receiving_entity_id: 456,
   *   resources: [1, 100, 2, 50], // [resourceId, amount, resourceId, amount]
   *   signer: account
   * }
   * ```
   */
  public async transfer_resources(props: SystemProps.TransferResourcesProps) {
    const { sending_entity_id, receiving_entity_id, resources, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
      entrypoint: "transfer",
      calldata: [sending_entity_id, receiving_entity_id, resources.length / 2, ...resources],
    });

    return await this.promiseQueue.enqueue(call);
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
      calldata: [sender_entity_id, recipient_entity_id, resources.length / 2, ...resources],
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
      calldata: [owner_entity_id, recipient_entity_id, resources.length / 2, ...resources],
    };

    const pickupCall = {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
      entrypoint: "pickup",
      calldata: [recipient_entity_id, owner_entity_id, resources.length / 2, ...resources],
    };

    const call = this.createProviderCall(signer, [approvalCall, pickupCall]);

    return await this.promiseQueue.enqueue(call);
  }

  /**
   * Move an entity in a hex direction
   *
   * @param props - Properties for hex traveling
   * @param props.travelling_entity_id - ID of the entity that is traveling
   * @param props.directions - Array of hex directions to travel
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Move entity 123 in hex directions [1, 2, 3]
   * {
   *   travelling_entity_id: 123,
   *   directions: [1, 2, 3],
   *   signer: account
   * }
   * ```
   */
  public async travel_hex(props: SystemProps.TravelHexProps) {
    const { travelling_entity_id, directions, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-travel_systems`),
      entrypoint: "travel_hex",
      calldata: [travelling_entity_id, directions],
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

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-name_systems`),
      entrypoint: "set_address_name",
      calldata: [name],
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
   * Explore in a direction from a unit's position
   *
   * @param props - Properties for exploring
   * @param props.unit_id - ID of the unit doing the exploration
   * @param props.direction - Direction to explore in
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Explore in direction 1 with unit 123
   * {
   *   unit_id: 123,
   *   direction: 1,
   *   signer: account
   * }
   * ```
   */
  public async explore(props: SystemProps.ExploreProps) {
    const { unit_id, direction, signer } = props;

    const requestTwoCall: Call = {
      contractAddress: this.VRF_PROVIDER_ADDRESS!,
      entrypoint: "request_random",
      calldata: [getContractByName(this.manifest, `${NAMESPACE}-map_systems`), 0, signer.address],
    };

    const requestRandomCall: Call = {
      contractAddress: this.VRF_PROVIDER_ADDRESS!,
      entrypoint: "request_random",
      calldata: [getContractByName(this.manifest, `${NAMESPACE}-map_generation_systems`), 0, signer.address],
    };

    const exploreCall: Call = {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-map_systems`),
      entrypoint: "explore",
      calldata: [unit_id, direction],
    };

    const call = this.createProviderCall(signer, [requestTwoCall, requestRandomCall, exploreCall]);

    return await this.promiseQueue.enqueue(call);
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
   *   contractAddress: "<s0_eternum-building_systems>",
   *   entrypoint: "create",
   *   calldata: [
   *     123,     // entity_id
   *     [1, 2],  // directions array
   *     1,       // building_category (e.g. 1 for resource production)
   *     1        // produce_resource_type (e.g. 1 for wood) for farms and fishing villages use 0
   *   ]
   * }
   * ```
   */
  public async create_building(props: SystemProps.CreateBuildingProps) {
    const { entity_id, directions, building_category, produce_resource_type, signer } = props;
    ["62", "1", "0", "4", "1"];

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-building_systems`),
      entrypoint: "create",
      calldata: CallData.compile([entity_id, directions, building_category, produce_resource_type]),
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
   *   contractAddress: "<s0_eternum-building_systems>",
   *   entrypoint: "destroy",
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-building_systems`),
      entrypoint: "destroy",
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-building_systems`),
      entrypoint: "pause_production",
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-building_systems`),
      entrypoint: "resume_production",
      calldata: [entity_id, building_coord.x, building_coord.y],
    });

    return await this.promiseQueue.enqueue(call);
  }

  /**
   * Create a new bank
   *
   * @param props - Properties for creating a bank
   * @param props.realm_entity_id - ID of the realm entity creating the bank
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
   * // Create a bank with 1% fees
   * {
   *   realm_entity_id: 123,
   *   coord: 456,
   *   owner_fee_num: 1,
   *   owner_fee_denom: 100,
   *   owner_bridge_fee_dpt_percent: 100,
   *   owner_bridge_fee_wtdr_percent: 100,
   *   signer: account
   * }
   * ```
   */
  public async create_bank(props: SystemProps.CreateBankProps) {
    const {
      realm_entity_id,
      coord,
      owner_fee_num,
      owner_fee_denom,
      owner_bridge_fee_dpt_percent,
      owner_bridge_fee_wtdr_percent,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-bank_systems`),
      entrypoint: "create_bank",
      calldata: [
        realm_entity_id,
        coord,
        owner_fee_num,
        owner_fee_denom,
        owner_bridge_fee_dpt_percent,
        owner_bridge_fee_wtdr_percent,
      ],
    });
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
  public async create_admin_bank(props: SystemProps.CreateAdminBankProps) {
    const {
      name,
      coord,
      owner_fee_num,
      owner_fee_denom,
      owner_bridge_fee_dpt_percent,
      owner_bridge_fee_wtdr_percent,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-dev_bank_systems`),
      entrypoint: "create_admin_bank",
      calldata: [
        name,
        coord,
        owner_fee_num,
        owner_fee_denom,
        owner_bridge_fee_dpt_percent,
        owner_bridge_fee_wtdr_percent,
      ],
    });
  }

  /**
   * Open a new bank account
   *
   * @param props - Properties for opening an account
   * @param props.realm_entity_id - ID of the realm entity opening the account
   * @param props.bank_entity_id - ID of the bank where account will be opened
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Open account at bank 456 for realm 123
   * {
   *   realm_entity_id: 123,
   *   bank_entity_id: 456,
   *   signer: account
   * }
   * ```
   */
  public async open_account(props: SystemProps.OpenAccountProps) {
    const { realm_entity_id, bank_entity_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-bank_systems`),
      entrypoint: "open_account",
      calldata: [realm_entity_id, bank_entity_id],
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
      calls.map((call) => ({
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-liquidity_systems`),
        entrypoint: "add",
        calldata: [bank_entity_id, entity_id, call.resource_type, call.resource_amount, call.lords_amount],
      })),
    );
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

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-liquidity_systems`),
      entrypoint: "remove",
      calldata: [bank_entity_id, entity_id, resource_type, shares, false],
    });
  }

  /**
   * Create a new army
   *
   * @param props - Properties for creating an army
   * @param props.army_owner_id - ID of the entity that will own the army
   * @param props.is_defensive_army - Whether this is a defensive army
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Create a defensive army for entity 123
   * {
   *   army_owner_id: 123,
   *   is_defensive_army: true,
   *   signer: account
   * }
   * ```
   */
  public async create_army(props: SystemProps.ArmyCreateProps) {
    const { army_owner_id, is_defensive_army, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_systems`),
      entrypoint: "army_create",
      calldata: [army_owner_id, is_defensive_army],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async delete_army(props: SystemProps.ArmyDeleteProps) {
    const { army_id, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_systems`),
      entrypoint: "army_delete",
      calldata: [army_id],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async army_buy_troops(props: SystemProps.ArmyBuyTroopsProps) {
    const { army_id, payer_id, troops, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_systems`),
      entrypoint: "army_buy_troops",
      calldata: [army_id, payer_id, troops.knight_count, troops.paladin_count, troops.crossbowman_count],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async army_merge_troops(props: SystemProps.ArmyMergeTroopsProps) {
    const { from_army_id, to_army_id, troops, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_systems`),
      entrypoint: "army_merge_troops",
      calldata: [from_army_id, to_army_id, troops],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async battle_start(props: SystemProps.BattleStartProps) {
    const { attacking_army_id, defending_army_id, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
      entrypoint: "battle_start",
      calldata: [attacking_army_id, defending_army_id],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async battle_resolve(props: SystemProps.BattleResolveProps) {
    const { battle_id, army_id, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
      entrypoint: "battle_resolve",
      calldata: [battle_id, army_id],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async battle_force_start(props: SystemProps.BattleForceStartProps) {
    const { battle_id, defending_army_id, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
      entrypoint: "battle_force_start",
      calldata: [battle_id, defending_army_id],
    });

    return await this.promiseQueue.enqueue(call);
  }
  public async battle_join(props: SystemProps.BattleJoinProps) {
    const { battle_id, battle_side, army_id, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
      entrypoint: "battle_join",
      calldata: [battle_id, battle_side, army_id],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async battle_leave(props: SystemProps.BattleLeaveProps) {
    const { battle_id, army_ids, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      army_ids.map((army_id) => ({
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
        entrypoint: "battle_leave",
        calldata: [battle_id, army_id],
      })),
    );
  }

  public async battle_pillage(props: SystemProps.BattlePillageProps) {
    const { army_id, structure_id, signer } = props;

    const calls = await buildVrfCalls({
      account: signer,
      call: {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_pillage_systems`),
        entrypoint: "battle_pillage",
        calldata: [army_id, structure_id],
      },
      vrfProviderAddress: this.VRF_PROVIDER_ADDRESS,
      addressToCall: getContractByName(this.manifest, `${NAMESPACE}-battle_pillage_systems`),
    });

    return await this.executeAndCheckTransaction(signer, calls);
  }

  public async battle_claim(props: SystemProps.BattleClaimProps) {
    const { army_id, structure_id, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
      entrypoint: "battle_claim",
      calldata: [army_id, structure_id],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async battle_claim_and_leave(props: SystemProps.BattleClaimAndLeaveProps) {
    const { army_id, structure_id, battle_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, [
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
        entrypoint: "battle_leave",
        calldata: [battle_id, army_id],
      },
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
        entrypoint: "battle_claim",
        calldata: [army_id, structure_id],
      },
    ]);
  }

  public async battle_leave_and_pillage(props: SystemProps.BattleLeaveAndRaidProps) {
    const { army_id, structure_id, battle_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, [
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
        entrypoint: "battle_leave",
        calldata: [battle_id, army_id],
      },
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_pillage_systems`),
        entrypoint: "battle_pillage",
        calldata: [army_id, structure_id],
      },
    ]);
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

  public async whitelist_player(props: SystemProps.WhitelistPlayerProps) {
    const { player_address_to_whitelist, guild_entity_id, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "whitelist_player",
      calldata: [player_address_to_whitelist, guild_entity_id],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async transfer_guild_ownership(props: SystemProps.TransferGuildOwnership) {
    const { guild_entity_id, to_player_address, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "transfer_guild_ownership",
      calldata: [guild_entity_id, to_player_address],
    });
  }

  public async remove_guild_member(props: SystemProps.RemoveGuildMember) {
    const { player_address_to_remove, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "remove_guild_member",
      calldata: [player_address_to_remove],
    });
  }

  public async disband_guild(props: SystemProps.DisbandGuild) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
          entrypoint: "remove_guild_member",
          calldata: [call.address],
        };
      }),
    );
  }

  public async remove_player_from_whitelist(props: SystemProps.RemovePlayerFromWhitelist) {
    const { player_address_to_remove, guild_entity_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "remove_player_from_whitelist",
      calldata: [player_address_to_remove, guild_entity_id],
    });
  }

  public async set_quest_config(props: SystemProps.SetQuestConfigProps) {
    const { production_material_multiplier, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_quest_config",
      calldata: [production_material_multiplier],
    });
  }

  public async set_quest_reward_config(props: SystemProps.SetQuestRewardConfigProps) {
    const { calls, signer } = props;
    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
          entrypoint: "set_quest_reward_config",
          calldata: [
            call.quest_id,
            call.resources.length,
            ...call.resources.flatMap(({ resource, amount }) => [resource, amount]),
          ],
        };
      }),
    );
  }

  public async set_map_config(props: SystemProps.SetMapConfigProps) {
    const { config_id, reward_amount, shards_mines_fail_probability, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_map_config",
      calldata: [config_id, reward_amount, shards_mines_fail_probability],
    });
  }

  public async set_travel_stamina_cost_config(props: SystemProps.SetTravelStaminaCostConfigProps) {
    const { travel_type, cost, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_travel_stamina_cost_config",
      calldata: [travel_type, cost],
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
    const { season_pass_address, realms_address, lords_address, start_at, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_season_config",
      calldata: [season_pass_address, realms_address, lords_address, start_at],
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

  public async set_season_bridge_config(props: SystemProps.SetSeasonBridgeConfigProps) {
    const { close_after_end_seconds, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_season_bridge_config",
      calldata: [close_after_end_seconds],
    });
  }

  public async set_resource_bridge_whitlelist_config(props: SystemProps.SetResourceBridgeWhitelistConfigProps) {
    const { token, resource_type, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_resource_bridge_whitelist_config",
      calldata: [token, resource_type],
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
      velords_fee_recipient,
      season_pool_fee_recipient,
      max_bank_fee_dpt_percent,
      max_bank_fee_wtdr_percent,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_resource_bridge_fee_split_config",
      calldata: [
        0, // config id
        velords_fee_on_dpt_percent,
        velords_fee_on_wtdr_percent,
        season_pool_fee_on_dpt_percent,
        season_pool_fee_on_wtdr_percent,
        client_fee_on_dpt_percent,
        client_fee_on_wtdr_percent,
        velords_fee_recipient,
        season_pool_fee_recipient,
        max_bank_fee_dpt_percent,
        max_bank_fee_wtdr_percent,
      ],
    });
  }
  public async set_capacity_config(props: SystemProps.SetCapacityConfigProps) {
    const { category, weight_gram, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_capacity_config",
      calldata: [category, weight_gram],
    });
  }

  public async set_speed_config(props: SystemProps.SetSpeedConfigProps) {
    const { entity_type, sec_per_km, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_speed_config",
      calldata: [entity_type, sec_per_km],
    });
  }

  public async set_weight_config(props: SystemProps.SetWeightConfigProps) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
          entrypoint: "set_weight_config",
          calldata: [call.entity_type, call.weight_gram],
        };
      }),
    );
  }

  public async set_tick_config(props: SystemProps.SetTickConfigProps) {
    const { tick_id, tick_interval_in_seconds, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_tick_config",
      calldata: [tick_id, tick_interval_in_seconds],
    });
  }

  public async set_production_config(props: SystemProps.SetProductionConfigProps) {
    const { signer, calls } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
          entrypoint: "set_production_config",
          calldata: [
            call.resource_type,
            call.amount,
            call.cost.length,
            ...call.cost.flatMap(({ resource, amount }) => [resource, amount]),
          ],
        };
      }),
    );
  }

  public async set_bank_config(props: SystemProps.SetBankConfigProps) {
    const { lords_cost, lp_fee_num, lp_fee_denom, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_bank_config",
      calldata: [lords_cost, lp_fee_num, lp_fee_denom],
    });
  }

  public async set_troop_config(props: SystemProps.SetTroopConfigProps) {
    const {
      signer,
      config_id,
      health,
      knight_strength,
      paladin_strength,
      crossbowman_strength,
      advantage_percent,
      disadvantage_percent,
      max_troop_count,
      pillage_health_divisor,
      army_free_per_structure,
      army_extra_per_military_building,
      army_max_per_structure,
      battle_leave_slash_num,
      battle_leave_slash_denom,
      battle_time_scale,
      battle_max_time_seconds,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_troop_config",
      calldata: [
        config_id,
        health,
        knight_strength,
        paladin_strength,
        crossbowman_strength,
        advantage_percent,
        disadvantage_percent,
        max_troop_count,
        pillage_health_divisor,
        army_free_per_structure,
        army_extra_per_military_building,
        army_max_per_structure,
        battle_leave_slash_num,
        battle_leave_slash_denom,
        battle_time_scale,
        battle_max_time_seconds,
      ],
    });
  }

  public async set_battle_config(props: SystemProps.SetBattleConfigProps) {
    const { signer, config_id, regular_immunity_ticks, hyperstructure_immunity_ticks, battle_delay_seconds } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_battle_config",
      calldata: [config_id, regular_immunity_ticks, hyperstructure_immunity_ticks, battle_delay_seconds],
    });
  }

  public async set_building_category_pop_config(props: SystemProps.SetBuildingCategoryPopConfigProps) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
          entrypoint: "set_building_category_pop_config",
          calldata: [call.building_category, call.population, call.capacity],
        };
      }),
    );
  }

  public async set_building_general_config(props: SystemProps.SetBuildingGeneralConfigProps) {
    const { base_cost_percent_increase, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_building_general_config",
      calldata: [base_cost_percent_increase],
    });
  }

  public async set_population_config(props: SystemProps.SetPopulationConfigProps) {
    const { base_population, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_population_config",
      calldata: [base_population],
    });
  }

  public async set_realm_level_config(props: SystemProps.setRealmUpgradeConfigProps) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
          entrypoint: "set_realm_level_config",
          calldata: [
            call.level,
            call.cost_of_level.length,
            ...call.cost_of_level.flatMap(({ resource, amount }) => [resource, amount]),
          ],
        };
      }),
    );
  }

  public async set_realm_max_level_config(props: SystemProps.SetRealmMaxLevelConfigProps) {
    const { new_max_level, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_realm_max_level_config",
      calldata: [new_max_level],
    });
  }

  public async set_building_config(props: SystemProps.SetBuildingConfigProps) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
          entrypoint: "set_building_config",
          calldata: [
            call.building_category,
            call.building_resource_type,
            call.cost_of_building.length,
            ...call.cost_of_building.flatMap(({ resource, amount }) => [resource, amount]),
          ],
        };
      }),
    );
  }

  public async set_hyperstructure_config(props: SystemProps.SetHyperstructureConfig) {
    const {
      resources_for_completion,
      time_between_shares_change,
      points_per_cycle,
      points_for_win,
      points_on_completion,
      signer,
    } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_hyperstructure_config",
      calldata: [
        resources_for_completion,
        time_between_shares_change,
        points_per_cycle,
        points_for_win,
        points_on_completion,
      ],
    });
  }

  public async create_hyperstructure(props: SystemProps.CreateHyperstructureProps) {
    const { creator_entity_id, coords, signer } = props;

    const vrfCalls = await buildVrfCalls({
      account: signer,
      call: {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
        entrypoint: "create",
        calldata: [creator_entity_id, coords.x, coords.y],
      },
      vrfProviderAddress: this.VRF_PROVIDER_ADDRESS,
      addressToCall: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
    });

    const call = this.createProviderCall(signer, vrfCalls);

    return await this.promiseQueue.enqueue(call);
  }

  public async contribute_to_construction(props: SystemProps.ContributeToConstructionProps) {
    const { hyperstructure_entity_id, contributor_entity_id, contributions, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "contribute_to_construction",
      calldata: [hyperstructure_entity_id, contributor_entity_id, contributions],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async set_access(props: SystemProps.SetAccessProps) {
    const { hyperstructure_entity_id, access, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "set_access",
      calldata: [hyperstructure_entity_id, access],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async end_game(props: SystemProps.EndGameProps) {
    const { signer, hyperstructure_contributed_to, hyperstructure_shareholder_epochs } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "end_game",
      calldata: [hyperstructure_contributed_to, hyperstructure_shareholder_epochs],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async register_to_leaderboard(props: SystemProps.RegisterToLeaderboardProps) {
    const { signer, hyperstructure_contributed_to, hyperstructure_shareholder_epochs } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-season_systems`),
      entrypoint: "register_to_leaderboard",
      calldata: [hyperstructure_contributed_to, hyperstructure_shareholder_epochs],
    });
  }

  public async claim_leaderboard_rewards(props: SystemProps.ClaimLeaderboardRewardsProps) {
    const { signer, token } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-season_systems`),
      entrypoint: "claim_leaderboard_rewards",
      calldata: [token],
    });
  }

  public async set_co_owners(props: SystemProps.SetCoOwnersProps) {
    const { hyperstructure_entity_id, co_owners, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "set_co_owners",
      calldata: [hyperstructure_entity_id, co_owners],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async get_points(props: SystemProps.GetPointsProps) {
    const { player_address, hyperstructure_contributed_to, hyperstructure_shareholder_epochs, signer } = props;

    const call = await this.callAndReturnResult(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "get_points",
      calldata: [player_address, hyperstructure_contributed_to, hyperstructure_shareholder_epochs],
    });

    return call;
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

  public async set_mercenaries_config(props: SystemProps.SetMercenariesConfigProps) {
    const {
      knights_lower_bound,
      knights_upper_bound,
      paladins_lower_bound,
      paladins_upper_bound,
      crossbowmen_lower_bound,
      crossbowmen_upper_bound,
      rewards,
      signer,
    } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_mercenaries_config",
      calldata: [
        knights_lower_bound,
        knights_upper_bound,
        paladins_lower_bound,
        paladins_upper_bound,
        crossbowmen_lower_bound,
        crossbowmen_upper_bound,
        rewards,
      ],
    });
  }

  public async set_settlement_config(props: SystemProps.SetSettlementConfigProps) {
    const {
      center,
      base_distance,
      min_first_layer_distance,
      points_placed,
      current_layer,
      current_side,
      current_point_on_side,
      signer,
    } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_settlement_config",
      calldata: [
        center,
        base_distance,
        min_first_layer_distance,
        points_placed,
        current_layer,
        current_side,
        current_point_on_side,
      ],
    });
  }

  public async mint_test_realm(props: SystemProps.MintTestRealmProps) {
    const {
      token_id,
      signer,
      realms_address, // Should this be dynamically fetched from season config or passed to provider instead of prop?
    } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: realms_address.toString(),
      entrypoint: "mint",
      calldata: [uint256.bnToUint256(token_id)],
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
}
