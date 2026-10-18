import { Effect, Result } from "effect";
import type {
  MonitorPorts,
  LedgerPage,
  PaidClaim,
  BlitzCommitment,
  Withdrawal,
  BlitzResult,
  RelayEffect,
  LedgerAnchor,
} from "./ports";
import { RelayFailure, relayOperation } from "./ports";

interface AuditCursor {
  fromBlock: number;
  page: string | null;
  offset?: number;
  anchor?: LedgerAnchor;
}
interface FaultRow {
  row: string;
  /** Exactly what the failed check compared; the operator's reset clears this fact, never the row's identity. */
  fact: string;
  stream?: "paidClaims" | "postedResults";
  cursor?: AuditCursor;
  offset?: number;
}
export interface MonitorProgress {
  fault?: FaultRow | null;
  /**
   * Every fact an operator reset. A clearance holds while a row still says exactly what the operator saw: it survives a
   * ledger rewind that replays the same evidence, and a rewrite that changes it is checked again.
   */
  cleared?: string[];
  halted: string | null;
  cursors?: Partial<Record<"paidClaims" | "postedResults", AuditCursor>>;
}
interface MonitorStore {
  load(): Promise<MonitorProgress>;
  save(progress: MonitorProgress): Promise<void>;
}

/** The monitor has a separate pauser credential. A failed pause retries from its durable stop condition. */
export const runMonitor = (ports: MonitorPorts, store: MonitorStore) =>
  Effect.gen(function* () {
    const progress = yield* relayOperation("read monitor progress", () => store.load());
    if (progress.halted) {
      yield* ports.ledger.pause();
      return progress;
    }
    const checks = [checkConservation(ports, store), checkPaidClaims(ports, store), checkPostedResults(ports, store)];
    let unavailable: RelayFailure | null = null;
    for (const check of checks) {
      const observation = yield* Effect.result(check);
      if (Result.isFailure(observation)) unavailable ??= observation.failure;
      else if (observation.success) return yield* pausePayouts(ports, store, observation.success);
    }
    if (unavailable) return yield* Effect.fail(unavailable);
    return yield* relayOperation("read checked monitor progress", () => store.load());
  });

const checkConservation = (ports: MonitorPorts, store: MonitorStore) =>
  Effect.gen(function* () {
    const balances = yield* ports.shard.conservation();
    const progress = yield* relayOperation("read conservation checkpoint", () => store.load());
    let unavailable: RelayFailure | null = null;
    for (const balance of balances) {
      const row = `conservation:${balance.chainId}:${balance.gameId}:${balance.confirmedBlock}:${balance.receipts}:${balance.netIssued}`;
      if (BigInt(balance.receipts) > BigInt(balance.netIssued) && !isCleared(progress, row)) {
        yield* recordFault(store, { row, fact: row });
        return `lords_conservation:${balance.gameId}:${balance.confirmedBlock}`;
      }
      if (BigInt(balance.pool) === 0n) continue;
      const deposit = yield* Effect.result(ports.ledger.frontierPool(balance.chainId, balance.gameId));
      if (Result.isFailure(deposit)) {
        unavailable ??= deposit.failure;
        continue;
      }
      const poolRow = `conservation:pool:${balance.chainId}:${balance.gameId}:${balance.pool}:${deposit.success}`;
      if (BigInt(balance.pool) * 10n ** 18n !== BigInt(deposit.success) && !isCleared(progress, poolRow)) {
        yield* recordFault(store, { row: poolRow, fact: poolRow });
        return `frontier_pool_mismatch:${balance.chainId}:${balance.gameId}`;
      }
    }
    if (unavailable) return yield* Effect.fail(unavailable);
    return null;
  });

const checkPaidClaims = (ports: MonitorPorts, store: MonitorStore) =>
  checkLedgerPage(
    "paidClaims",
    ports.ledger.paidClaims,
    (row) => `paidClaims:${row.chainId}:${row.transactionHash}`,
    paidClaimFact,
    (paid) =>
      Effect.gen(function* () {
        const receipt = yield* ports.shard.withdrawal(paid.chainId, paid.transactionHash);
        if (!matchesPaidClaim(receipt, paid)) return `paid_claim_mismatch:${paid.transactionHash}`;
        if (
          !(yield* ports.identity.matchesPayDecision({
            chainId: paid.chainId,
            claimId: paid.transactionHash,
            transactionHash: paid.paymentTransactionHash,
            realmsId: receipt!.realmsId,
            wallet: paid.wallet,
            seasonId: paid.seasonId,
            amount: paid.amount,
          }))
        )
          return `paid_wallet_mismatch:${paid.transactionHash}`;
        return null;
      }),
    store,
  );

const checkPostedResults = (ports: MonitorPorts, store: MonitorStore) =>
  checkLedgerPage(
    "postedResults",
    ports.ledger.postedResults,
    (row) => `postedResults:${row.chainId}:${row.gameId}`,
    postedResultFact,
    (posted) =>
      ports.shard
        .result(posted.chainId, posted.gameId)
        .pipe(
          Effect.map((result) =>
            matchesPostedResult(result, posted) ? null : `blitz_result_mismatch:${posted.gameId}`,
          ),
        ),
    store,
  );

