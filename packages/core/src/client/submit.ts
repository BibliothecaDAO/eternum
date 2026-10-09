import {
  BlockTag,
  EDAMode,
  EDataAvailabilityMode,
  hash,
  transaction,
  TransactionFinalityStatus,
  type AccountInterface,
  type AllowArray,
  type Call,
  type InvokeFunctionResponse,
  type ResourceBoundsBN,
  type UniversalDetails,
  type InvocationsSignerDetails,
} from "starknet";

import { TransactionNotSentError } from "@bibliothecadao/provider";

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
/** Per account, the last send until it settles (in a block, or proven not sent): the next send waits on it. */
const sendsInFlight = new Map<string, Promise<void>>();
const STATUS_POLL_MS = 250;
/** Three blocks at the shard's 2 s block time: any invoke the node took shows by then, and a lost one frees the queue. */
const NOT_SEEN_LIMIT_MS = 6_000;
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
 * fresh and resolves once its transaction is in a block (a reverted one used its nonce too), or rejects with
 * TransactionNotSentError once the nonce proves it never will be. The next send starts when this one settles either
 * way, so an action whose fate is unknown never holds the account's queue.
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
  const sent = previous.then(() => sendUntilInBlock(account, execute, calls, shard, details));
  const settled = sent.then(
    () => undefined,
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

/** Signs and sends at the current nonce, then holds until the transaction is in a block or proven not sent. */
async function sendUntilInBlock(
  account: GameplaySubmitAccount,
  execute: RawExecute,
  calls: AllowArray<Call>,
  shard: GameplayShard,
  details: UniversalDetails | undefined,
): Promise<InvokeFunctionResponse> {
  const nonce = await account.getNonce(BlockTag.PRE_CONFIRMED);
  const frame = playFrame(nonce, shard, details);
  const expectedHash = ordinaryHash(account.address, calls, shard, frame);
  const transactionHash = await execute(calls, frame).then(
    (response) => response.transaction_hash,
    (error: unknown) => {
      if (isPolicyRefusal(error)) throw error;
      if (isStampingRefusal(error)) throw new TransactionNotSentError(expectedHash, "refused");
      // A lost response or opaque node error may follow acceptance: the nonce decides, never a resend.
      return expectedHash;
    },
  );
  await untilInBlock(account, BigInt(nonce), transactionHash);
  return { transaction_hash: transactionHash };
}

/** An ordinary v3 invoke at this nonce with the shard's fixed bounds and tip 0. */
function playFrame(nonce: string, shard: GameplayShard, details: UniversalDetails | undefined) {
  return {
    ...details,
    nonce,
    version: "0x3" as const,
    tip: 0,
    resourceBounds: playResourceBounds(shard.l2GasBound),
    paymasterData: [],
    accountDeploymentData: [],
    nonceDataAvailabilityMode: EDataAvailabilityMode.L1,
    feeDataAvailabilityMode: EDataAvailabilityMode.L1,
  };
}

/** The hash the node gives this invoke: the stamp extends only the signature, which the hash does not cover. */
function ordinaryHash(
  senderAddress: string,
  calls: AllowArray<Call>,
  shard: GameplayShard,
  frame: ReturnType<typeof playFrame>,
): string {
  return hash.calculateInvokeTransactionHash({
    ...frame,
    senderAddress,
    compiledCalldata: transaction.getExecuteCalldata(Array.isArray(calls) ? calls : [calls], "1"),
    chainId: shard.chainId as InvocationsSignerDetails["chainId"],
    nonceDataAvailabilityMode: EDAMode.L1,
    feeDataAvailabilityMode: EDAMode.L1,
  });
}

function errorCode(error: unknown): number | undefined {
  const candidate = error as { code?: number; baseError?: { code?: number } } | null;
  return candidate?.baseError?.code ?? candidate?.code;
}

function isPolicyRefusal(error: unknown): boolean {
  const code = errorCode(error);
  return code !== undefined && [-32700, -32600, -32601, -32005].includes(code);
}

/**
 * The stamping proxy's "Transaction refused": a stale nonce, another stamp of this account in flight (a second tab),
 * or the node turning the stamped invoke away. None of them leaves the transaction with the node.
 */
function isStampingRefusal(error: unknown): boolean {
  return errorCode(error) === -32000;
}

/**
 * Until the transaction is in a block (pre-confirmed or later, a revert included). While the node does not know its
 * hash, the account's pre-confirmed nonce decides: past the frame's nonce, another transaction took it (unless the
 * block that moved it holds this one); unmoved for NOT_SEEN_LIMIT_MS, it never reached the node or the node lost it.
 * A hash the node holds but has not put in a block is slow, not lost, and keeps the wait open.
 */
async function untilInBlock(
  account: GameplaySubmitAccount,
  frameNonce: bigint,
  transactionHash: string,
): Promise<void> {
  let lastSeenAt = Date.now();
  while (true) {
    const status = await statusOf(account, transactionHash);
    if (status !== undefined && IN_BLOCK.has(status)) return;
    if (status !== undefined) lastSeenAt = Date.now();
    else if (await nonceMovedPast(account, frameNonce)) {
      const settled = await statusOf(account, transactionHash);
      if (settled !== undefined && IN_BLOCK.has(settled)) return;
      throw new TransactionNotSentError(transactionHash, "replaced");
    } else if (Date.now() - lastSeenAt >= NOT_SEEN_LIMIT_MS)
      throw new TransactionNotSentError(transactionHash, "dropped");
    await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MS));
  }
}

/** The node's finality status for the hash; a failed read and an unknown hash both read as unseen. */
const statusOf = (account: GameplaySubmitAccount, transactionHash: string): Promise<string | undefined> =>
  account.getTransactionStatus(transactionHash).then(
    (result: { finality_status?: string }) => result.finality_status ?? undefined,
    () => undefined,
  );

/** A failed read never counts as moved: only the node's own nonce can prove the frame's nonce is spent. */
const nonceMovedPast = (account: GameplaySubmitAccount, frameNonce: bigint): Promise<boolean> =>
  account.getNonce(BlockTag.PRE_CONFIRMED).then(
    (nonce) => BigInt(nonce) > frameNonce,
    () => false,
  );
