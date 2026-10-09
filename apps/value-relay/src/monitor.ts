import { Effect, Result } from "effect";
import type { MonitorPorts, Page, PaidClaim, BlitzCommitment, Withdrawal, BlitzResult, RelayEffect } from "./ports";
import { RelayFailure, relayOperation } from "./ports";

export interface MonitorProgress {
  halted: string | null;
  unverifiedTicks?: number;
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
    const checks = [checkConservation(ports), checkPaidClaims(ports), checkPostedResults(ports)];
    let unavailable: RelayFailure | null = null;
    for (const check of checks) {
      const observation = yield* Effect.result(check);
      if (Result.isFailure(observation)) unavailable ??= observation.failure;
      else if (observation.success) return yield* pausePayouts(ports, store, observation.success);
    }
    if (unavailable) {
      const unverifiedTicks = (progress.unverifiedTicks ?? 0) + 1;
      yield* relayOperation("record unverified monitor tick", () => store.save({ ...progress, unverifiedTicks }));
      if (unverifiedTicks >= 3)
        return yield* pausePayouts(ports, store, `unverified_value:${unverifiedTicks}:${unavailable.operation}`);
      return yield* Effect.fail(unavailable);
    }
    if (progress.unverifiedTicks) {
      const verified = { ...progress, unverifiedTicks: 0 };
      yield* relayOperation("clear unverified monitor ticks", () => store.save(verified));
      return verified;
    }
    return progress;
  });

const checkConservation = (ports: MonitorPorts) =>
  ports.shard.conservation().pipe(
    Effect.map((balances) => {
      const violation = balances.find((balance) => BigInt(balance.receipts) > BigInt(balance.netIssued));
      return violation ? `lords_conservation:${violation.gameId}:${violation.confirmedBlock}` : null;
    }),
  );

const checkPaidClaims = (ports: MonitorPorts) =>
  findMismatch(ports.ledger.paidClaims, (paid) =>
    Effect.gen(function* () {
      const receipt = yield* ports.shard.withdrawal(paid.chainId, paid.transactionHash);
      if (!matchesPaidClaim(receipt, paid)) return `paid_claim_mismatch:${paid.transactionHash}`;
      const wallet = yield* ports.identity.payoutWallet(receipt!.realmsId);
      if (wallet.status !== "ready" || BigInt(wallet.address) !== BigInt(paid.wallet))
        return `paid_wallet_mismatch:${paid.transactionHash}`;
      return null;
    }),
  );

const checkPostedResults = (ports: MonitorPorts) =>
  findMismatch(ports.ledger.postedResults, (posted) =>
    ports.shard
      .result(posted.chainId, posted.gameId)
      .pipe(
        Effect.map((result) => (matchesPostedResult(result, posted) ? null : `blitz_result_mismatch:${posted.gameId}`)),
      ),
  );

const findMismatch = <A>(
  read: (cursor: string | null) => RelayEffect<Page<A>>,
  check: (row: A) => RelayEffect<string | null>,
) =>
  Effect.gen(function* () {
    let cursor: string | null = null;
    const seen = new Set<string>();
    do {
      const page: Page<A> = yield* read(cursor);
      for (const row of page.rows) {
        const reason = yield* check(row);
        if (reason) return reason;
      }
      if (page.next !== null && seen.has(page.next))
        return yield* Effect.fail(new RelayFailure({ operation: "ledger_page_cycle" }));
      if (page.next !== null) seen.add(page.next);
      cursor = page.next;
    } while (cursor !== null);
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
