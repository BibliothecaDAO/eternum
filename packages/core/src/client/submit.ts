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

import { ACTION_CHECKING_AFTER_MS, isTransactionHashNotFound, TransactionNotSentError } from "@bibliothecadao/provider";

import type { Shard } from "./shard";

/** What a gameplay account needs of its shard: the chain it signs for and the one gas bound the shard takes. */
export type GameplayShard = Pick<Shard, "chainId" | "l2GasBound">;

type GameplaySubmitAccount = Pick<AccountInterface, "address" | "execute" | "getNonce" | "getTransactionStatus">;
type RawExecute = (calls: AllowArray<Call>, details?: UniversalDetails) => Promise<InvokeFunctionResponse>;

interface ConfiguredGameplaySubmit {
  shard: GameplayShard;
  execute: RawExecute;
  /** The run the account plays for: its raw sends stop reconciling when the run ends. */
  stopped?: AbortSignal;
}

interface ExecuteGameplayAccountTransactionOptions {
  account: GameplaySubmitAccount;
  calls: AllowArray<Call>;
  shard: GameplayShard;
  details?: UniversalDetails;
  /**
   * Ends the reconciliation without claiming anything: a game client passes its own lifetime, a headless run its
   * run's. Defaults to the signal the account was configured with.
   */
  stopped?: AbortSignal;
}

/** An action's first answer: in a block, or neither in a block nor proven absent within ACTION_CHECKING_AFTER_MS. */
type GameplayInclusion = "included" | "unknown";

/**
 * A sent action: its hash as soon as the send returns, and `inBlock`, which keeps reconciling with the node until
 * the action is in a block (resolves) or proven not sent (rejects TransactionNotSentError), or its owner stops it.
 */
export interface SentGameplayTransaction extends InvokeFunctionResponse {
  inBlock: Promise<void>;
}

/** What one read of a hash says: in a block, held by the node, unknown to the node, or no answer at all. */
type HashReading = "in_block" | "held" | "absent" | "unavailable";

const configuredGameplaySubmits = new WeakMap<object, ConfiguredGameplaySubmit>();
/** Per account, the last send until its first answer (in a block, unknown, or proven not sent): the next waits on it. */
const sendsInFlight = new Map<string, Promise<void>>();
const STATUS_POLL_MS = 250;
/**
 * The stamping proxy forwards a request within 7,000 ms of receiving it, or never (its published bound). An unknown
 * hash and an unmoved nonce prove absence only once they have outlasted that bound plus a margin for the request's
 * transit to the proxy.
 */
const PROXY_FORWARD_BOUND_MS = 7_000;
const DROP_PROOF_MS = PROXY_FORWARD_BOUND_MS + 5_000;
/** After a drop, the hash is still checked once a block until the nonce moves. */
const LATE_WATCH_POLL_MS = 2_000;
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
  stopped?: AbortSignal,
): TAccount {
  const configured = configuredGameplaySubmits.get(account);
  if (configured) {
    assertConfiguredChain(account.address, configured.shard.chainId, shard.chainId);
    return account;
  }

  configuredGameplaySubmits.set(account, { shard, execute: account.execute.bind(account), stopped });
  account.execute = ((calls: AllowArray<Call>, details?: UniversalDetails) =>
    executeGameplayAccountTransaction({ account, calls, shard, details })) as AccountInterface["execute"];
  return account;
}

/**
 * One send in flight per account: the shard takes only the account's current nonce, so each send reads it fresh and
 * the next starts once this one has its first answer. The send resolves with the hash as soon as it returns, and
 * rejects only when the shard refused it before forwarding it; any other send error proves nothing, so the send is
 * reconciled. Nothing is ever resent.
 */
