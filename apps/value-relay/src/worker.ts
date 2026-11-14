import { checkDepositRetirement } from "./deposit-retirement";
import { relayDeposits, depositHistory, clearDepositFault, type DepositMutation } from "./deposits";
import { mutateDeposit } from "./deposit-ledger";
import { cosignerClient } from "./cosigner-client";
import type { HeldRealm } from "@realms-world/identity";
import {
  handleHeldRealmsRequest,
  handleRealmEntryRequest,
  registerHomeSource,
  type RealmEntryClaim,
} from "./realm-entry";
import { PlayerRequestError } from "./player-request";
import { joinShardOperator } from "./shard-account";
import { decodeRelaySettings, ledgerAddress, ledgerContractOf, type RelaySettings } from "./environment";
import { bindLedgerState, ledgerOrNull, ledgerStateName } from "./ledger-state";
import {
  relayAccountAddress,
  activeShards,
  requireActiveChain,
  readRegisteredShard,
  type ShardDirectory,
  rpcAt,
  readRegistrationPage,
  readLedgerSlot,
  type LedgerSlotKey,
  type RegistrationQuery,
} from "@realms-world/value-ledger";
import { processSeasonTops } from "./season-tops";
import { seasonLedgerReads, postSeasonTop } from "./season-ledger";
import { ledgerBatches } from "./ledger-batches";
import { isLedgerReadTick } from "@realms-world/chain";
import { beginCause, causeDue, completeCause, raiseCause, retryCause } from "./ledger-cause";
import { onIdentityChain } from "./ledger-chain";
import { openSlotOnLedger, refundSlotOnLedger, markSlotRefundable } from "./blitz-launch";
import { currentLaborDay, writeLaborGrant } from "./shard-labor";
import { handleLaborRequest } from "./labor-route";
import { ShardReader, shardConnection } from "./shard-rpc";
import { publishFrontierPools } from "./frontier-pools";
import { awardFrontierPrizes } from "./frontier-prizes";
import { sweepFrontierLords, type FrontierSettlement, type PrincipalSweep } from "./frontier-sweep";
import { settleFrontier } from "./frontier-settlement";
import { frontierReceiptBindings } from "./frontier-binding";
import approvedExtension from "../../../config/source/frontier/extension.json";
import { readFrontierExtension, requireExtendedFrontier } from "./frontier-extension";
import { durableFinalFacts } from "./final-facts";
import { shardWithdrawalPorts } from "./shard-withdrawals";
import { chestLedgerReads, finishChestOnLedger } from "./chest-ledger";
import { DurableChestStore, finishChestNow, finishRequestedChests } from "./chests";
import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import { Effect, Result, Semaphore } from "effect";
import { ledgerResultAdapter, postVerifiedResult } from "./ledger";
import { ledgerPaymentRead, ledgerPaymentProof, ledgerWithdrawalVoided, ledgerResetPayments } from "./chain";
import { presentsOperatorToken } from "@realms-world/identity";
import { identityAdapter } from "./adapters";
import { runRelay, grantDailyLabor } from "./relay";
import { DurableRelayStore } from "./state";
import { RelayFailure, relayOperation, type RelayPorts, type LaborClaim } from "./ports";

interface RelayEnv extends RelaySettings {
  IDENTITY_HTTP: Fetcher;
  ROSTER_MONITOR: {
    verifyRoster(chainId: string, gameId: number): Promise<number | null>;
    ledgerWritten(): Promise<void>;
  };
  IDENTITY: ShardDirectory & {
    l2ChainId(): Promise<string>;
    holdsRealm(wallet: string, realmId: number): Promise<boolean>;
    heldRealmsWithMaps(wallet: string): Promise<HeldRealm[]>;
    campaignTicket(
      realmsId: string,
      presetId: number,
    ): Promise<{ campaign: string; tier: "regular" | "golden" } | null>;
    recordPayDecisions(decisions: import("@realms-world/identity").LedgerPayDecision[]): Promise<void>;
    ratingsChanged(): Promise<void>;
    linkedWallet(id: string): Promise<string | null>;
    authenticate(cookie: string): Promise<{ realmsId: string } | null>;
    accountForRealmsId(id: string): Promise<string | null>;
    realmsIdForAccount(account: string): Promise<string | null>;
  };
  RELAY: DurableObjectNamespace<ValueRelay>;
}

const LEDGER_TICK_DUE = "ledgerTick:due";
const RECONCILE_DUE = "reconcile:due";
const RECONCILE_RETRY_SECONDS = 60;

const ledgerTickFinished = (observation: {
  seasons: string | null | { error: string };
  chests: { failed: number; pending: number } | null;
  chest_error?: string | null;
}) =>
  (observation.seasons === null ||
    (typeof observation.seasons === "string" && observation.seasons.startsWith("season_review_pending"))) &&
  observation.chests !== null &&
  !observation.chest_error &&
  observation.chests.failed === 0 &&
  observation.chests.pending === 0;
const DELIVERY_DUE = "deposits:due";
const DELIVERY_RETRY_SECONDS = 60;

interface ShardObservation {
  deposits?: { error?: unknown; pending?: number; more?: boolean };
  [field: string]: unknown;
}
/** A shard's deposits need no minute-by-minute look while the last pass left nothing pending and no error. */
const depositsSettled = (deposits: NonNullable<ShardObservation["deposits"]>) =>
  !deposits.error && !deposits.pending && !deposits.more;

/** A single transaction stream per official chain, isolated from the shard host. */
export class ValueRelay extends DurableObject<RelayEnv> {
  private readonly ledgerSigning = Semaphore.makeUnsafe(1);
  private readonly shardSigning = Semaphore.makeUnsafe(1);
  private readonly ingesting = Semaphore.makeUnsafe(1);
  private readonly store = new DurableRelayStore(this.ctx.storage);
  private readonly chests = new DurableChestStore(this.ctx.storage);

