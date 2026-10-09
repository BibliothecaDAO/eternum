import { blitzCommitment } from "./blitz-commitment";
import { Effect, Result } from "effect";
import type { ConfirmedBlock, LaborClaim, RelayPorts } from "./ports";
import { RelayFailure, relayOperation } from "./ports";
import type { RelayProgress, RelayStore } from "./state";

/** Only confirmed blocks produce value obligations. A rewritten observed block stops this cursor permanently. */
export const runRelay = (chainId: string, ports: RelayPorts, store: RelayStore) =>
  Effect.gen(function* () {
    const progress = yield* relayOperation("read relay progress", () => store.progress());
    if (progress.halted) return { status: "halted" as const, reason: progress.halted };
    const head = yield* ports.shard.confirmedHead();
    if (head < progress.nextBlock - 1) return yield* haltRelay(store, "confirmed_head_regressed");
    yield* verifyObservedHead(chainId, ports, store, progress);
    let parentHash = progress.lastHash;
    for (let number = progress.nextBlock; number <= Math.min(head, progress.nextBlock + 99); number++) {
      const block = yield* ports.shard.block(number);
      yield* validateBlock(chainId, number, block, parentHash, store);
      yield* relayOperation("persist confirmed obligations", () => store.observe(block));
      parentHash = block.hash;
    }
    yield* payWithdrawals(ports, store);
    yield* postResults(ports, store);
    return { status: "ready" as const };
  });

const haltRelay = (store: RelayStore, reason: string) =>
  relayOperation("halt relay", () => store.halt(reason)).pipe(
    Effect.flatMap(() => Effect.fail(new RelayFailure({ operation: reason }))),
  );

/** A rewrite of any ancestor changes the head hash: one anchor verifies the whole observed chain. */
const verifyObservedHead = (chainId: string, ports: RelayPorts, store: RelayStore, progress: RelayProgress) =>
  Effect.gen(function* () {
    if (progress.nextBlock === 0) return;
    const number = progress.nextBlock - 1;
    const block = yield* ports.shard.block(number);
    if (BigInt(block.hash) !== BigInt(progress.lastHash!))
      return yield* haltRelay(store, `confirmed_block_changed:${number}`);
    yield* validateBlock(chainId, number, block, null, store);
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
      return yield* haltRelay(store, `parent_hash_changed:${number}`);
    if (block.results.some((result) => BigInt(blitzCommitment(result)) !== BigInt(result.commitment)))
      return yield* haltRelay(store, `invalid_result_commitment:${number}`);
    if ([...block.withdrawals, ...block.results].some((row) => BigInt(row.chainId) !== BigInt(chainId)))
      return yield* haltRelay(store, `receipt_chain_differs:${number}`);
  });

const payWithdrawals = (ports: RelayPorts, store: RelayStore) =>
  Effect.gen(function* () {
    const withdrawals = yield* relayOperation("read pending withdrawals", () => store.withdrawals());
    for (const withdrawal of withdrawals) {
      const wallet = yield* ports.identity.payoutWallet(withdrawal.realmsId);
      if (wallet.status !== "ready") continue;
      const payment = yield* Effect.result(ports.ledger.pay(withdrawal, wallet.address));
      if (Result.isFailure(payment)) {
        if (payment.failure.operation === "ledger_clock_behind") continue;
        return yield* Effect.fail(payment.failure);
      }
      yield* relayOperation("complete withdrawal", () => store.completeWithdrawal(withdrawal.transactionHash));
    }
  });

const postResults = (ports: RelayPorts, store: RelayStore) =>
  Effect.gen(function* () {
    const results = yield* relayOperation("read pending results", () => store.results());
    for (const result of results) {
      yield* ports.ledger.postResult(result);
      yield* relayOperation("complete result", () => store.completeResult(result.gameId));
    }
  });

/** Realm ownership is read for every claim; the shard enforces the Realm/day first-write rule. */
export const grantDailyLabor = (ports: RelayPorts, claim: LaborClaim) =>
  Effect.gen(function* () {
    const wallet = yield* ports.identity.linkedWallet(claim.realmsId);
    if (!wallet) return yield* Effect.fail(new RelayFailure({ operation: "labor_wallet_missing" }));
    const owner = yield* ports.realms.ownerOf(claim.realmId);
    if (BigInt(owner) !== BigInt(wallet)) return yield* Effect.fail(new RelayFailure({ operation: "realm_not_owned" }));
    return yield* ports.shard.grantLabor(claim);
  });
