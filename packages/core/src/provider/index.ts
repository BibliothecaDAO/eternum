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
export const NAMESPACE = "s1_eternum";
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
    const tx = await this.execute(signer, transactionDetails, NAMESPACE, { version: 3 });
    const transactionResult = await this.waitForTransactionWithCheck(tx.transaction_hash);

    // Get the transaction type based on the entrypoint name
    let txType: TransactionType;
    const isMultipleTransactions = Array.isArray(transactionDetails);

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
    const { connected_realm, direction, signer } = props;

    let callData: Call[] = [];

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
      calldata: [connected_realm, direction],
    };

    const call = this.createProviderCall(signer, [...callData, createCall]);

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
    let { realm_ids, owner, frontend, signer, season_pass_address, realm_settlement } = props;

    const realmSystemsContractAddress = getContractByName(this.manifest, `${NAMESPACE}-realm_systems`);

    const approvalForAllCall = this.createProviderCall(signer, {
      contractAddress: season_pass_address,
      entrypoint: "set_approval_for_all",
      calldata: [realmSystemsContractAddress, true],
    });

    const createCalls = realm_ids.map((realm_id) =>
      this.createProviderCall(signer, {
        contractAddress: realmSystemsContractAddress,
        entrypoint: "create",
        calldata: [owner, realm_id, frontend, realm_settlement],
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
    const { token_id, realms_address, season_pass_address, realm_settlement, signer } = props;

    const mintRealmCall = {
      contractAddress: realms_address.toString(),
      entrypoint: "mint",
      calldata: [uint256.bnToUint256(token_id)],
    };

    const mintSeasonPassCall = {
      contractAddress: season_pass_address.toString(),
      entrypoint: "mint",
      calldata: [signer.address, uint256.bnToUint256(token_id)],
    };

    const realmSystemsContractAddress = getContractByName(this.manifest, `${NAMESPACE}-realm_systems`);

    const approvalForAllCall = {
      contractAddress: season_pass_address,
      entrypoint: "set_approval_for_all",
      calldata: [realmSystemsContractAddress, true],
    };

    const createRealmCall = {
      contractAddress: realmSystemsContractAddress,
      entrypoint: "create",
      calldata: [signer.address, token_id, signer.address, realm_settlement],
    };

    const approvalCloseForAllCall = {
      contractAddress: season_pass_address,
      entrypoint: "set_approval_for_all",
      calldata: [realmSystemsContractAddress, false],
    };

    return await this.executeAndCheckTransaction(signer, [
      mintRealmCall,
      mintSeasonPassCall,
      approvalForAllCall,
      createRealmCall,
      approvalCloseForAllCall,
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
  public async create_building(props: SystemProps.CreateBuildingProps) {
    const { entity_id, directions, building_category, signer } = props;

    // TOOODO: FIX
    let use_labor = false;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-production_systems`),
      entrypoint: "create_building",
      calldata: CallData.compile([entity_id, directions, building_category, use_labor]),
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
      calldata: [
        banks.length,
        ...banks.flatMap((bank) => [
          bank.name,
          bank.coord.x,
          bank.coord.y,
          bank.guard_slot,
          bank.troop_tier,
          bank.troop_type,
        ]),
      ],
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
    console.log({ props });

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

    return await this.promiseQueue.enqueue(call);
  }

  /**
   * Attack an explorer with another explorer
   *
   * @param props - Properties for explorer vs explorer attack
   * @param props.aggressor_id - ID of the attacking explorer
   * @param props.defender_id - ID of the defending explorer
   * @param props.defender_direction - Direction to the defender
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   */
  public async attack_explorer_vs_explorer(props: SystemProps.AttackExplorerVsExplorerProps) {
    const { aggressor_id, defender_id, defender_direction, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_battle_systems`),
      entrypoint: "attack_explorer_vs_explorer",
      calldata: [aggressor_id, defender_id, defender_direction],
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

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "transfer_guild_ownership",
      calldata: [guild_entity_id, to_player_address],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async remove_guild_member(props: SystemProps.RemoveGuildMember) {
    const { player_address_to_remove, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "remove_guild_member",
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
          entrypoint: "remove_guild_member",
          calldata: [call.address],
        };
      }),
    );

    return await this.promiseQueue.enqueue(call);
  }

  public async remove_player_from_whitelist(props: SystemProps.RemovePlayerFromWhitelist) {
    const { player_address_to_remove, guild_entity_id, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "remove_player_from_whitelist",
      calldata: [player_address_to_remove, guild_entity_id],
    });

    return await this.promiseQueue.enqueue(call);
  }

  public async set_starting_resources_config(props: SystemProps.SetStartingResourcesConfigProps) {
    const { startingResources, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_starting_resources_config",
      calldata: [startingResources.length, ...startingResources.flatMap(({ resource, amount }) => [resource, amount])],
    });
  }

  public async set_map_config(props: SystemProps.SetMapConfigProps) {
    const {
      reward_amount,
      shards_mines_win_probability,
      shards_mines_fail_probability,
      agent_find_probability,
      agent_find_fail_probability,
      hyps_win_prob,
      hyps_fail_prob,
      hyps_fail_prob_increase_p_hex,
      hyps_fail_prob_increase_p_fnd,
      mine_wheat_grant_amount,
      mine_fish_grant_amount,
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
        hyps_win_prob,
        hyps_fail_prob,
        hyps_fail_prob_increase_p_hex,
        hyps_fail_prob_increase_p_fnd,
        mine_wheat_grant_amount,
        mine_fish_grant_amount,
      ],
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
      season_pass_address,
      realms_address,
      lords_address,
      start_settling_at,
      start_main_at,
      end_grace_seconds,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_season_config",
      calldata: [
        season_pass_address,
        realms_address,
        lords_address,
        start_settling_at,
        start_main_at,
        end_grace_seconds,
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

  public async set_agent_controller(props: SystemProps.SetAgentControllerProps) {
    const { agent_controller, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_agent_controller",
      calldata: [agent_controller],
    });
  }

  public async set_capacity_config(props: SystemProps.SetCapacityConfigProps) {
    const { structure_capacity, troop_capacity, donkey_capacity, storehouse_boost_capacity, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_capacity_config",
      calldata: [structure_capacity, troop_capacity, donkey_capacity, storehouse_boost_capacity],
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
    const { tick_interval_in_seconds, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_tick_config",
      calldata: [tick_interval_in_seconds],
    });
  }

  public async set_production_config(props: SystemProps.SetProductionConfigProps) {
    const { signer, calls } = props;

    const productionCalldataArray = calls.map((call) => {
      return {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
        entrypoint: "set_production_config",
        calldata: [
          call.resource_type,
          call.realm_output_per_tick,
          call.village_output_per_tick,
          call.labor_burn_strategy.resource_rarity,
          call.labor_burn_strategy.wheat_burn_per_labor,
          call.labor_burn_strategy.fish_burn_per_labor,
          call.labor_burn_strategy.depreciation_percent_num,
          call.labor_burn_strategy.depreciation_percent_denom,
          call.predefined_resource_burn_cost.length,
          ...call.predefined_resource_burn_cost.flatMap(({ resource, amount }) => [resource, amount]),
        ],
      };
    });

    return await this.executeAndCheckTransaction(signer, productionCalldataArray);
  }

  public async set_bank_config(props: SystemProps.SetBankConfigProps) {
    const { lp_fee_num, lp_fee_denom, owner_fee_num, owner_fee_denom, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_bank_config",
      calldata: [lp_fee_num, lp_fee_denom, owner_fee_num, owner_fee_denom],
    });
  }

  public async set_resource_bridge_whitlelist_config(props: SystemProps.SetResourceBridgeWhitelistConfigProps) {
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
        stamina_config.stamina_attack_max,
        stamina_config.stamina_explore_wheat_cost,
        stamina_config.stamina_explore_fish_cost,
        stamina_config.stamina_explore_stamina_cost,
        stamina_config.stamina_travel_wheat_cost,
        stamina_config.stamina_travel_fish_cost,
        stamina_config.stamina_travel_stamina_cost,

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
    const { building_category, cost_of_building, population_cost, capacity_grant, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_building_category_config",
      calldata: [
        building_category,
        cost_of_building.length,
        ...cost_of_building.flatMap(({ resource, amount }) => [resource, amount]),
        population_cost,
        capacity_grant,
      ],
    });
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

  public async set_settlement_config(props: SystemProps.SetSettlementConfigProps) {
    const { center, base_distance, subsequent_distance, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_settlement_config",
      calldata: [center, base_distance, subsequent_distance],
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
  public async burn_other_resources_for_labor_production(props: SystemProps.BurnOtherResourcesForLaborProductionProps) {
    const { entity_id, resource_types, resource_amounts, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-production_systems`),
      entrypoint: "burn_other_resources_for_labor_production",
      calldata: [entity_id, resource_types.length, ...resource_types, resource_amounts.length, ...resource_amounts],
    });

    return await this.promiseQueue.enqueue(call);
  }

  /**
   * Burn labor resources to produce other resources
   *
   * @param props - Properties for burning labor for resources
   * @param props.from_entity_id - ID of the realm entity
   * @param props.labor_amounts - Array of labor amounts to burn
   * @param props.produced_resource_types - Array of resource types to produce
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Burn 200 labor to produce wood and stone
   * {
   *   from_entity_id: 123,
   *   labor_amounts: [100, 100],
   *   produced_resource_types: [1, 2], // wood and stone
   *   signer: account
   * }
   * ```
   */
  public async burn_labor_resources_for_other_production(props: SystemProps.BurnLaborResourcesForOtherProductionProps) {
    const { from_entity_id, labor_amounts, produced_resource_types, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-production_systems`),
      entrypoint: "burn_labor_resources_for_other_production",
      calldata: [
        from_entity_id,
        labor_amounts.length,
        ...labor_amounts,
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
   * @param props.production_tick_counts - Array of production tick counts
   * @param props.signer - Account executing the transaction
   * @returns Transaction receipt
   *
   * @example
   * ```typescript
   * // Burn predefined resources to produce gold for 2 ticks
   * {
   *   from_entity_id: 123,
   *   produced_resource_types: [5], // gold
   *   production_tick_counts: [2],
   *   signer: account
   * }
   * ```
   */
  public async burn_other_predefined_resources_for_resources(
    props: SystemProps.BurnOtherPredefinedResourcesForResourcesProps,
  ) {
    const { from_entity_id, produced_resource_types, production_tick_counts, signer } = props;

    const call = this.createProviderCall(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-production_systems`),
      entrypoint: "burn_other_predefined_resources_for_resources",
      calldata: [
        from_entity_id,
        produced_resource_types.length,
        ...produced_resource_types,
        production_tick_counts.length,
        ...production_tick_counts,
      ],
    });

    return await this.promiseQueue.enqueue(call);
  }
}
