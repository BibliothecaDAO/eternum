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

export interface MonitorProgress {
  halted: string | null;
  unverifiedTicks?: number;
  cursors?: Partial<Record<"paidClaims" | "postedResults", { fromBlock: number; page: string | null }>>;
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
    const checks = [checkConservation(ports), checkPaidClaims(ports, store), checkPostedResults(ports, store)];
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

const checkConservation = (ports: MonitorPorts) =>
  ports.shard.conservation().pipe(
    Effect.map((balances) => {
      const violation = balances.find((balance) => BigInt(balance.receipts) > BigInt(balance.netIssued));
      return violation ? `lords_conservation:${violation.gameId}:${violation.confirmedBlock}` : null;
    }),
  );

const checkPaidClaims = (ports: MonitorPorts, store: MonitorStore) =>
  checkLedgerPage(
    "paidClaims",
    ports.ledger.paidClaims,
    (paid) =>
      Effect.gen(function* () {
        const receipt = yield* ports.shard.withdrawal(paid.chainId, paid.transactionHash);
        if (!matchesPaidClaim(receipt, paid)) return `paid_claim_mismatch:${paid.transactionHash}`;
        const wallet = yield* ports.identity.payoutWallet(receipt!.realmsId);
        if (wallet.status !== "ready" || BigInt(wallet.address) !== BigInt(paid.wallet))
          return `paid_wallet_mismatch:${paid.transactionHash}`;
        return null;
      }),
    store,
  );

const checkPostedResults = (ports: MonitorPorts, store: MonitorStore) =>
  checkLedgerPage(
    "postedResults",
    ports.ledger.postedResults,
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
  read: (cursor: string | null, fromBlock?: number) => RelayEffect<LedgerPage<A>>,
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
    for (const row of page.rows) {
      const fault = yield* check(row);
      if (fault) return fault;
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