/** A tick checks at most one 100-event page per stream; only verified pages advance the durable cursor. */
const checkLedgerPage = <A>(
  stream: "paidClaims" | "postedResults",
  read: (cursor: string | null, fromBlock?: number, anchor?: LedgerAnchor) => RelayEffect<LedgerPage<A>>,
  key: (row: A) => string,
  fact: (row: A) => string,
  check: (row: A) => RelayEffect<string | null>,
  store: MonitorStore,
) =>
  Effect.gen(function* () {
    const progress = yield* relayOperation("read ledger audit cursor", () => store.load());
    const cursor = progress.cursors?.[stream] ?? { fromBlock: 0, page: null };
    const page = yield* read(cursor.page, cursor.fromBlock, cursor.anchor);
    const fromBlock = page.rewind ? 0 : cursor.fromBlock;
    if (
      !Number.isSafeInteger(page.head) ||
      page.head < fromBlock - 1 ||
      page.rows.length > 100 ||
      (page.rows.length > 0 && page.head < fromBlock) ||
      (!page.rewind && page.next !== null && page.next === cursor.page)
    )
      return yield* Effect.fail(new RelayFailure({ operation: "invalid_ledger_audit_page" }));
    for (let index = page.rewind ? 0 : (cursor.offset ?? 0); index < page.rows.length; index++) {
      const row = page.rows[index]!;
      if (isCleared(progress, fact(row))) continue;
      const observation = yield* Effect.result(check(row));
      if (Result.isFailure(observation)) return yield* Effect.fail(observation.failure);
      if (observation.success) {
        yield* recordFault(store, {
          row: key(row),
          fact: fact(row),
          stream,
          cursor: {
            fromBlock,
            anchor: page.anchor,
            page:
              !page.rewind && cursor.page !== null
                ? cursor.page
                : JSON.stringify({ head: page.head, hash: page.anchor.hash, token: "" }),
          },
          offset: index,
        });
        return observation.success;
      }
    }
    const next =
      page.next === null
        ? { fromBlock: page.head + 1, page: null, anchor: page.anchor }
        : { fromBlock, page: page.next, anchor: page.anchor };
    yield* relayOperation("persist checked ledger page", async () => {
      const latest = await store.load();
      await store.save({ ...latest, cursors: { ...latest.cursors, [stream]: next } });
    });
    return null;
  });

const pausePayouts = (ports: MonitorPorts, store: MonitorStore, reason: string) =>
  Effect.gen(function* () {
    const halted = { ...(yield* relayOperation("read monitor stop state", () => store.load())), halted: reason };
    yield* relayOperation("persist payout stop", () => store.save(halted));
    yield* ports.ledger.pause();
    return halted;
  });

const matchesPaidClaim = (receipt: Withdrawal | null, paid: PaidClaim) =>
  receipt !== null &&
  BigInt(receipt.chainId) === BigInt(paid.chainId) &&
  BigInt(receipt.transactionHash) === BigInt(paid.transactionHash) &&
  receipt.seasonId === paid.seasonId &&
  BigInt(receipt.amount) === BigInt(paid.amount);
const matchesPostedResult = (result: BlitzResult | null, posted: BlitzCommitment) =>
  result !== null &&
  BigInt(result.chainId) === BigInt(posted.chainId) &&
  result.gameId === posted.gameId &&
  BigInt(result.commitment) === BigInt(posted.commitment);

const hex = (value: string) => `0x${BigInt(value).toString(16)}`;

/** Every field the paid-claim check compares, and nothing block-dependent, so a replay at a new anchor is the same fact. */
export const paidClaimFact = (paid: PaidClaim) =>
  `paidClaims:${hex(paid.chainId)}:${hex(paid.transactionHash)}:${paid.seasonId}:${BigInt(paid.amount)}:${hex(paid.wallet)}:${hex(paid.paymentTransactionHash)}`;
/** Every field the posted-result check compares. */
export const postedResultFact = (posted: BlitzCommitment) =>
  `postedResults:${hex(posted.chainId)}:${posted.gameId}:${hex(posted.commitment)}`;

const isCleared = (progress: MonitorProgress, fact: string) => progress.cleared?.includes(fact) ?? false;

const recordFault = (store: MonitorStore, fault: FaultRow) =>
  relayOperation("record faulting audit row", async () => store.save({ ...(await store.load()), fault }));

export const resetMonitorRow = (previous: MonitorProgress, row: string): MonitorProgress => {
  if (!previous.halted || previous.fault?.row !== row) throw new Error("fault_row_mismatch");
  const fault = previous.fault;
  const next: MonitorProgress = {
    ...previous,
    halted: null,
    fault: null,
    cleared: [...(previous.cleared ?? []), fault.fact],
  };
  if (fault.stream && fault.cursor && fault.offset !== undefined)
    next.cursors = { ...previous.cursors, [fault.stream]: { ...fault.cursor, offset: fault.offset + 1 } };
  return next;
};