  private ledgerPermit<A, E>(operation: Effect.Effect<A, E>, chains: readonly string[] = []) {
    return this.ledgerSigning.withPermit(
      relayOperation("verify official value chain", async () => {
        for (const chain of new Set(chains)) await requireActiveChain(this.env.IDENTITY, chain);
      }).pipe(Effect.andThen(onIdentityChain(this.env.L2_RPC_URL, this.env.IDENTITY, operation))),
    );
  }
  /** The relay's own write is the cause to read the ledger again, here and in the monitor, without waiting for the hour. */
  private async ledgerWritten() {
    await raiseCause(this.ctx.storage, LEDGER_TICK_DUE);
    try {
      await this.env.ROSTER_MONITOR.ledgerWritten();
    } catch {
      /* The hourly audit still reads what a lost notice announced. */
    }
  }
  /**
   * The minute's ledger tick: it runs on the hour, or when the relay wrote since the last one. The cause is kept until
   * the tick finished its work: a failure, season events still to read or chests still pending ask again in five minutes.
   */
  async ledgerTickIfDue(hourly: boolean) {
    const began = await beginCause(this.ctx.storage, LEDGER_TICK_DUE, hourly);
    if (!began) return null;
    try {
      const observation = await this.ledgerTick();
      if (ledgerTickFinished(observation)) await completeCause(this.ctx.storage, began);
      else await retryCause(this.ctx.storage, began);
      return observation;
    } catch (error) {
      await retryCause(this.ctx.storage, began);
      throw error;
    }
  }
  async ledgerTick() {
    const relay = this;
    return Effect.runPromise(
      this.ingesting.withPermit(
        Effect.gen(function* () {
          const bound = yield* Effect.result(
            relayOperation("bind ledger state", () =>
              bindLedgerState(
                relay.ctx.storage,
                ledgerOrNull(() => ledgerAddress(relay.env.ENVIRONMENT)),
              ),
            ),
          );
          if (Result.isFailure(bound)) {
            const reason = bound.failure.operation;
            const refused = { seasons: { error: reason }, checked_at: Math.floor(Date.now() / 1000), chests: null };
            const observation = { ...refused, chest_error: reason };
            yield* relayOperation("publish relay health", () => relay.ctx.storage.put("lastTick", observation));
            return observation;
          }
          const seasons = yield* Effect.result(
            onIdentityChain(
              relay.env.L2_RPC_URL,
              relay.env.IDENTITY,
              relayEffect("post season leaderboard", () =>
                processSeasonTops(
                  "post",
                  {
                    ...seasonLedgerReads(ledgerCredentialsOf(relay.env)),
                    challenge: async () => {
                      throw new Error("relay_cannot_challenge");
                    },
                    post: async (id, wallets) => {
                      await Effect.runPromise(
                        relay.ledgerPermit(
                          relayOperation("post season top", () =>
                            postSeasonTop(ledgerCredentialsOf(relay.env), id, wallets),
                          ),
                        ),
                      );
                      await relay.ledgerWritten();
                    },
                  },
                  relay.ctx.storage,
                ),
              ),
            ),
          );
          const chests = yield* Effect.result(
            relayEffect("ledger chests unavailable", () =>
              finishRequestedChests(
                chestPortsOf(relay.env, (effect) => relay.ledgerPermit(effect)),
                relay.chests,
              ),
            ),
          );
          const observation = {
            seasons: Result.isSuccess(seasons) ? seasons.success : { error: seasons.failure.operation },
            checked_at: Math.floor(Date.now() / 1000),
            chests: Result.isSuccess(chests) ? chests.success : null,
            chest_error: Result.isFailure(chests) ? chests.failure.operation : null,
          };
          yield* relayOperation("publish relay health", () => relay.ctx.storage.put("lastTick", observation));
          return observation;
        }),
      ),
    );
  }
  /** A player's chest, finished now if its draw is readable: the page asks rather than wait for the next tick. */
  finishChest(tokenId: string) {
    return Effect.runPromise(
      finishChestNow(
        chestPortsOf(this.env, (effect) => this.ledgerPermit(effect)),
        tokenId,
      ),
    );
  }
  /** An operator's action (a voided report, a reset) is the cause to ask the ledger about held claims at the next tick. */
  async requestReconcile() {
    await raiseCause(this.ctx.storage, RECONCILE_DUE);
  }
  async tick(chainId?: string, hourly = false) {
    const reconciling = await beginCause(this.ctx.storage, RECONCILE_DUE, hourly);
    const reconcile = reconciling !== null;
    const chain = chainId ?? (await this.ctx.storage.get<string>("chain"));
    if (!chain) return { status: "unavailable" as const, reason: "actor_chain_unbound" };
    const relay = this;
    const outcome = await Effect.runPromise(
      Effect.result(
        this.ingesting.withPermit(
          relayOperation("advance official shard", async () => {
            const ports = await relay.portsFor(chain);
            await Effect.runPromise(
              relay.shardSigning.withPermit(
                relayOperation("relay_account_join_failed", () => joinShardOperator(relay.env, chain)),
              ),
            );
            const previous = await relay.ctx.storage.get<string>("chain");
            if (previous && BigInt(previous) !== BigInt(chain)) throw new Error("actor_chain_differs");
            await relay.ctx.storage.put("chain", chain);
            const value = await Effect.runPromise(
              Effect.result(
                onIdentityChain(
                  relay.env.L2_RPC_URL,
                  relay.env.IDENTITY,
                  runRelay(chain, ports, relay.store, reconcile),
                ),
              ),
            );
            const funding = await Effect.runPromise(
              Effect.result(
                onIdentityChain(
                  relay.env.L2_RPC_URL,
                  relay.env.IDENTITY,
                  relay.shardSigning.withPermit(
                    relayOperation("publish Frontier pools", () => relay.publishPools(chain, reconcile)),
                  ),
                ),
              ),
            );
            const lastTick = await relay.ctx.storage.get<ShardObservation>("shardTick");
            const reported = await beginCause(relay.ctx.storage, DELIVERY_DUE, false);
            const deposits =
              lastTick?.deposits && !reconcile && !reported && depositsSettled(lastTick.deposits)
                ? Result.succeed(lastTick.deposits)
                : await Effect.runPromise(Effect.result(relay.relayDepositsNow(chain, reconcile)));
            const observation = {
              checked_at: Math.floor(Date.now() / 1000),
              deposits: Result.isSuccess(deposits) ? deposits.success : { error: deposits.failure.operation },
              funding_error: Result.isFailure(funding) ? funding.failure.operation : null,
              value: Result.isSuccess(value)
                ? value.success
                : { status: "unavailable", reason: value.failure.operation },
            };
            await relay.ctx.storage.put("shardTick", observation);
            const depositsDone = Result.isSuccess(deposits) && !deposits.success.error;
            if (reported) {
              if (depositsDone) await completeCause(relay.ctx.storage, reported);
              else await retryCause(relay.ctx.storage, reported, DELIVERY_RETRY_SECONDS);
            }
            if (reconciling) {
              // The request covers every kind of work a proof pass does: a failure in any of them keeps the cause.
              const done =
                Result.isSuccess(value) &&
                value.success.status === "ready" &&
                value.success.reconciled &&
                Result.isSuccess(funding) &&
                depositsDone;
              if (done) await completeCause(relay.ctx.storage, reconciling);
              else await retryCause(relay.ctx.storage, reconciling, RECONCILE_RETRY_SECONDS);
            }
            if (Result.isSuccess(value) && value.success.status === "ready" && value.success.more)
              await relay.ctx.storage.setAlarm(Date.now());
            return observation;
          }),
        ),
      ),
    );
    if (Result.isSuccess(outcome)) return outcome.success;
    const observation = {
      checked_at: Math.floor(Date.now() / 1000),
      value: { status: "unavailable", reason: outcome.failure.operation },
    };
    await this.ctx.storage.put("shardTick", observation);
    if (reconciling) await retryCause(this.ctx.storage, reconciling, RECONCILE_RETRY_SECONDS);
    return observation;
  }
  /** One pass over the deposits: the work is durable in the obligations, so a pass that ends or dies loses nothing. */
  private relayDepositsNow(chainId: string, proofs: boolean) {
    return this.shardSigning.withPermit(
      relayOperation("relay LORDS deposits", async () => relayDeposits(await this.depositPorts(chainId, proofs))),
    );
  }
  /**
   * A player's deposit, delivered now: the page asks once its payment landed, so a deposit is not found by reading the
   * ledger's count every minute. The report is stored before anything is attempted and stays until the pass and its
   * published observation are done: a worker killed anywhere in between leaves it for the next tick. Reports made before
   * a pass share it; one that arrives during it is kept for the next.
   */
  async deliverDeposits(chainId: string) {
    await requireActiveChain(this.env.IDENTITY, chainId);
    await raiseCause(this.ctx.storage, DELIVERY_DUE);
    return Effect.runPromise(
      this.shardSigning.withPermit(
        relayOperation("relay LORDS deposits", async () => {
          const previous = await this.ctx.storage.get<ShardObservation>("shardTick");
          const began = await beginCause(this.ctx.storage, DELIVERY_DUE, false);
          if (!began) return previous?.deposits ?? null;
          try {
            const result = await relayDeposits(await this.depositPorts(chainId, false));
            await this.ctx.storage.put("shardTick", { ...previous, deposits: result });
            await completeCause(this.ctx.storage, began);
            return result;
          } catch (error) {
            await retryCause(this.ctx.storage, began, DELIVERY_RETRY_SECONDS);
            throw error;
          }
        }),
      ),
    );
  }
  private async depositPorts(chainId: string, proofs: boolean) {
    const shard = await readRegisteredShard(this.env.IDENTITY, chainId);
    return {
      target: {
        ...shardConnection(shard),
        accountAddress: relayAccountAddress(shard),
        privateKey: this.env.SHARD_LEDGER_OPERATOR_PRIVATE_KEY,
      },
      heraldUrl: shard.url,
      ledger: {
        rpcUrl: this.env.L2_RPC_URL,
        address: ledgerAddress(this.env.ENVIRONMENT),
        chainId: await this.env.IDENTITY.l2ChainId(),
      },
      storage: this.ctx.storage,
      finals: durableFinalFacts(this.ctx.storage),
      obligations: this.ctx.storage,
      proofs,
      sign: cosignerClient(this.env.COSIGNER_URL, this.env.COSIGNER_TOKEN).deposit,
      mutate: (request: DepositMutation) => ledgerOf(this.env).depositMutation(request),
    };
  }
  /** The operator dealt with a deposit the shard credited and the ledger lost: its fault goes, no other work is touched. */
  async clearDepositFault(chainId: string, commitment: string, reason: string) {
    const fault = await clearDepositFault(this.ctx.storage, chainId, commitment, reason);
    return { id: fault.id, commitment: fault.commitment, row: fault.row };
  }
  async deposits(chainId: string, realmsId: string, before?: string) {
    return depositHistory(await this.depositPorts(chainId, false), realmsId, before);
  }
  async depositRetirement(chainId: string) {
    const shard = await readRegisteredShard(this.env.IDENTITY, chainId);
    return checkDepositRetirement({
      shard: { ...shardConnection(shard), heraldUrl: shard.url },
      ledger: {
        rpcUrl: this.env.L2_RPC_URL,
        address: ledgerAddress(this.env.ENVIRONMENT),
        chainId: await this.env.IDENTITY.l2ChainId(),
      },
    });
  }
  async depositMutation(request: DepositMutation) {
    const outcome = await Effect.runPromise(
      this.ledgerPermit(
        relayOperation("resolve deposit custody", async () =>
          mutateDeposit(
            ledgerCredentialsOf(this.env),
            await this.env.IDENTITY.l2ChainId(),
            request,
            cosignerClient(this.env.COSIGNER_URL, this.env.COSIGNER_TOKEN).deposit,
            {
              getAnchor: (key) => this.ctx.storage.get(key),
              putAnchor: (key, value) => this.ctx.storage.put(key, value),
            },
            (account) => this.principalWallet(account),
          ),
        ),
        [request.shard],
      ),
    );
    if (outcome.wrote) await this.ledgerWritten();
    return outcome.final;
  }
  private async publishPools(chainId: string, proofs: boolean) {
    const shard = await readRegisteredShard(this.env.IDENTITY, chainId);
    const target = {
      ...shardConnection(shard),
      accountAddress: relayAccountAddress(shard),
      privateKey: this.env.SHARD_LEDGER_OPERATOR_PRIVATE_KEY,
    };
    const ledger = {
      rpcUrl: this.env.L2_RPC_URL,
      address: ledgerAddress(this.env.ENVIRONMENT),
      finals: durableFinalFacts(this.ctx.storage),
      obligations: this.ctx.storage,
      proofs,
    };
    let unavailable: unknown;
    for (const publish of [publishFrontierPools, awardFrontierPrizes]) {
      try {
        await publish(target, shard.url, ledger);
      } catch (error) {
        unavailable ??= error;
      }
    }
    try {
      await sweepFrontierLords(
        target,
        shard.url,
        ledger,
        (settlement) => ledgerOf(this.env).settleFrontier(settlement),
        (claim) => this.payPrincipal(claim),
      );
    } catch (error) {
      unavailable ??= error;
    }
    if (unavailable) throw unavailable;
  }
  /** Identity answers for free: a principal whose player has no wallet is not read on the ledger. */
  private async principalWallet(account: string) {
    const realmsId = await this.env.IDENTITY.realmsIdForAccount(account);
    const wallet = realmsId ? await this.env.IDENTITY.linkedWallet(realmsId) : null;
    if (!wallet) throw new Error("principal_wallet_unavailable");
    return wallet;
  }
  /**
   * Identity answers for free, so a principal never tried and with no linked wallet costs the ledger nothing. Once a
   * payment was tried, the ledger decides: a reply that was lost recognizes the payment even after the wallet unlinks.
   */
  private async payPrincipal(claim: PrincipalSweep) {
    const tried = `principal-tried:${BigInt(claim.chainId)}:${claim.gameId}:${BigInt(claim.account)}`;
    if ((await this.ctx.storage.get(tried)) === undefined) {
      await this.principalWallet(claim.account);
      await this.ctx.storage.put(tried, true);
    }
    return ledgerOf(this.env).depositMutation({
      kind: "principal",
      shard: claim.chainId,
      season: claim.gameId,
      account: claim.account,
      amount: claim.amount,
    });
  }

