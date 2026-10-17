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

import { playRefusalReasonOf, PLAYS_IN_FLIGHT, TransactionNotSentError } from "@bibliothecadao/provider";

import { pause, transactionAnswer, TransactionNoAnswerError } from "./transaction-answer";

import type { Shard } from "./shard";
import type { GameSyncTransaction } from "../sync/game-sync-types";

/**
 * A command's way to the chain, in order: handed to the client, the game's release pins read, out of its account's
 * queue, its nonce ("known", or "read" from the node), answered (by the "proxy"; by "herald" or the "node" seeing it
 * included before the proxy replied; or "lost"), seen included (by "herald" or the "node"), and settled (with the
 * error's name when it failed). From its nonce on, a stage carries the transaction's hash.
 */
export type SendStage = "command" | "release-ready" | "left-queue" | "nonce" | "answered" | "included" | "settled";
type SendStageObserver = (stage: SendStage, detail?: string, transactionHash?: string) => void;
/** Who established that a play is in a block. */
type InclusionSource = "herald" | "node";

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
  /** Told each stage the send reaches. */
  onStage?: SendStageObserver;
}

/**
 * A sent action: its hash as soon as the send returns, and `inBlock`, which resolves on Herald or node inclusion.
 * An unanswered action leaves the account's plays in flight without claiming it was not sent.
 */
export interface SentGameplayTransaction extends InvokeFunctionResponse {
  inBlock: Promise<void>;
}

const configuredGameplaySubmits = new WeakMap<object, ConfiguredGameplaySubmit>();
/** Own submission bookkeeping, shared by every account object for the same chain and address. */
interface AccountSubmission {
  /** Resolves once the previous play was answered, so plays leave in nonce order and none leaves behind a refusal. */
  pending: Promise<void>;
  /** The nonce the next play takes. Unknown, it is read once none of the account's plays is in flight. */
  nextNonce?: bigint;
  /** Each play sent and not yet included, refused or given up on. */
  inFlight: Set<PlayInFlight>;
}
interface PlayInFlight {
  settled: Promise<void>;
  /** Its send got no answer: until it settles, a play after it cannot know it is not stranded behind it. */
  answerLost: boolean;
}
const accountSubmissions = new Map<string, AccountSubmission>();
const submissionKey = (chainId: string, address: string) => `${BigInt(chainId)}:${BigInt(address)}`;
const STATUS_POLL_MS = 250;
const ACCOUNT_NONCE = BlockTag.PRE_CONFIRMED;
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
  readNonceAhead(account, shard);
  return account;
}

/**
 * The first action of a session leaves without a nonce round trip: the read happens before the player acts. As every
 * read of an unknown nonce, it happens only with none of the account's plays in flight; a busy account's next send
 * reads it once idle.
 */
function readNonceAhead(account: GameplaySubmitAccount, shard: GameplayShard): void {
  const submission = submissionOf(shard.chainId, account.address);
  submission.pending = submission.pending
    .then(async () => {
      if (submission.nextNonce !== undefined || submission.inFlight.size > 0) return;
      submission.nextNonce = BigInt(await account.getNonce(ACCOUNT_NONCE));
    })
    // An unread nonce is read again by the first send.
    .catch(() => undefined);
}

function submissionOf(chainId: string, address: string): AccountSubmission {
  const key = submissionKey(chainId, address);
  let submission = accountSubmissions.get(key);
  if (!submission) {
    submission = { pending: Promise.resolve(), inFlight: new Set() };
    accountSubmissions.set(key, submission);
  }
  return submission;
}

/**
 * An account's plays leave one after another at the nonces it numbers itself, each once the one before it was
 * answered, without waiting for its inclusion: up to PLAYS_IN_FLIGHT sent and not yet included, as the shard admits.
 * A play never leaves behind one whose answer is still to come, so a refusal never leaves a later play waiting behind
 * its nonce. The send returns its hash or rejects on an explicit admission refusal. Other errors are reconciled,
 * never resent.
 */
export function executeGameplayAccountTransaction({
  account,
  calls,
  shard,
  details,
  stopped,
  waitForTransaction,
  onStage,
}: ExecuteGameplayAccountTransactionOptions): Promise<SentGameplayTransaction> {
  const configured = configuredGameplaySubmits.get(account);
  if (configured) assertConfiguredChain(account.address, configured.shard.chainId, shard.chainId);
  const execute = configured?.execute ?? account.execute.bind(account);
  const owner = stopped ?? configured?.stopped;
  // The manifest already identifies the signing chain; the SDK must not discover it again before an invoke.
  account.getChainId = async () => shard.chainId as Awaited<ReturnType<AccountInterface["getChainId"]>>;

  const state = submissionOf(shard.chainId, account.address);
  const sending = state.pending.then(async () => {
    await untilRoomInFlight(state);
    owner?.throwIfAborted();
    onStage?.("left-queue");
    return sendAndReconcile(account, execute, calls, shard, details, owner, state, waitForTransaction, onStage);
  });
  state.pending = sending.then(noop, noop);
  return sending;
}

