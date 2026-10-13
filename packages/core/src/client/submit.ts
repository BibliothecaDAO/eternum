import { resolveGameTransactionResourceBounds } from "../account/transaction-resource-bounds";
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
  type UniversalDetails,
  type InvocationsSignerDetails,
} from "starknet";

import { TransactionNotSentError } from "@bibliothecadao/provider";

import { pause, transactionAnswer, TransactionNoAnswerError } from "./transaction-answer";

import type { Shard } from "./shard";
import type { GameSyncTransaction } from "../sync/game-sync-types";

/** What a gameplay account needs of its shard: the chain it signs for and the one gas bound the shard takes. */
export type GameplayShard = Pick<Shard, "chainId" | "l2GasBound">;

type GameplaySubmitAccount = Pick<AccountInterface, "address" | "execute" | "getNonce" | "getTransactionStatus"> &
  Partial<Pick<AccountInterface, "getChainId">>;
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
  /** Herald reports only after the transaction facts are written. */
  waitForTransaction?: (transactionHash: string) => Promise<GameSyncTransaction>;
}

/**
 * A sent action: its hash as soon as the send returns, and `inBlock`, which resolves on Herald or node inclusion.
 * An unanswered action releases the queue without claiming it was not sent.
 */
export interface SentGameplayTransaction extends InvokeFunctionResponse {
  inBlock: Promise<void>;
}

const configuredGameplaySubmits = new WeakMap<object, ConfiguredGameplaySubmit>();
/** Own submission bookkeeping, shared by every account object for the same chain and address. */
interface AccountSubmission {
  pending: Promise<void>;
  nextNonce?: bigint;
}
const accountSubmissions = new Map<string, AccountSubmission>();
const submissionKey = (chainId: string, address: string) => `${BigInt(chainId)}:${BigInt(address)}`;
const STATUS_POLL_MS = 250;
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
 * One send in flight per account: Herald inclusion frees the next send at the nonce after the one just used.
 * The send returns its hash or rejects on an explicit admission refusal. Other errors are reconciled, never resent.
 */
export function executeGameplayAccountTransaction({
  account,
  calls,
  shard,
  details,
  stopped,
  waitForTransaction,
}: ExecuteGameplayAccountTransactionOptions): Promise<SentGameplayTransaction> {
  const configured = configuredGameplaySubmits.get(account);
  if (configured) assertConfiguredChain(account.address, configured.shard.chainId, shard.chainId);
  const execute = configured?.execute ?? account.execute.bind(account);
  const owner = stopped ?? configured?.stopped;
  // The manifest already identifies the signing chain; the SDK must not discover it again before an invoke.
  account.getChainId = async () => shard.chainId as Awaited<ReturnType<AccountInterface["getChainId"]>>;

  const key = submissionKey(shard.chainId, account.address);
  let submission = accountSubmissions.get(key);
  if (!submission) {
    submission = { pending: Promise.resolve() };
    accountSubmissions.set(key, submission);
  }
  const state = submission;
  const sending = state.pending.then(() => {
    owner?.throwIfAborted();
    return sendAndReconcile(account, execute, calls, shard, details, owner, state, waitForTransaction);
  });
  state.pending = sending.then(({ inBlock }) => inBlock).catch(() => undefined);
  return sending;
}