  async settleFrontier(settlement: FrontierSettlement) {
    await Effect.runPromise(
      this.ledgerPermit(
        relayOperation("settle Frontier season", () =>
          settleFrontier(
            ledgerCredentialsOf(this.env),
            settlement,
            cosignerClient(this.env.COSIGNER_URL, this.env.COSIGNER_TOKEN),
          ),
        ),
        [settlement.chainId],
      ),
    );
    await this.ledgerWritten();
  }
  async alarm() {
    await this.tick();
  }
  private async portsFor(chainId: string) {
    const bound = await this.ctx.storage.get<string>("chain");
    if (bound && BigInt(bound) !== BigInt(chainId)) throw new Error("actor_chain_differs");
    await requireActiveChain(this.env.IDENTITY, chainId);
    const shard = await readRegisteredShard(this.env.IDENTITY, chainId);
    return relayPortsOf(this.env, shard);
  }
  async reportMany(rows: readonly import("./ports").Withdrawal[]) {
    return this.announcingPaid(
      await Effect.runPromise(
        this.ledgerPermit(
          relayEffect("reportMany ledger claims", () =>
            ledgerBatches(
              ledgerCredentialsOf(this.env),
              (decisions) => this.env.IDENTITY.recordPayDecisions(decisions),
              cosignerClient(this.env.COSIGNER_URL, this.env.COSIGNER_TOKEN),
            ).reportMany(rows),
          ),
          rows.map((row) => row.chainId),
        ),
      ),
    );
  }
  async payMany(rows: readonly import("./ports").PayableClaim[]) {
    return this.announcingPaid(
      await Effect.runPromise(
        this.ledgerPermit(
          relayEffect("payMany ledger claims", () =>
            ledgerBatches(
              ledgerCredentialsOf(this.env),
              (decisions) => this.env.IDENTITY.recordPayDecisions(decisions),
              cosignerClient(this.env.COSIGNER_URL, this.env.COSIGNER_TOKEN),
            ).payMany(rows),
          ),
          rows.map((row) => row.withdrawal.chainId),
        ),
      ),
    );
  }
  /** A batch that wrote at least one claim is a cause to audit; a batch the ledger refused is not. */
  private async announcingPaid(outcomes: import("./ports").ClaimOutcome[]) {
    if (outcomes.some((outcome) => outcome.error === null)) await this.ledgerWritten();
    return outcomes;
  }
  async postResult(result: import("./ports").BlitzResult) {
    await Effect.runPromise(
      this.ledgerPermit(
        relayOperation("verify and post paid game results", () =>
          postVerifiedResult(
            result,
            (chainId, gameId) => this.env.ROSTER_MONITOR.verifyRoster(chainId, gameId),
            (slotId) => ledgerResultAdapter(ledgerCredentialsOf(this.env), slotId),
          ),
        ),
        [result.chainId],
      ),
    );
    await this.ledgerWritten();
    try {
      await this.env.IDENTITY.ratingsChanged();
    } catch {
      /* The identity service's own hour still refreshes the ratings if this notice is lost. */
    }
  }
  async shardHealth() {
    const progress = await this.store.progress();
    const observation = await this.ctx.storage.get<{
      checked_at: number;
      value: { status: string };
      funding_error: string | null;
      deposits?: { error?: string | { obligation: string; error: string }[] | null };
    }>("shardTick");
    return {
      ...progress,
      ...observation,
      success:
        observation?.value.status === "ready" &&
        observation.funding_error === null &&
        !!observation.deposits &&
        !observation.deposits.error &&
        !progress.halted &&
        Date.now() / 1000 - (observation?.checked_at ?? 0) <= 300,
    };
  }
  async reset(chainId: string, row: string, reason: string) {
    return Effect.runPromise(
      this.ingesting.withPermit(
        relayOperation("reset relay row", async () => {
          const ports = await this.portsFor(chainId);
          const progress = await this.store.progress();
          if (progress.halted !== row) throw new Error("fault_row_mismatch");
          const payment = await ledgerResetPayments(this.env.L2_RPC_URL, ledgerAddress(this.env.ENVIRONMENT));
          return this.store.resetFromChain(row, reason, {
            head: () => Effect.runPromise(ports.shard.confirmedHead()),
            hash: (number) => Effect.runPromise(ports.shard.blockHash(number)),
            paid: async (withdrawal) =>
              (await Effect.runPromise(onIdentityChain(this.env.L2_RPC_URL, this.env.IDENTITY, payment(withdrawal))))
                ?.paid ?? false,
          });
        }),
      ),
    );
  }
  async ledgerHealth() {
    const observation = await this.ctx.storage.get<{
      checked_at: number;
      chests: { failed: number } | null;
      seasons?: string | null | { error: string };
    }>("lastTick");
    const success =
      observation !== undefined &&
      observation.chests !== null &&
      observation.chests.failed === 0 &&
      observation.seasons === null;
    return {
      service: "value-relay",
      success,
      checked_at: observation?.checked_at ?? null,
      jobs: observation ?? null,
    };
  }
  async realmEntry(claim: RealmEntryClaim) {
    const result = await Effect.runPromise(
      this.shardSigning.withPermit(
        Effect.result(
          Effect.tryPromise({
            try: async () => {
              await this.portsFor(claim.chainId);
              const progress = await this.store.progress();
              if (progress.halted) throw new Error("relay_halted_or_wrong_chain");
              const shard = await readRegisteredShard(this.env.IDENTITY, claim.chainId);
              return registerHomeSource(
                {
                  connection: shardConnection(shard),
                  heraldUrl: shard.url,
                  operatorAddress: relayAccountAddress(shard),
                  privateKey: this.env.SHARD_LEDGER_OPERATOR_PRIVATE_KEY,
                  identity: this.env.IDENTITY,
                },
                claim,
              );
            },
            catch: (error) => error,
          }),
        ),
      ),
    );
    if (Result.isFailure(result)) {
      const error = result.failure;
      return {
        error:
          error instanceof PlayerRequestError
            ? { status: error.status, code: error.code }
            : { status: 503, code: "value_service_unavailable" },
      };
    }
    return { entry: result.success };
  }
  async labor(claim: LaborClaim) {
    const relay = this;
    return Effect.runPromise(
      this.shardSigning.withPermit(
        Effect.gen(function* () {
          const progress = yield* relayOperation("read relay progress", () => relay.store.progress());
          const ports = yield* relayOperation("read official labor shard", () => relay.portsFor(claim.chainId));
          const shard = yield* relayOperation("read official labor manifest", () =>
            readRegisteredShard(relay.env.IDENTITY, claim.chainId),
          );
          if (progress.halted) return yield* Effect.fail(new Error("relay_halted_or_wrong_chain"));
          const day = yield* currentLaborDay(shardConnection(shard), shard.url, claim.gameId);
          if (claim.day !== day) return yield* Effect.fail(new RelayFailure({ operation: "labor_day_differs" }));
          return yield* grantDailyLabor(ports, claim);
        }),
      ),
    );
  }
  async openSlot(key: LedgerSlotKey, window: { start: number; end: number }) {
    await this.requireLaunchSlot(key);
    const shard = (await this.env.IDENTITY.shards()).find((row) => BigInt(row.chainId) === BigInt(key.chainId));
    if (shard?.status !== "active") throw new Error("new_slot_requires_active_shard");
    return Effect.runPromise(
      this.ledgerPermit(
        relayEffect("write ledger slot", () => openSlotOnLedger(ledgerCredentialsOf(this.env), key, window)),
        [key.chainId],
      ),
    );
  }
  async slot(key: LedgerSlotKey) {
    await this.requireLaunchSlot(key);
    return Effect.runPromise(
      onIdentityChain(
        this.env.L2_RPC_URL,
        this.env.IDENTITY,
        relayOperation("read ledger slot", () =>
          readLedgerSlot(rpcAt(this.env.L2_RPC_URL), ledgerAddress(this.env.ENVIRONMENT), key, "latest"),
        ),
      ),
    );
  }
  async registrations(query: RegistrationQuery) {
    await this.requireLaunchSlot(query);
    return Effect.runPromise(
      onIdentityChain(
        this.env.L2_RPC_URL,
        this.env.IDENTITY,
        relayOperation("read closed slot registrations", () =>
          readRegistrationPage(rpcAt(this.env.L2_RPC_URL), ledgerAddress(this.env.ENVIRONMENT), query),
        ),
      ),
    );
  }
  async markRefundable(key: LedgerSlotKey, wallets: readonly string[]) {
    await this.requireLaunchSlot(key);
    return Effect.runPromise(
      this.ledgerPermit(
        relayEffect("write ledger slot", () => markSlotRefundable(ledgerCredentialsOf(this.env), key, wallets)),
        [key.chainId],
      ),
    );
  }
  async refundSlot(key: LedgerSlotKey) {
    await this.requireLaunchSlot(key);
    return Effect.runPromise(
      this.ledgerPermit(
        relayEffect("write ledger slot", () => refundSlotOnLedger(ledgerCredentialsOf(this.env), key)),
        [key.chainId],
      ),
    );
  }
  private async requireLaunchSlot(key: LedgerSlotKey) {
    if (!Number.isInteger(key.slotId) || key.slotId <= 0 || key.slotId > 0xffffffff)
      throw new Error("wrong_launch_chain_or_slot");
    await requireActiveChain(this.env.IDENTITY, key.chainId);
  }
  async shardHeld() {
    return (await this.store.held()).map((row) => ({
      kind: row.kind,
      reason: row.reason,
      transactionHash:
        row.kind === "receipt"
          ? row.receipt.transactionHash
          : row.kind === "payment"
            ? row.withdrawal.transactionHash
            : row.kind === "row"
              ? row.row.transactionHash
              : null,
      ...(row.kind === "result" ? { gameId: row.result.gameId } : {}),
    }));
  }
  async status() {
    return this.store.progress();
  }
}

