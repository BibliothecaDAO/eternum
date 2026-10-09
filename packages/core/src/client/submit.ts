import {
  BlockTag,
  TransactionFinalityStatus,
  type AccountInterface,
  type AllowArray,
  type Call,
  type InvokeFunctionResponse,
  type ResourceBoundsBN,
  type UniversalDetails,
} from "starknet";

import type { Shard } from "./shard";

/** What a gameplay account needs of its shard: the chain it signs for and the one gas bound the shard takes. */
export type GameplayShard = Pick<Shard, "chainId" | "l2GasBound">;

type GameplaySubmitAccount = Pick<AccountInterface, "address" | "execute" | "getNonce" | "getTransactionStatus">;
type RawExecute = (calls: AllowArray<Call>, details?: UniversalDetails) => Promise<InvokeFunctionResponse>;

interface ConfiguredGameplaySubmit {
  shard: GameplayShard;
  execute: RawExecute;
}

interface ExecuteGameplayAccountTransactionOptions {
  account: GameplaySubmitAccount;
  calls: AllowArray<Call>;
  shard: GameplayShard;
  details?: UniversalDetails;
}

const configuredGameplaySubmits = new WeakMap<object, ConfiguredGameplaySubmit>();
/** Per account, the last send until its transaction is in a block: the next send waits on it. */
const sendsInFlight = new Map<string, Promise<void>>();
const RECEIPT_POLL_MS = 250;
/** Answered "not found" this many polls in a row (ten seconds), a sent transaction was dropped: its nonce is free. */
const DROPPED_AFTER_POLLS = 40;
const IN_BLOCK = new Set<string>([
  TransactionFinalityStatus.PRE_CONFIRMED,
  TransactionFinalityStatus.ACCEPTED_ON_L2,
  TransactionFinalityStatus.ACCEPTED_ON_L1,
]);

/**
 * Every send of this account, raw or through a game client, becomes an ordinary v3 invoke at the account's current
 * nonce with the shard's fixed bounds and tip 0: the shape the shard's endpoint takes and stamps.
 */
export function configureGameplayAccountSubmits<TAccount extends AccountInterface>(
  account: TAccount,
  shard: GameplayShard,
): TAccount {
  const configured = configuredGameplaySubmits.get(account);
  if (configured) {
    assertConfiguredChain(account.address, configured.shard.chainId, shard.chainId);
    return account;
  }

  configuredGameplaySubmits.set(account, { shard, execute: account.execute.bind(account) });
  account.execute = ((calls: AllowArray<Call>, details?: UniversalDetails) =>
    executeGameplayAccountTransaction({ account, calls, shard, details })) as AccountInterface["execute"];
  return account;
}

/**
 * One transaction in flight per account: the shard takes only the account's current nonce, so each send reads it
 * fresh, and the next send starts once this one is in a block (a reverted one used its nonce too) or failed to send.
 */
export function executeGameplayAccountTransaction({
  account,
  calls,
  shard,
  details,
}: ExecuteGameplayAccountTransactionOptions): Promise<InvokeFunctionResponse> {
  const configured = configuredGameplaySubmits.get(account);
  if (configured) assertConfiguredChain(account.address, configured.shard.chainId, shard.chainId);
  const execute = configured?.execute ?? account.execute.bind(account);

  const key = `${shard.chainId}:${BigInt(account.address)}`;
  const previous = sendsInFlight.get(key) ?? Promise.resolve();
  const sent = previous.then(() => sendAtCurrentNonce(account, execute, calls, shard, details));
  const settled = sent.then(
    ({ transaction_hash }) => untilInBlock(account, transaction_hash),
    () => undefined,
  );
  sendsInFlight.set(key, settled);
  void settled.then(() => {
    if (sendsInFlight.get(key) === settled) sendsInFlight.delete(key);
  });
  return sent;
}

/** The fee-free shard's bounds: l2 gas at its fixed amount, every price and the other resources zero. */
function playResourceBounds(l2GasBound: bigint): ResourceBoundsBN {
  return {
    l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l2_gas: { max_amount: l2GasBound, max_price_per_unit: 0n },
  };
}

function assertConfiguredChain(address: string, configuredChain: string, requestedChain: string): void {
  if (configuredChain !== requestedChain) {
    throw new Error(`Gameplay account ${address} is configured for ${configuredChain}, not ${requestedChain}`);
  }
}

async function sendAtCurrentNonce(
  account: GameplaySubmitAccount,
  execute: RawExecute,
  calls: AllowArray<Call>,
  shard: GameplayShard,
  details: UniversalDetails | undefined,
): Promise<InvokeFunctionResponse> {
  const nonce = await account.getNonce(BlockTag.PRE_CONFIRMED);
  return execute(calls, { ...details, nonce, tip: 0, resourceBounds: playResourceBounds(shard.l2GasBound) });
}

/**
 * Until the transaction is in a block (pre-confirmed or later, a revert included), where the account's nonce has moved
 * past it, or until the node has answered "not found" long enough that it was dropped. A read that fails keeps the
 * lock: releasing it behind an accepted transaction would sign the next action at the same nonce.
 */
async function untilInBlock(account: GameplaySubmitAccount, transactionHash: string): Promise<void> {
  let notFound = 0;
  while (true) {
    const status = await account.getTransactionStatus(transactionHash).then(
      (result: { finality_status?: string }) => result.finality_status,
      (error: unknown) => (isNotFound(error) ? null : undefined),
    );
    if (status !== undefined && status !== null && IN_BLOCK.has(status)) return;
    notFound = status === null ? notFound + 1 : 0;
    if (notFound >= DROPPED_AFTER_POLLS) return;
    await new Promise((resolve) => setTimeout(resolve, RECEIPT_POLL_MS));
  }
}

/** The node's own answer that it holds no such transaction (TXN_HASH_NOT_FOUND), not a read that failed. */
const isNotFound = (error: unknown): boolean =>
  /transaction hash not found|TXN_HASH_NOT_FOUND/i.test(error instanceof Error ? error.message : String(error));