/** A transaction from another tab spent a nonce we did not reserve. Reconcile at the next send. */
export function invalidateGameplayNonce(chainId: string, address: string): void {
  const submission = accountSubmissions.get(submissionKey(chainId, address));
  if (!submission) return;
  submission.nextNonce = undefined;
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
  submission: AccountSubmission,
  waitForTransaction?: (transactionHash: string) => Promise<GameSyncTransaction>,
): Promise<SentGameplayTransaction> {
  const nonce =
    submission.nextNonce === undefined
      ? await account.getNonce(BlockTag.PRE_CONFIRMED)
      : `0x${submission.nextNonce.toString(16)}`;
  const frame = playFrame(nonce, shard, details);
  submission.nextNonce = BigInt(nonce);
  const expectedHash = ordinaryHash(account.address, calls, shard, frame);
  let heraldReported: GameSyncTransaction | undefined;
  const reported = waitForTransaction?.(expectedHash)
    .then((status) => {
      heraldReported = status;
      return status;
    })
    .catch(() => new Promise<never>(() => {}));
  const cancelled = new AbortController();
  const until = stopped ? AbortSignal.any([stopped, cancelled.signal]) : cancelled.signal;
  const expected = reconcile(account, expectedHash, until, reported);
  const transactionHash = await Promise.race([
    expected.inBlock.then(() => expectedHash),
    execute(calls, frame).then(
      (response) => response.transaction_hash,
      (error: unknown) => {
        if (isAdmissionRefused(error) && !heraldReported) {
          throw new TransactionNotSentError(expectedHash, { cause: error });
        }
        // Anything after forwarding began proves nothing (-32011, a lost reply): reconcile, never resend.
        return hashOfUnansweredSend(error) ?? expectedHash;
      },
    ),
  ]).catch((error) => {
    cancelled.abort(error);
    submission.nextNonce = undefined;
    throw error;
  });
  let sent = expected;
  if (BigInt(transactionHash) !== BigInt(expectedHash)) {
    cancelled.abort();
    sent = reconcile(
      account,
      transactionHash,
      stopped,
      waitForTransaction?.(transactionHash).catch(() => new Promise<never>(() => {})),
    );
  }
  const inBlock = sent.inBlock.then(
    () => {
      // Another tab's status may have invalidated our reservation while this send was waiting.
      if (submission.nextNonce === BigInt(nonce)) submission.nextNonce += 1n;
    },
    (error) => {
      submission.nextNonce = undefined;
      throw error;
    },
  );
  void inBlock.catch(() => {});
  return { ...sent, inBlock };
}

/** Herald and the node can establish inclusion; the first answer stops the fallback. */
function reconcile(
  account: GameplaySubmitAccount,
  transactionHash: string,
  stopped: AbortSignal | undefined,
  herald?: Promise<GameSyncTransaction>,
): SentGameplayTransaction {
  const inBlock = transactionAnswer(
    transactionHash,
    herald?.then(() => undefined),
    async (until) => {
      if (!herald) return untilInBlock(account, transactionHash, until);
      const status = await account.getTransactionStatus(transactionHash).catch(() => undefined);
      if (!status?.finality_status || !IN_BLOCK.has(status.finality_status)) {
        throw new TransactionNoAnswerError(transactionHash);
      }
    },
    stopped,
  );
  // Raw callers may only need the hash.
  void inBlock.catch(() => {});
  return { transaction_hash: transactionHash, inBlock };
}

/** An ordinary v3 invoke at this nonce with the shard's fixed bounds and tip 0. */
function playFrame(nonce: string, shard: GameplayShard, details: UniversalDetails | undefined) {
  return {
    ...details,
    nonce,
    version: "0x3" as const,
    tip: 0,
    resourceBounds: resolveGameTransactionResourceBounds(shard.l2GasBound),
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
/** Explicit proxy or node admission refusals. Duplicate / unknown replies still need reconciliation. */
const ADMISSION_REFUSED = new Set([
  -32010,
  -32700,
  -32600,
  -32601,
  -32005,
  52, // invalid nonce
  53,
  54, // insufficient validation resources / balance
  55,
  58, // validation failed / not an account
  61,
  64,
  65, // unsupported version / underpriced replacement / fee below minimum
]);

function isAdmissionRefused(error: unknown): boolean {
  const code = rpcError(error)?.code;
  return code !== undefined && ADMISSION_REFUSED.has(code);
}

function hashOfUnansweredSend(error: unknown): string | undefined {
  const answer = rpcError(error);
  if (answer?.code !== OUTCOME_UNKNOWN) return undefined;
  const named = (answer.data as { transaction_hash?: unknown } | undefined)?.transaction_hash;
  return typeof named === "string" ? named : undefined;
}

function rpcError(error: unknown): { code?: number; data?: unknown } | undefined {
  const candidate = error as { code?: number; data?: unknown; baseError?: { code?: number; data?: unknown } } | null;
  return candidate?.baseError ?? candidate ?? undefined;
}

/**
 * Only positive inclusion is evidence. A missing hash, even with a spent nonce or after the proxy's forwarding
 * bound, cannot distinguish a node visibility gap from a drop or replacement. Herald stops this fallback first.
 */
async function untilInBlock(
  account: GameplaySubmitAccount,
  transactionHash: string,
  stopped: AbortSignal,
): Promise<void> {
  while (true) {
    stopped.throwIfAborted();
    const status = await account.getTransactionStatus(transactionHash).catch(() => undefined);
    stopped.throwIfAborted();
    if (status?.finality_status && IN_BLOCK.has(status.finality_status)) return;
    await pause(STATUS_POLL_MS, stopped);
  }
}