type LedgerPermit = <A>(effect: import("./ports").RelayEffect<A>) => import("./ports").RelayEffect<A>;
const relayPortsOf = (env: RelayEnv, shard: Awaited<ReturnType<typeof readRegisteredShard>>): RelayPorts => {
  const reader = new ShardReader(shardConnection(shard));
  return {
    identity: identityAdapter(env.IDENTITY),
    ledger: {
      payment: (row) =>
        relayEffect("read ledger payment", () =>
          ledgerPaymentRead(env.L2_RPC_URL, ledgerAddress(env.ENVIRONMENT))(row),
        ),
      paymentProof: (row) =>
        relayEffect("read ledger payment proof", () =>
          ledgerPaymentProof(env.L2_RPC_URL, ledgerAddress(env.ENVIRONMENT))(row),
        ),
      voided: (row) =>
        relayEffect("read ledger voided", () =>
          ledgerWithdrawalVoided(env.L2_RPC_URL, ledgerAddress(env.ENVIRONMENT))(row),
        ),
      reportMany: (rows) => relayOperation("report withdrawal page", () => ledgerOf(env).reportMany(rows)),
      payMany: (rows) => relayOperation("pay withdrawal page", () => ledgerOf(env).payMany(rows)),
      postResult: (row) => relayOperation("post shard result", () => ledgerOf(env).postResult(row)),
    },
    shard: {
      ...shardWithdrawalPorts(
        reader,
        frontierReceiptBindings(
          reader,
          () => ({ rpcUrl: env.L2_RPC_URL, address: ledgerAddress(env.ENVIRONMENT) }),
          env.IDENTITY,
          shard.url,
        ),
      ),
      grantLabor: (claim) =>
        relayOperation("grant on official shard", async () => {
          await requireActiveChain(env.IDENTITY, claim.chainId);
          return Effect.runPromise(
            writeLaborGrant(
              {
                connection: shardConnection(shard),
                operatorAddress: relayAccountAddress(shard),
                privateKey: env.SHARD_LEDGER_OPERATOR_PRIVATE_KEY,
              },
              claim,
            ),
          );
        }),
    },
  };
};
const ledgerCredentialsOf = (env: RelayEnv) => ({
  rpcUrl: env.L2_RPC_URL,
  ...ledgerContractOf(env.ENVIRONMENT),
  accountAddress: env.LEDGER_OPERATOR_ADDRESS,
  privateKey: env.LEDGER_OPERATOR_PRIVATE_KEY,
});

