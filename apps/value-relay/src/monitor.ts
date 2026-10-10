import { Effect, Result } from "effect";
import type {
  MonitorPorts,
  LedgerPage,
  PaidClaim,
  BlitzCommitment,
  Withdrawal,
  BlitzResult,
  RelayEffect,
} from "./ports";
import { RelayFailure, relayOperation } from "./ports";

interface AuditCursor {
  fromBlock: number;
  page: string | null;
  offset?: number;
}
interface FaultRow {
  row: string;
  stream?: "paidClaims" | "postedResults" | "accountLinks";
  cursor?: AuditCursor;
  offset?: number;
}
export interface MonitorProgress {
  fault?: FaultRow | null;
  skippedConservation?: string;
  halted: string | null;
  unverifiedTicks?: number;
  cursors?: Partial<Record<"paidClaims" | "postedResults" | "accountLinks", AuditCursor>>;
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
    yield* relayOperation("start exact row audit", () => store.save({ ...progress, fault: null }));
    const checks = [
      checkAccountLinks(ports, store),
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
    if (unavailable) {
      const unverifiedTicks = (progress.unverifiedTicks ?? 0) + 1;
      yield* relayOperation("record unverified monitor tick", async () =>
        store.save({ ...(await store.load()), unverifiedTicks }),
      );
      if (unverifiedTicks >= 3)
        return yield* pausePayouts(ports, store, `unverified_value:${unverifiedTicks}:${unavailable.operation}`);
      return yield* Effect.fail(unavailable);
    }
    if (progress.unverifiedTicks) {
      const verified = { ...(yield* relayOperation("read checked cursors", () => store.load())), unverifiedTicks: 0 };
      yield* relayOperation("clear unverified monitor ticks", () => store.save(verified));
      return verified;
    }
    return yield* relayOperation("read checked monitor progress", () => store.load());
  });

const checkAccountLinks = (ports: MonitorPorts, store: MonitorStore) =>
  checkLedgerPage(
    "accountLinks",
    ports.ledger.accountLinks,
    (row) => `accountLinks:${row.id}`,
    (row) =>
      ports.identity
        .matchesLedgerLinkWrite(row)
        .pipe(Effect.map((matches) => (matches ? null : `account_link_mismatch:${row.id}`))),
    store,
  );

const checkConservation = (ports: MonitorPorts, store: MonitorStore) =>
  Effect.gen(function* () {
    const balances = yield* ports.shard.conservation();
    const progress = yield* relayOperation("read conservation checkpoint", () => store.load());
    for (const balance of balances) {
      const row = `conservation:${balance.gameId}:${balance.confirmedBlock}:${balance.receipts}:${balance.netIssued}`;
      if (BigInt(balance.receipts) > BigInt(balance.netIssued) && progress.skippedConservation !== row) {
        yield* recordFault(store, { row });
        return `lords_conservation:${balance.gameId}:${balance.confirmedBlock}`;
      }
    }
    return null;
  });

const checkPaidClaims = (ports: MonitorPorts, store: MonitorStore) =>
  checkLedgerPage(
    "paidClaims",
    ports.ledger.paidClaims,
    (row) => `paidClaims:${row.chainId}:${row.transactionHash}`,
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
  stream: "paidClaims" | "postedResults" | "accountLinks",
  read: (cursor: string | null, fromBlock?: number) => RelayEffect<LedgerPage<A>>,
  key: (row: A) => string,
  check: (row: A) => RelayEffect<string | null>,
  store: MonitorStore,
) =>
  Effect.gen(function* () {
    const progress = yield* relayOperation("read ledger audit cursor", () => store.load());
    const cursor = progress.cursors?.[stream] ?? { fromBlock: 0, page: null };
    const page = yield* read(cursor.page, cursor.fromBlock);
    if (
      !Number.isSafeInteger(page.head) ||
      page.head < cursor.fromBlock - 1 ||
      page.rows.length > 100 ||
      (page.rows.length > 0 && page.head < cursor.fromBlock) ||
      (page.next !== null && page.next === cursor.page)
    )
      return yield* Effect.fail(new RelayFailure({ operation: "invalid_ledger_audit_page" }));
    for (let index = cursor.offset ?? 0; index < page.rows.length; index++) {
      const row = page.rows[index]!;
      const observation = yield* Effect.result(check(row));
      if (Result.isFailure(observation) || observation.success) {
        yield* recordFault(store, {
          row: key(row),
          stream,
          cursor: { fromBlock: cursor.fromBlock, page: cursor.page ?? JSON.stringify({ head: page.head, token: "" }) },
          offset: index,
        });
        if (Result.isFailure(observation)) return yield* Effect.fail(observation.failure);
        return observation.success;
      }
    }
    const next =
      page.next === null ? { fromBlock: page.head + 1, page: null } : { fromBlock: cursor.fromBlock, page: page.next };
    yield* relayOperation("persist checked ledger page", async () => {
      const latest = await store.load();
      await store.save({ ...latest, cursors: { ...latest.cursors, [stream]: next } });
    });
    return null;
  });

const pausePayouts = (ports: MonitorPorts, store: MonitorStore, reason: string) =>
  Effect.gen(function* () {
    const halted = { ...(yield* relayOperation("read monitor stop state", () => store.load())), halted: reason };
    if (!halted.fault) halted.fault = { row: `availability:${reason}` };
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

const recordFault = (store: MonitorStore, fault: FaultRow) =>
  relayOperation("record faulting audit row", async () => store.save({ ...(await store.load()), fault }));

export const resetMonitorRow = (previous: MonitorProgress, row: string): MonitorProgress => {
  if (!previous.halted || previous.fault?.row !== row) throw new Error("fault_row_mismatch");
  const fault = previous.fault;
  const next: MonitorProgress = { ...previous, halted: null, unverifiedTicks: 0, fault: null };
  if (fault.stream && fault.cursor && fault.offset !== undefined)
    next.cursors = { ...previous.cursors, [fault.stream]: { ...fault.cursor, offset: fault.offset + 1 } };
  else if (row.startsWith("conservation:")) next.skippedConservation = row;
  return next;
};