export function executeGameplayAccountTransaction({
  account,
  calls,
  shard,
  details,
  stopped,
}: ExecuteGameplayAccountTransactionOptions): Promise<SentGameplayTransaction> {
  const configured = configuredGameplaySubmits.get(account);
  if (configured) assertConfiguredChain(account.address, configured.shard.chainId, shard.chainId);
  const execute = configured?.execute ?? account.execute.bind(account);
  const owner = stopped ?? configured?.stopped;

  const key = `${shard.chainId}:${BigInt(account.address)}`;
  const previous = sendsInFlight.get(key) ?? Promise.resolve();
  const reconciling = previous.then(() => sendAndReconcile(account, execute, calls, shard, details, owner));
  const answered = reconciling
    .then(({ inclusion }) => inclusion)
    .then(
      () => undefined,
      () => undefined,
    );
  sendsInFlight.set(key, answered);
  void answered.then(() => {
    if (sendsInFlight.get(key) === answered) sendsInFlight.delete(key);
  });
  return reconciling.then(({ sent }) => sent);
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

/** Signs and sends at the current nonce, then reconciles whatever the send answered against the node. */
async function sendAndReconcile(
  account: GameplaySubmitAccount,
  execute: RawExecute,
  calls: AllowArray<Call>,
  shard: GameplayShard,
  details: UniversalDetails | undefined,
  stopped: AbortSignal | undefined,
): Promise<Reconciling> {
  const nonce = await account.getNonce(BlockTag.PRE_CONFIRMED);
  const frame = playFrame(nonce, shard, details);
  const expectedHash = ordinaryHash(account.address, calls, shard, frame);
  const transactionHash = await execute(calls, frame).then(
    (response) => response.transaction_hash,
    (error: unknown) => {
      if (isRefusedBeforeForwarding(error)) throw new TransactionNotSentError(expectedHash, "refused");
      // Anything after forwarding began proves nothing (-32011, a lost reply): reconcile, never resend.
      return hashOfUnansweredSend(error) ?? expectedHash;
    },
  );
  return reconcile(account, BigInt(nonce), transactionHash, stopped);
}

/** A sent action and its first answer, which frees the account's next send. */
interface Reconciling {
  sent: SentGameplayTransaction;
  inclusion: Promise<GameplayInclusion>;
}

/** The sent action's reconciliation, and its first answer: in a block, proven not sent, or unknown at the window. */
function reconcile(
  account: GameplaySubmitAccount,
  frameNonce: bigint,
  transactionHash: string,
  stopped: AbortSignal | undefined,
): Reconciling {
  const inBlock = untilInBlock(account, frameNonce, transactionHash, stopped);
  const inclusion = new Promise<GameplayInclusion>((resolve, reject) => {
    const unknown = setTimeout(() => resolve("unknown"), ACTION_CHECKING_AFTER_MS);
    inBlock.then(() => resolve("included"), reject).finally(() => clearTimeout(unknown));
  });
  // A caller may never read the block; neither rejection is left unhandled.
  inBlock.catch(() => {});
  inclusion.catch(() => {});
  return { sent: { transaction_hash: transactionHash, inBlock }, inclusion };
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

/** The stamping proxy's "Transaction outcome unknown": it tried to forward, and names the hash it computed. */
const OUTCOME_UNKNOWN = -32011;
/**
 * Refusals the proxy answers before it forwards anything: its own -32010, and its JSON, method, admission and
 * account-rate gates. This request never reached the node, so it is not sent; another tab's copy of the same hash is
 * that tab's to reconcile.
 */
const REFUSED_BEFORE_FORWARDING = new Set([-32010, -32700, -32600, -32601, -32005]);

function isRefusedBeforeForwarding(error: unknown): boolean {
  const candidate = error as { code?: number; baseError?: { code?: number } } | null;
  const code = candidate?.baseError?.code ?? candidate?.code;
  return code !== undefined && REFUSED_BEFORE_FORWARDING.has(code);
}

function hashOfUnansweredSend(error: unknown): string | undefined {
  const candidate = error as { code?: number; data?: unknown; baseError?: { code?: number; data?: unknown } } | null;
  const answer = candidate?.baseError ?? candidate;
  if (answer?.code !== OUTCOME_UNKNOWN) return undefined;
  const named = (answer.data as { transaction_hash?: unknown } | undefined)?.transaction_hash;
  return typeof named === "string" ? named : undefined;
}

/**
 * Until the transaction is in a block (pre-confirmed or later, a revert included). Not sent is claimed only on the
 * node's own answers: this hash unknown once the frame's nonce is spent (replaced), or this hash unknown with the
 * nonce unmoved for DROP_PROOF_MS (dropped, still watched for a late landing). A read that fails is no evidence either
 * way, and a hash the node holds is slow, not lost; both keep reconciling until the owner stops it.
 */
async function untilInBlock(
  account: GameplaySubmitAccount,
  frameNonce: bigint,
  transactionHash: string,
  stopped: AbortSignal | undefined,
): Promise<void> {
  let absentSince: number | undefined;
  while (true) {
    stopped?.throwIfAborted();
    const reading = await readHash(account, transactionHash);
    if (reading === "in_block") return;
    const nonce = await readNonce(account);
    if (nonce !== undefined && nonce > frameNonce) {
      // The frame's nonce is spent, by this transaction only if this hash is in a block.
      const spentBy = await readHash(account, transactionHash);
      if (spentBy === "in_block") return;
      if (spentBy === "absent") throw new TransactionNotSentError(transactionHash, "replaced");
    } else if (reading === "absent" && nonce !== undefined) {
      absentSince ??= Date.now();
      if (Date.now() - absentSince >= DROP_PROOF_MS) {
        const landedLate = watchForLateLanding(account, frameNonce, transactionHash, stopped);
        throw new TransactionNotSentError(transactionHash, "dropped", landedLate);
      }
    } else if (reading === "held") absentSince = undefined;
    await pause(STATUS_POLL_MS, stopped);
  }
}

/**
 * After a drop, until the nonce moves: true if this hash lands after all, false once the nonce is spent without it
 * or the owner stops watching.
 */
async function watchForLateLanding(
  account: GameplaySubmitAccount,
  frameNonce: bigint,
  transactionHash: string,
  stopped: AbortSignal | undefined,
): Promise<boolean> {
  try {
    while (true) {
      await pause(LATE_WATCH_POLL_MS, stopped);
      if ((await readHash(account, transactionHash)) === "in_block") return true;
      const nonce = await readNonce(account);
      if (nonce === undefined || nonce <= frameNonce) continue;
      const spentBy = await readHash(account, transactionHash);
      if (spentBy === "in_block") return true;
      if (spentBy === "absent") return false;
    }
  } catch {
    // The owner stopped watching; nothing landed that this client saw.
    return false;
  }
}

const readHash = (account: GameplaySubmitAccount, transactionHash: string): Promise<HashReading> =>
  account.getTransactionStatus(transactionHash).then(
    ({ finality_status }: { finality_status?: string }) =>
      finality_status === undefined ? "unavailable" : IN_BLOCK.has(finality_status) ? "in_block" : "held",
    (error: unknown) => (isTransactionHashNotFound(error) ? "absent" : "unavailable"),
  );

/** The account's pre-confirmed nonce, or undefined when the read fails: never a guess. */
const readNonce = (account: GameplaySubmitAccount): Promise<bigint | undefined> =>
  account.getNonce(BlockTag.PRE_CONFIRMED).then(
    (nonce) => BigInt(nonce),
    () => undefined,
  );

const pause = (ms: number, stopped: AbortSignal | undefined): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stopped?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(stopped!.reason);
    };
    stopped?.addEventListener("abort", abort, { once: true });
  });