const chestPortsOf = (env: RelayEnv, permit: LedgerPermit) => ({
  ...chestLedgerReads({ rpcUrl: env.L2_RPC_URL, ...ledgerContractOf(env.ENVIRONMENT) }),
  finish: (tokenId: string) => permit(finishChestOnLedger(ledgerCredentialsOf(env), tokenId)),
});

const relayOf = (env: RelayEnv, chainId: string) =>
  env.RELAY.get(env.RELAY.idFromName(`0x${BigInt(chainId).toString(16)}`));
const ledgerOf = (env: RelayEnv) =>
  env.RELAY.get(
    env.RELAY.idFromName(
      ledgerStateName(
        "ledger",
        ledgerOrNull(() => ledgerAddress(env.ENVIRONMENT)),
      ),
    ),
  );
const heldOf = async (env: RelayEnv) =>
  (await Promise.all((await env.IDENTITY.shards()).map((shard) => relayOf(env, shard.chainId).shardHeld()))).flat();
const healthOf = async (env: RelayEnv) => {
  const ledger = await ledgerOf(env).ledgerHealth();
  const shards = await Promise.all(
    (await activeShards(env.IDENTITY)).map(async (shard) => ({
      chainId: shard.chainId,
      ...(await relayOf(env, shard.chainId).shardHealth()),
    })),
  );
  return { ...ledger, success: ledger.success && shards.every((row) => row.success), shards, held: await heldOf(env) };
};
/** Diagnostics expose reasons only; the monitor independently verifies contract evidence. */
export class RelayDiagnostics extends WorkerEntrypoint<RelayEnv> {
  override fetch() {
    return new Response(null, { status: 404 });
  }
  held() {
    return heldOf(this.env);
  }
  /** The monitor's operator reset follows an admin's void of a report: the held honest claims are asked about now. */
  async recoverHeld() {
    for (const shard of await activeShards(this.env.IDENTITY))
      await relayOf(this.env, shard.chainId).requestReconcile();
  }
}
export class ValueLaunch extends WorkerEntrypoint<RelayEnv> {
  override fetch() {
    return new Response(null, { status: 404 });
  }
  slot(key: LedgerSlotKey) {
    return ledgerOf(this.env).slot(key);
  }
  registrations(query: RegistrationQuery) {
    return ledgerOf(this.env).registrations(query);
  }
  openSlot(key: LedgerSlotKey, window: { start: number; end: number }) {
    return ledgerOf(this.env).openSlot(key, window);
  }
  markRefundable(key: LedgerSlotKey, wallets: readonly string[]) {
    return ledgerOf(this.env).markRefundable(key, wallets);
  }
  refundSlot(key: LedgerSlotKey) {
    return ledgerOf(this.env).refundSlot(key);
  }
  async verifyFrontierExtension() {
    await requireActiveChain(this.env.IDENTITY, approvedExtension.chainId);
    const shard = await readRegisteredShard(this.env.IDENTITY, approvedExtension.chainId);
    return requireExtendedFrontier(await readFrontierExtension(shardConnection(shard), shard.url, this.env.L2_RPC_URL));
  }
}
export default {
  async fetch(request: Request, raw: RelayEnv): Promise<Response> {
    const env = { ...raw, ...decodeRelaySettings(raw) };
    if (new URL(request.url).pathname === "/api/value/operator/campaign-entry" && request.method === "POST")
      return operatorCampaignEntry(request, env, "recover");
    if (new URL(request.url).pathname === "/api/value/operator/campaign-upgrade" && request.method === "POST")
      return operatorCampaignEntry(request, env, "upgrade");
    if (new URL(request.url).pathname === "/api/value/operator/deposit-retirement" && request.method === "POST") {
      if (!(await presentsOperatorToken(request, env.OPERATOR_TOKEN))) return new Response(null, { status: 401 });
      const body = (await request.json().catch(() => null)) as { chainId?: unknown } | null;
      if (
        !body ||
        typeof body !== "object" ||
        Object.keys(body).join() !== "chainId" ||
        typeof body.chainId !== "string" ||
        !/^0x[0-9a-f]+$/i.test(body.chainId)
      )
        return Response.json({ error: "invalid_chain" }, { status: 400 });
      try {
        return Response.json(await relayOf(env, body.chainId).depositRetirement(body.chainId), {
          headers: { "cache-control": "no-store" },
        });
      } catch {
        return Response.json({ error: "deposit_retirement_not_ready" }, { status: 409 });
      }
    }
    if (new URL(request.url).pathname === "/api/value/operator/deposit-fault" && request.method === "POST") {
      if (!(await presentsOperatorToken(request, env.OPERATOR_TOKEN)))
        return Response.json({ error: "unauthorized" }, { status: 401 });
      const body = (await request.json().catch(() => null)) as {
        chainId?: unknown;
        commitment?: unknown;
        reason?: unknown;
      } | null;
      if (
        !body ||
        typeof body.chainId !== "string" ||
        !/^0x[0-9a-f]+$/i.test(body.chainId) ||
        typeof body.commitment !== "string" ||
        !/^0x[0-9a-f]+$/i.test(body.commitment) ||
        typeof body.reason !== "string" ||
        !body.reason.trim() ||
        body.reason.length > 500 ||
        Object.keys(body).sort().join() !== "chainId,commitment,reason"
      )
        return Response.json({ error: "deposit_fault_commitment_and_reason_required" }, { status: 400 });
      try {
        return Response.json(
          await relayOf(env, body.chainId).clearDepositFault(body.chainId, body.commitment, body.reason),
        );
      } catch {
        return Response.json({ error: "deposit_fault_unknown" }, { status: 409 });
      }
    }
    if (new URL(request.url).pathname === "/api/value/operator/reset" && request.method === "POST") {
      if (!(await presentsOperatorToken(request, env.OPERATOR_TOKEN)))
        return Response.json({ error: "unauthorized" }, { status: 401 });
      const body = (await request.json().catch(() => null)) as {
        chainId?: unknown;
        row?: unknown;
        reason?: unknown;
      } | null;
      if (
        !body ||
        typeof body.chainId !== "string" ||
        !/^0x[0-9a-f]+$/i.test(body.chainId) ||
        typeof body.row !== "string" ||
        !body.row ||
        typeof body.reason !== "string" ||
        !body.reason.trim() ||
        body.reason.length > 500 ||
        Object.keys(body).sort().join() !== "chainId,reason,row"
      )
        return Response.json({ error: "reset_row_and_reason_required" }, { status: 400 });
      try {
        const reset = await relayOf(env, body.chainId as string).reset(body.chainId as string, body.row, body.reason);
        await relayOf(env, body.chainId as string).requestReconcile();
        return Response.json(reset);
      } catch {
        return Response.json({ error: "fault_row_mismatch_or_unavailable" }, { status: 409 });
      }
    }

    if (new URL(request.url).pathname === "/api/value/chests/finish" && request.method === "POST")
      return finishChestResponse(request, env);

    if (new URL(request.url).pathname === "/api/value/realm-entry" && request.method === "POST") {
      const chainId = new URL(request.url).searchParams.get("chainId");
      if (!chainId || !/^0x[0-9a-f]+$/i.test(chainId))
        return Response.json({ error: "shard_chain_required" }, { status: 400 });
      return handleRealmEntryRequest(request, {
        chainId,
        origin: env.BASE_URL,
        authenticate: (cookie) => env.IDENTITY.authenticate(cookie),
        accountForRealmsId: (id) => env.IDENTITY.accountForRealmsId(id),
        register: async (claim) => {
          const result = await relayOf(env, claim.chainId).realmEntry(claim);
          if (result.error) throw new PlayerRequestError(result.error.status, result.error.code);
          return result.entry;
        },
      });
    }
    if (new URL(request.url).pathname === "/api/value/held-realms" && request.method === "POST")
      return handleHeldRealmsRequest(request, {
        origin: env.BASE_URL,
        authenticate: (cookie) => env.IDENTITY.authenticate(cookie),
        accountForRealmsId: (id) => env.IDENTITY.accountForRealmsId(id),
        identity: env.IDENTITY,
      });
    if (new URL(request.url).pathname === "/api/value/labor" && request.method === "POST") {
      const chainId = new URL(request.url).searchParams.get("chainId");
      if (!chainId || !/^0x[0-9a-f]+$/i.test(chainId))
        return Response.json({ error: "shard_chain_required" }, { status: 400 });
      await requireActiveChain(env.IDENTITY, chainId);
      const shard = await readRegisteredShard(env.IDENTITY, chainId);
      return handleLaborRequest(request, {
        origin: env.BASE_URL,
        chainId,
        accountForRealmsId: (id) => env.IDENTITY.accountForRealmsId(id),
        authenticate: (cookie) => env.IDENTITY.authenticate(cookie),
        currentDay: (gameId) => currentLaborDay(shardConnection(shard), shard.url, gameId),
        grant: (claim) => relayOf(env, claim.chainId).labor(claim),
      });
    }
    if (new URL(request.url).pathname === "/api/value/deposits" && request.method === "GET") {
      const url = new URL(request.url);
      const chain = url.searchParams.get("chainId");
      if (!chain || !/^0x[0-9a-f]+$/i.test(chain)) return Response.json({ error: "invalid_chain" }, { status: 400 });
      const identity = await env.IDENTITY.authenticate(request.headers.get("cookie") ?? "");
      if (!identity) return Response.json({ error: "unauthorized" }, { status: 401 });
      try {
        return Response.json(
          await relayOf(env, chain).deposits(chain, identity.realmsId, url.searchParams.get("before") ?? undefined),
          { headers: { "cache-control": "no-store" } },
        );
      } catch {
        return Response.json({ error: "deposit_status_unavailable" }, { status: 503 });
      }
    }
    if (new URL(request.url).pathname === "/api/value/deposits/deliver" && request.method === "POST")
      return deliverDepositsResponse(request, env);
    if (new URL(request.url).pathname !== "/api/value/health" || request.method !== "GET")
      return new Response(null, { status: 404 });
    const health = await healthOf(env);
    return Response.json(health, { status: health.success ? 200 : 503, headers: { "cache-control": "no-store" } });
  },
  async scheduled(controller: ScheduledController, raw: RelayEnv): Promise<void> {
    const env = { ...raw, ...decodeRelaySettings(raw) };
    const hourly = isLedgerReadTick(controller.scheduledTime);
    try {
      await ledgerOf(env).ledgerTickIfDue(hourly);
    } catch {
      console.error("ledger_tick_unavailable");
    }
    for (const shard of await activeShards(env.IDENTITY)) {
      try {
        await relayOf(env, shard.chainId).tick(shard.chainId, hourly);
      } catch {
        /* One unavailable shard must not suppress another shard. */
      }
    }
  },
};

