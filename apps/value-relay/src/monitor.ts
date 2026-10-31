import { Effect, Result } from "effect";
import type {
  MonitorPorts,
  LedgerPage,
  PaidClaim,
  ReportedClaim,
  BlitzCommitment,
  Withdrawal,
  BlitzResult,
  RelayEffect,
  LedgerAnchor,
} from "./ports";
import { RelayFailure, relayOperation } from "./ports";

interface AuditCursor {
  /** Absent until the first page: the ledger's deployment block, as the reader reports it. */
  fromBlock?: number;
  page: string | null;
  offset?: number;
  anchor?: LedgerAnchor;
}
interface FaultRow {
  row: string;
  /**
   * Exactly what the failed check saw: the ledger row, the failure and its independent evidence. The operator's reset
   * clears this observation, never the row's identity: the same row showing anything else is checked again. A fault
   * with none (a roster check, or one the previous version recorded) waives nothing: its reset re-observes.
   */
  fact?: string;
  stream?: "reportedSettlements" | "reportedClaims" | "paidClaims" | "postedResults";
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
  cursors?: Partial<Record<"reportedSettlements" | "reportedClaims" | "paidClaims" | "postedResults", AuditCursor>>;
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
    const checks = [
      checkReportedSettlements(ports, store),
      checkReportedClaims(ports, store),
      checkConservation(ports, store),
      checkPaidClaims(ports, store),
      checkPostedResults(ports, store),
    ];
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
      if (BigInt(balance.pool) < BigInt(deposit.success) / 10n ** 18n) {
        unavailable ??= new RelayFailure({ operation: "frontier_pool_publication_pending" });
        continue;
      }
      const poolRow = `conservation:pool:${balance.chainId}:${balance.gameId}:${balance.pool}:${deposit.success}`;
      if (BigInt(balance.pool) !== BigInt(deposit.success) / 10n ** 18n && !isCleared(progress, poolRow)) {
        yield* recordFault(store, { row: poolRow, fact: poolRow });
        return `frontier_pool_mismatch:${balance.chainId}:${balance.gameId}`;
      }
    }
    if (unavailable) return yield* Effect.fail(unavailable);
    return null;
  });

/** Missing evidence is a stop condition, not an endlessly retryable row ahead of later reports. */
const verifyReport = (check: RelayEffect<Mismatch | null>, reason: string): RelayEffect<Mismatch | null> =>
  check.pipe(Effect.catch((failure) => Effect.succeed({ reason, evidence: failure.operation, retry: true as const })));

const checkReportedSettlements = (ports: MonitorPorts, store: MonitorStore) =>
  checkLedgerPage(
    "reportedSettlements",
    ports.ledger.reportedSettlements,
    (row) => `reportedSettlements:${hex(row.chainId)}:${row.gameId}`,
    (row) =>
      `reportedSettlements:${hex(row.chainId)}:${row.gameId}:${BigInt(row.chestWithdrawn)}:${BigInt(row.prizeWithdrawn)}`,
    (report) =>
      verifyReport(
        ports.shard
          .settlementEvidence(report)
          .pipe(
            Effect.map((evidence) =>
              evidence === null ? null : { reason: `reported_settlement_mismatch:${report.gameId}`, evidence },
            ),
          ),
        `reported_settlement_unverifiable:${report.gameId}`,
      ).pipe(
        Effect.flatMap((mismatch) =>
          mismatch ? Effect.succeed(mismatch) : ports.ledger.approveSettlement(report).pipe(Effect.as(null)),
        ),
      ),
    store,
  );

const checkReportedClaims = (ports: MonitorPorts, store: MonitorStore) =>
  checkLedgerPage(
    "reportedClaims",
    ports.ledger.reportedClaims,
    (row) => `reportedClaims:${row.chainId}:${row.transactionHash}`,
    (row) =>
      `reportedClaims:${hex(row.chainId)}:${hex(row.transactionHash)}:${row.seasonId}:${BigInt(row.amount)}:${row.prizeRank}:${row.prizeCount}:${hex(row.wallet)}:${hex(row.reportTransactionHash)}`,
    (report) =>
      verifyReport(verifyReportedReceipt(ports, report), `reported_claim_unverifiable:${report.transactionHash}`).pipe(
        Effect.flatMap((mismatch) =>
          mismatch || BigInt(report.wallet) === 0n
            ? Effect.succeed(mismatch)
            : ports.ledger.approvePayment(report).pipe(Effect.as(null)),
        ),
      ),
    store,
  );

