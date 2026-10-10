import { blitzCommitment } from "@realms-world/value-ledger/commitment";
import { Effect, Result } from "effect";
import type { ConfirmedBlock, LaborClaim, RelayPorts, Withdrawal, PayableClaim, ClaimOutcome } from "./ports";
import { RelayFailure, relayOperation } from "./ports";
import type { RelayProgress, RelayStore } from "./state";

/** Only confirmed blocks produce value obligations. A rewritten observed block stops this cursor permanently. */
export const runRelay = (chainId: string, ports: RelayPorts, store: RelayStore) =>
  Effect.gen(function* () {
    const progress = yield* relayOperation("read relay progress", () => store.progress());
    if (progress.halted) return { status: "halted" as const, reason: progress.halted };
    const head = yield* ports.shard.confirmedHead();
    if (head < (progress.page?.head ?? progress.nextBlock - 1))
      return yield* haltRelay(store, `confirmed_head_regressed:${progress.page?.head ?? progress.nextBlock - 1}`);
    yield* verifyObservedHead(ports, store, progress);
    const end = progress.page?.head ?? Math.min(head, progress.nextBlock + 99);
    if (progress.nextBlock <= end) {
      const observed = yield* Effect.result(
        ports.shard.eventsPage(progress.nextBlock, end, progress.page?.token ?? null),
      );
      if (Result.isFailure(observed)) {
        if (/^confirmed_block_changed:\d+$/.test(observed.failure.operation))
          return yield* haltRelay(store, observed.failure.operation);
        return yield* Effect.fail(observed.failure);
      }
      const page = observed.success;
      if (page.number !== end || (page.fromBlock ?? progress.nextBlock) !== progress.nextBlock)
        return yield* haltRelay(store, `invalid_shard_page_range:${progress.nextBlock}`);
      yield* validateBlock(chainId, end, page, progress.lastHash, store);
      yield* relayOperation("persist confirmed obligations", () => store.observe(separateInvalidRows(chainId, page)));
    }
    const payments = yield* payWithdrawals(ports, store);
    const results = yield* postResults(ports, store);
    yield* restoreResolvableReceipts(ports, store);
    return { status: "ready" as const, deferred: [...payments, ...results] };
  });

/** An interface/funding outage is temporary. Bot identities and invalid receipt layouts remain set aside. */
const restoreResolvableReceipts = (ports: RelayPorts, store: RelayStore) =>
  Effect.gen(function* () {
    const held = yield* relayOperation("read held receipt recovery", () => store.heldRecovery());
    for (const row of held) {
      if (row.kind !== "receipt" || ["withdrawal_account_unknown", "decode withdrawal receipt"].includes(row.reason))
        continue;
      const resolved = yield* Effect.result(ports.shard.withdrawal(row.receipt.chainId, row.receipt.transactionHash));
      if (Result.isSuccess(resolved) && resolved.success)
        yield* relayOperation("restore verified withdrawal", () => store.restoreWithdrawal(resolved.success!));
    }
  });

const haltRelay = (store: RelayStore, reason: string) =>
  relayOperation("halt relay", () => store.halt(reason)).pipe(
    Effect.flatMap(() => Effect.fail(new RelayFailure({ operation: reason }))),
  );

/** A rewrite of any ancestor changes the head hash: one anchor verifies the whole observed chain. */
const verifyObservedHead = (ports: RelayPorts, store: RelayStore, progress: RelayProgress) =>
  Effect.gen(function* () {
    if (progress.nextBlock === 0 && !progress.page) return;
    const number = progress.page?.head ?? progress.nextBlock - 1;
    const hash = yield* ports.shard.blockHash(number);
    if (BigInt(hash) !== BigInt(progress.page?.hash ?? progress.lastHash!))
      return yield* haltRelay(store, `confirmed_block_changed:${number}`);
  });

const validateBlock = (
  chainId: string,
  number: number,
  block: ConfirmedBlock,
  parentHash: string | null,
  store: RelayStore,
) =>
  Effect.gen(function* () {
    if (
      BigInt(block.chainId) !== BigInt(chainId) ||
      block.number !== number ||
      !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(block.status)
    ) {
      return yield* haltRelay(store, `invalid_confirmed_block:${number}`);
    }
    if (parentHash !== null && BigInt(block.parentHash) !== BigInt(parentHash))
      return yield* haltRelay(store, `parent_hash_changed:${block.fromBlock ?? number}`);
  });

/** Content errors keep their evidence without suppressing valid obligations in the same page. */
const separateInvalidRows = (chainId: string, page: ConfirmedBlock): ConfirmedBlock => {
  const held = [...(page.held ?? [])];
  const withdrawals = page.withdrawals.filter((withdrawal) => {
    try {
      if (BigInt(withdrawal.chainId) === BigInt(chainId)) return true;
    } catch {}
    held.push({ kind: "payment", withdrawal, reason: "receipt_chain_differs" });
    return false;
  });
  const results = page.results.filter((result) => {
    try {
      if (BigInt(result.chainId) === BigInt(chainId) && BigInt(blitzCommitment(result)) === BigInt(result.commitment))
        return true;
    } catch {}
    held.push({ kind: "result", result, reason: "invalid_result_commitment" });
    return false;
  });
  return { ...page, withdrawals, results, held };
};