/**
 * POST /api/value/chests/finish?tokenId=N, from a signed-in player's page on our origin: the relay sends open_finish
 * only for a requested chest whose draw is readable, once. The answer is the chest's state: drawing with its blocks
 * left, or finished.
 */
const finishChestResponse = async (request: Request, env: RelayEnv) => {
  if (request.headers.get("origin") !== new URL(env.BASE_URL).origin)
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  if (!(await env.IDENTITY.authenticate(request.headers.get("cookie") ?? "")))
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  const tokenId = new URL(request.url).searchParams.get("tokenId");
  if (!tokenId || !/^[0-9]{1,78}$/.test(tokenId) || BigInt(tokenId) >= 2n ** 256n)
    return Response.json({ error: "chest_token_required" }, { status: 400 });
  try {
    return Response.json(await ledgerOf(env).finishChest(tokenId), { headers: { "cache-control": "no-store" } });
  } catch {
    console.error("chest_finish_unavailable", { tokenId });
    return Response.json({ error: "chest_finish_unavailable" }, { status: 503 });
  }
};

/** POST /api/value/deposits/deliver?chainId=0x…, from a signed-in player's page on our origin once its deposit landed. */
const deliverDepositsResponse = async (request: Request, env: RelayEnv) => {
  if (request.headers.get("origin") !== new URL(env.BASE_URL).origin)
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  if (!(await env.IDENTITY.authenticate(request.headers.get("cookie") ?? "")))
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  const chain = new URL(request.url).searchParams.get("chainId");
  if (!chain || !/^0x[0-9a-f]+$/i.test(chain)) return Response.json({ error: "invalid_chain" }, { status: 400 });
  try {
    return Response.json(await relayOf(env, chain).deliverDeposits(chain), {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    console.error("deposit_delivery_unavailable");
    return Response.json({ error: "deposit_delivery_unavailable" }, { status: 503 });
  }
};

const relayEffect = <A, E>(operation: string, make: () => Effect.Effect<A, E>) =>
  relayOperation(operation, () => Effect.runPromise(make()));

/** Identity supplies the awarded ticket; operator requests cannot choose a tier, account or held Realm. */
async function operatorCampaignEntry(
  request: Request,
  env: RelayEnv,
  action: "recover" | "upgrade",
): Promise<Response> {
  if (!(await presentsOperatorToken(request, env.OPERATOR_TOKEN)))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    chainId?: unknown;
    gameId?: unknown;
    realmsId?: unknown;
  } | null;
  if (
    !body ||
    Object.keys(body).sort().join() !== "chainId,gameId,realmsId" ||
    typeof body.chainId !== "string" ||
    !/^0x[0-9a-f]{1,64}$/i.test(body.chainId) ||
    typeof body.realmsId !== "string" ||
    !/^0x[0-9a-f]{1,64}$/i.test(body.realmsId) ||
    typeof body.gameId !== "number" ||
    !Number.isSafeInteger(body.gameId) ||
    body.gameId <= 0 ||
    body.gameId > 0xffffffff
  )
    return Response.json({ error: "invalid_realm_entry" }, { status: 400 });
  try {
    const account = await env.IDENTITY.accountForRealmsId(body.realmsId);
    if (!account) return Response.json({ error: "account_unavailable" }, { status: 404 });
    const result = await relayOf(env, body.chainId).realmEntry({
      chainId: body.chainId,
      gameId: body.gameId,
      realmsId: body.realmsId,
      account,
      realmId: null,
      ...(action === "recover" ? { recoverFlyer: true as const } : { upgradeCampaign: true as const }),
    });
    if (result.error) return Response.json({ error: result.error.code }, { status: result.error.status });
    return Response.json(result.entry);
  } catch {
    return Response.json({ error: "value_service_unavailable" }, { status: 503 });
  }
}