const verifyReportedReceipt = (ports: MonitorPorts, report: ReportedClaim) =>
  Effect.gen(function* () {
    const receipt = yield* ports.shard.withdrawalReceipt(report.chainId, report.transactionHash);
    const evidence = receipt === null ? "receipt:none" : JSON.stringify(receipt);
    if (!matchesPaidClaim(receipt, report))
      return { reason: `reported_claim_mismatch:${report.transactionHash}`, evidence };
    if (BigInt(report.wallet) !== 0n) {
      const resolved = yield* ports.shard.withdrawal(report.chainId, report.transactionHash);
      if (
        !resolved ||
        !matchesPaidClaim(resolved, report) ||
        !(yield* ports.identity.matchesPayDecision({
          chainId: report.chainId,
          claimId: report.transactionHash,
          transactionHash: report.reportTransactionHash,
          realmsId: resolved.realmsId,
          wallet: report.wallet,
          seasonId: report.seasonId,
          amount: report.amount,
        }))
      )
        return { reason: `reported_wallet_mismatch:${report.transactionHash}`, evidence };
    }
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
        const evidence = receiptEvidence(receipt);
        if (!matchesPaidClaim(receipt, paid))
          return { reason: `paid_claim_mismatch:${paid.transactionHash}`, evidence };
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
          return { reason: `paid_wallet_mismatch:${paid.transactionHash}`, evidence };
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
            matchesPostedResult(result, posted)
              ? null
              : { reason: `blitz_result_mismatch:${posted.gameId}`, evidence: resultEvidence(result) },
          ),
        ),
    store,
  );