const payWithdrawals = (ports: RelayPorts, store: RelayStore) =>
  Effect.gen(function* () {
    const deferred: { key: string; reason: string }[] = [];
    const rows = yield* relayOperation("read pending withdrawals", () => store.withdrawals());
    const reads = yield* Effect.forEach(rows, (row) => Effect.result(ports.ledger.payment(row)), { concurrency: 25 });
    const reported: Withdrawal[] = [],
      fresh: Withdrawal[] = [];
    for (let index = 0; index < rows.length; index++) {
      const withdrawal = rows[index]!,
        result = reads[index]!;
      if (Result.isFailure(result)) {
        deferred.push({ key: withdrawal.transactionHash, reason: result.failure.operation });
        continue;
      }
      const saved = result.success;
      if (saved && (saved.seasonId !== withdrawal.seasonId || BigInt(saved.amount) !== BigInt(withdrawal.amount))) {
        yield* setAsideOrDefer(store, withdrawal, "ledger_report_mismatch", deferred);
        continue;
      }
      if (saved?.paid)
        yield* relayOperation("complete paid withdrawal", () => store.completeWithdrawal(withdrawal.transactionHash));
      else if (saved) reported.push(withdrawal);
      else fresh.push(withdrawal);
    }
    if (fresh.length) {
      const report = yield* Effect.result(ports.ledger.reportMany(fresh));
      const outcomes = Result.isSuccess(report)
        ? validateOutcomes(fresh, report.success)
        : new Map(fresh.map((row) => [row.transactionHash, report.failure.operation]));
      for (const withdrawal of fresh) {
        const error = outcomes.get(withdrawal.transactionHash);
        if (error === null) reported.push(withdrawal);
        else yield* setAsideOrDefer(store, withdrawal, error!, deferred);
      }
    }
    const ready: PayableClaim[] = [];
    for (const withdrawal of reported) {
      const voided = yield* Effect.result(ports.ledger.voided(withdrawal));
      if (Result.isFailure(voided)) {
        deferred.push({ key: withdrawal.transactionHash, reason: voided.failure.operation });
        continue;
      }
      if (voided.success) {
        yield* setAsideOrDefer(store, withdrawal, "ledger_report_voided", deferred);
        continue;
      }
      const wallet = yield* Effect.result(ports.identity.payoutWallet(withdrawal.realmsId));
      if (Result.isFailure(wallet))
        deferred.push({ key: withdrawal.transactionHash, reason: wallet.failure.operation });
      else if (wallet.success.status === "ready") ready.push({ withdrawal, wallet: wallet.success.address });
    }
    if (ready.length) {
      const pay = yield* Effect.result(ports.ledger.payMany(ready));
      const outcomes = Result.isSuccess(pay)
        ? validateOutcomes(
            ready.map((row) => row.withdrawal),
            pay.success,
          )
        : new Map(ready.map((row) => [row.withdrawal.transactionHash, pay.failure.operation]));
      for (const { withdrawal } of ready) {
        const error = outcomes.get(withdrawal.transactionHash);
        if (error === null)
          yield* relayOperation("complete withdrawal", () => store.completeWithdrawal(withdrawal.transactionHash));
        else yield* setAsideOrDefer(store, withdrawal, error!, deferred);
      }
    }
    return deferred;
  });
const validateOutcomes = (rows: readonly Withdrawal[], outcomes: readonly ClaimOutcome[]) => {
  const results = new Map(outcomes.map((row) => [row.claimId, row.error]));
  if (
    results.size !== rows.length ||
    outcomes.length !== rows.length ||
    rows.some((row) => !results.has(row.transactionHash))
  )
    throw new RelayFailure({ operation: "invalid_payment_batch_outcomes" });
  return results;
};
const setAsideOrDefer = (
  store: RelayStore,
  withdrawal: Withdrawal,
  reason: string,
  deferred: { key: string; reason: string }[],
) =>
  [
    "ledger_report_voided",
    "ledger_withdrawal_exceeds_backing",
    "ledger_season_closed",
    "ledger_invalid_withdrawal",
    "ledger_report_mismatch",
    "ledger_claim_window_ended",
  ].includes(reason)
    ? relayOperation("set aside refused payment", () => store.hold({ kind: "payment", withdrawal, reason }))
    : Effect.sync(() => {
        deferred.push({ key: withdrawal.transactionHash, reason });
      });

const postResults = (ports: RelayPorts, store: RelayStore) =>
  Effect.gen(function* () {
    const deferred: { key: string; reason: string }[] = [];
    const results = yield* relayOperation("read pending results", () => store.results());
    for (const result of results) {
      const posted = yield* Effect.result(ports.ledger.postResult(result));
      if (Result.isFailure(posted)) {
        deferred.push({ key: String(result.gameId), reason: posted.failure.operation });
        continue;
      }
      yield* relayOperation("complete result", () => store.completeResult(result.gameId));
    }
    return deferred;
  });

/** Realm ownership is read for every claim; the shard enforces the Realm/day first-write rule. */
export const grantDailyLabor = (ports: RelayPorts, claim: LaborClaim) =>
  Effect.gen(function* () {
    const account = yield* ports.identity.accountForRealmsId(claim.realmsId);
    if (!account || BigInt(account) !== BigInt(claim.account))
      return yield* Effect.fail(new RelayFailure({ operation: "labor_account_mismatch" }));
    const wallet = yield* ports.identity.linkedWallet(claim.realmsId);
    if (!wallet) return yield* Effect.fail(new RelayFailure({ operation: "labor_wallet_missing" }));
    const owner = yield* ports.realms.ownerOf(claim.realmId);
    if (BigInt(owner) !== BigInt(wallet)) return yield* Effect.fail(new RelayFailure({ operation: "realm_not_owned" }));
    return yield* ports.shard.grantLabor(claim);
  });