const noop = () => {};

/** A play leaves beside the account's others only when its nonce is known and no answer before it was lost. */
async function untilRoomInFlight(submission: AccountSubmission): Promise<void> {
  const plays = () => [...submission.inFlight];
  const room = () =>
    submission.nextNonce === undefined || plays().some((play) => play.answerLost) ? 1 : PLAYS_IN_FLIGHT;
  while (submission.inFlight.size >= room()) await Promise.race(plays().map((play) => play.settled));
}

/** A transaction from another tab spent a nonce we did not number: read it again once none of ours is in flight. */
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

/**
 * Signs and sends at the account's next nonce and returns once the send is answered (or the play is seen included),
 * reconciling whatever it answered against the node.
 */
async function sendAndReconcile(
  account: GameplaySubmitAccount,
  execute: RawExecute,
  calls: AllowArray<Call>,
  shard: GameplayShard,
  details: UniversalDetails | undefined,
  stopped: AbortSignal | undefined,
  submission: AccountSubmission,
  waitForTransaction?: (transactionHash: string) => Promise<GameSyncTransaction>,
  onStage?: SendStageObserver,
): Promise<SentGameplayTransaction> {
  const nonceKnown = submission.nextNonce !== undefined;
  const nonce = submission.nextNonce ?? BigInt(await account.getNonce(ACCOUNT_NONCE));
  submission.nextNonce = nonce + 1n;
  const { play, settle } = enterFlight(submission);
  const frame = playFrame(`0x${nonce.toString(16)}`, shard, details);
  const expectedHash = ordinaryHash(account.address, calls, shard, frame);
  onStage?.("nonce", nonceKnown ? "known" : "read", expectedHash);
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
    // Seen included before the proxy replied: whoever saw it answered.
    expected.includedBy.then((source) => {
      onStage?.("answered", source, expectedHash);
      return expectedHash;
    }),
    execute(calls, frame).then(
      (response) => {
        onStage?.("answered", "proxy", response.transaction_hash);
        return response.transaction_hash;
      },
      (error: unknown) => {
        if (isAdmissionRefused(error) && !heraldReported) {
          throw new TransactionNotSentError(expectedHash, { cause: error, reason: playRefusalReasonOf(error) });
        }
        // Anything after forwarding began proves nothing (-32011, a lost reply): reconcile, never resend.
        play.answerLost = true;
        const unanswered = hashOfUnansweredSend(error) ?? expectedHash;
        onStage?.("answered", "lost", unanswered);
        return unanswered;
      },
    ),
  ]).catch((error) => {
    cancelled.abort(error);
    // A refused or unanswered play leaves its nonce in doubt: read it again once none of the account's is in flight.
    submission.nextNonce = undefined;
    settle();
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
  // Told after the answer, so a play its inclusion answered still reads answered, then included.
  sent.includedBy.then(
    (source) => onStage?.("included", source, sent.transaction_hash),
    () => {},
  );
  const inBlock = sent.inBlock
    .catch((error) => {
      submission.nextNonce = undefined;
      throw error;
    })
    .finally(settle);
  void inBlock.catch(() => {});
  return { transaction_hash: sent.transaction_hash, inBlock };
}

/** Counts a play in flight until `settle` says it was included, refused or given up on. */
function enterFlight(submission: AccountSubmission): { play: PlayInFlight; settle: () => void } {
  let settle!: () => void;
  const play: PlayInFlight = { settled: new Promise<void>((resolve) => (settle = resolve)), answerLost: false };
  submission.inFlight.add(play);
  void play.settled.then(() => submission.inFlight.delete(play));
  return { play, settle };
}

/** Herald and the node can establish inclusion; the first answer stops the fallback and names who gave it. */
function reconcile(
  account: GameplaySubmitAccount,
  transactionHash: string,
  stopped: AbortSignal | undefined,
  herald?: Promise<GameSyncTransaction>,
): SentGameplayTransaction & { includedBy: Promise<InclusionSource> } {
  const includedBy = transactionAnswer<InclusionSource>(
    transactionHash,
    herald?.then(() => "herald" as const),
    async (until) => {
      if (!herald) {
        await untilInBlock(account, transactionHash, until);
        return "node";
      }
      const status = await account.getTransactionStatus(transactionHash).catch(() => undefined);
      if (!status?.finality_status || !IN_BLOCK.has(status.finality_status)) {
        throw new TransactionNoAnswerError(transactionHash);
      }
      return "node";
    },
    stopped,
  );
  const inBlock = includedBy.then(() => undefined);
  // Raw callers may only need the hash.
  void inBlock.catch(() => {});
  return { transaction_hash: transactionHash, inBlock, includedBy };
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