/** A tick checks at most one 100-event page per stream; only verified pages advance the durable cursor. */
const checkLedgerPage = <A>(
  stream: "reportedSettlements" | "reportedClaims" | "paidClaims" | "postedResults",
  read: (cursor: string | null, fromBlock?: number, anchor?: LedgerAnchor) => RelayEffect<LedgerPage<A>>,
  key: (row: A) => string,
  fact: (row: A) => string,
  check: (row: A) => RelayEffect<Mismatch | null>,
  store: MonitorStore,
) =>
  Effect.gen(function* () {
    const progress = yield* relayOperation("read ledger audit cursor", () => store.load());
    const cursor: AuditCursor = progress.cursors?.[stream] ?? { page: null };
    const readPage = yield* Effect.result(read(cursor.page, cursor.fromBlock, cursor.anchor));
    if (Result.isFailure(readPage)) {
      if (!isReportStream(stream)) return yield* Effect.fail(readPage.failure);
      yield* recordFault(store, { row: `${stream}:unavailable` });
      return `${stream}_unverifiable`;
    }
    const page = readPage.success;
    const fromBlock = page.fromBlock;
    if (
      !Number.isSafeInteger(page.head) ||
      page.head < fromBlock - 1 ||
      page.rows.length > 100 ||
      (page.rows.length > 0 && page.head < fromBlock) ||
      (!page.rewind && page.next !== null && page.next === cursor.page)
    ) {
      if (isReportStream(stream)) {
        yield* recordFault(store, { row: `${stream}:unavailable` });
        return `${stream}_unverifiable`;
      }
      return yield* Effect.fail(new RelayFailure({ operation: "invalid_ledger_audit_page" }));
    }
    for (let index = page.rewind ? 0 : (cursor.offset ?? 0); index < page.rows.length; index++) {
      const row = page.rows[index]!;
      // The check always runs: a clearance waives the observation the operator saw, never the row whatever it shows.
      const observation = yield* Effect.result(check(row));
      if (Result.isFailure(observation) && !isReportStream(stream)) return yield* Effect.fail(observation.failure);
      const mismatch: Mismatch | null = Result.isFailure(observation)
        ? { reason: `${stream}_unverifiable`, evidence: observation.failure.operation, retry: true }
        : observation.success;
      if (mismatch) {
        const observed = observedFact(fact(row), mismatch);
        if (!mismatch.retry && isCleared(progress, observed)) continue;
        yield* recordFault(store, {
          row: key(row),
          ...(mismatch.retry ? {} : { fact: observed }),
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
        return mismatch.reason;
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

const matchesPaidClaim = (
  receipt: Omit<Withdrawal, "realmsId"> | null,
  paid: Omit<Withdrawal, "realmsId" | "confirmedAt">,
) =>
  receipt !== null &&
  BigInt(receipt.chainId) === BigInt(paid.chainId) &&
  BigInt(receipt.transactionHash) === BigInt(paid.transactionHash) &&
  receipt.seasonId === paid.seasonId &&
  receipt.prizeRank === paid.prizeRank &&
  receipt.prizeCount === paid.prizeCount &&
  BigInt(receipt.amount) === BigInt(paid.amount);
const matchesPostedResult = (result: BlitzResult | null, posted: BlitzCommitment) =>
  result !== null &&
  BigInt(result.chainId) === BigInt(posted.chainId) &&
  result.gameId === posted.gameId &&
  BigInt(result.commitment) === BigInt(posted.commitment);

const hex = (value: string) => `0x${BigInt(value).toString(16)}`;

/** The paid claim's ledger fields, and nothing block-dependent, so a replay at a new anchor is the same fact. */
const paidClaimFact = (paid: PaidClaim) =>
  `paidClaims:${hex(paid.chainId)}:${hex(paid.transactionHash)}:${paid.seasonId}:${BigInt(paid.amount)}:${hex(paid.wallet)}:${hex(paid.paymentTransactionHash)}:${paid.prizeRank}:${paid.prizeCount}`;
/** The posted result's ledger fields. */
const postedResultFact = (posted: BlitzCommitment) =>
  `postedResults:${hex(posted.chainId)}:${posted.gameId}:${hex(posted.commitment)}`;

/** What a failed check saw: why the ledger row disagrees, and the independent evidence it was compared with. */
interface Mismatch {
  retry?: true;
  reason: string;
  evidence: string;
}
/** A fault as observed: the ledger row's fact, the failure, and its evidence. A changed side is a different fault. */
const observedFact = (ledger: string, mismatch: Mismatch) => `${ledger}|${mismatch.reason}|${mismatch.evidence}`;
const receiptEvidence = (receipt: Withdrawal | null) =>
  receipt === null
    ? "receipt:none"
    : `receipt:${hex(receipt.chainId)}:${hex(receipt.transactionHash)}:${receipt.seasonId}:${BigInt(receipt.amount)}:${hex(receipt.realmsId)}:${receipt.prizeRank}:${receipt.prizeCount}`;
const resultEvidence = (result: BlitzResult | null) =>
  result === null ? "result:none" : `result:${hex(result.chainId)}:${result.gameId}:${hex(result.commitment)}`;

const isReportStream = (stream: FaultRow["stream"]) => stream === "reportedClaims" || stream === "reportedSettlements";

const isCleared = (progress: MonitorProgress, fact: string) => progress.cleared?.includes(fact) ?? false;

const recordFault = (store: MonitorStore, fault: FaultRow) =>
  relayOperation("record faulting audit row", async () => store.save({ ...(await store.load()), fault }));

/**
 * Clears only the recorded observation. Reports are checked again so corrected evidence can earn approval; a waived
 * mismatch itself grants none. Historical paid/result rows advance past the cleared observation. A fault without a
 * fact waives nothing and keeps the cursor. A reset never unpauses the ledger.
 */
export const resetMonitorRow = (previous: MonitorProgress, row: string): MonitorProgress => {
  if (!previous.halted || previous.fault?.row !== row) throw new Error("fault_row_mismatch");
  const fault = previous.fault;
  const next: MonitorProgress = { ...previous, halted: null, fault: null };
  if (!fault.fact) return next;
  next.cleared = [...(previous.cleared ?? []), fault.fact];
  if (fault.stream && fault.cursor && fault.offset !== undefined) {
    next.cursors = {
      ...previous.cursors,
      [fault.stream]: { ...fault.cursor, offset: fault.offset + (isReportStream(fault.stream) ? 0 : 1) },
    };
  }
  return next;
};
