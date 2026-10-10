import {
  rpcAt,
  readLedgerGame,
  readRegisteredPlayers,
  readConfirmedLedgerHead,
  type LedgerRosterSnapshot,
} from "@realms-world/value-ledger";
import { processSeasonTops } from "./season-tops";
import { seasonLedgerReads, postSeasonTop, allocateSeason } from "./season-ledger";
import { ledgerBatches } from "./ledger-batches";
import { onIdentityChain } from "./ledger-chain";
import { paidGameEntry } from "./game-entry";
import { blitzDeadline, openBlitzOnLedger, refundBlitzOnLedger, validateBlitzWindow } from "./blitz-launch";
import type { LedgerGameKey } from "@realms-world/value-ledger";
import { currentLaborDay, writeLaborGrant } from "./shard-labor";
import { handleLaborRequest } from "./labor-route";
import { ShardReader } from "./shard-rpc";
import { frontierReceiptBindings } from "./frontier-binding";
import { shardResultPort } from "./shard-results";
import { shardWithdrawalPorts } from "./shard-withdrawals";
import { chestLedgerReads, finishChestOnLedger } from "./chest-ledger";
import { DurableChestStore, finishRequestedChests } from "./chests";
import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import { Effect, Result, Semaphore } from "effect";
import { ledgerResultAdapter } from "./ledger";
import { ledgerPaymentRead, ledgerWithdrawalVoided } from "./chain";
import { presentsOperatorToken } from "@realms-world/identity";
import { identityAdapter } from "./adapters";
import { runRelay, grantDailyLabor } from "./relay";
import { DurableRelayStore } from "./state";
import { RelayFailure, relayOperation, type RelayPorts, type LaborClaim } from "./ports";

interface RelayEnv {
  OPERATOR_TOKEN: string;
  SHARD_HERALD_URL: string;
  SHARD_CHAIN_ID: string;
  BASE_URL: string;
  SHARD_LEDGER_OPERATOR_ADDRESS: string;
  SHARD_LEDGER_OPERATOR_PRIVATE_KEY: string;
  SHARD_RPC_URL: string;
  SHARD_GAMES_ADDRESS: string;
  LEDGER_RPC_URL: string;
  LEDGER_ADDRESS: string;
  LEDGER_OPERATOR_ADDRESS: string;
  LEDGER_OPERATOR_PRIVATE_KEY: string;
  IDENTITY: {
    l2ChainId(): Promise<string>;
    realmOwnerOf(realmId: string): Promise<string>;
    recordPayDecisions(decisions: import("@realms-world/identity").LedgerPayDecision[]): Promise<void>;
    payoutWallet(id: string): Promise<import("@realms-world/identity").PayoutWallet>;
    linkedWallet(id: string): Promise<string | null>;
    authenticate(cookie: string): Promise<{ realmsId: string } | null>;
    accountForRealmsId(id: string): Promise<string | null>;
    realmsIdForAccount(account: string): Promise<string | null>;
  };
  RELAY: DurableObjectNamespace<ValueRelay>;
}

/** A single transaction stream per official chain, isolated from the shard host. */
export class ValueRelay extends DurableObject<RelayEnv> {
  private readonly ledgerSigning = Semaphore.makeUnsafe(1);
  private readonly shardSigning = Semaphore.makeUnsafe(1);
  private readonly ingesting = Semaphore.makeUnsafe(1);
  private readonly store = new DurableRelayStore(this.ctx.storage);
  private readonly ports = relayPortsOf(this.env, this.ctx.storage, (effect) => this.ledgerPermit(effect));
  private readonly chests = new DurableChestStore(this.ctx.storage);

  constructor(ctx: DurableObjectState, env: RelayEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(() => ctx.storage.setAlarm(Date.now()));
  }
  private ledgerPermit<A, E>(operation: Effect.Effect<A, E>) {
    return this.ledgerSigning.withPermit(onIdentityChain(this.env.LEDGER_RPC_URL, this.env.IDENTITY, operation));
  }
  override alarm() {
    return this.tick().then(() => undefined);
  }
  async tick() {
    const relay = this;
    return Effect.runPromise(
      this.ingesting.withPermit(
        Effect.gen(function* () {
          const seasons = yield* Effect.result(
            onIdentityChain(
              relay.env.LEDGER_RPC_URL,
              relay.env.IDENTITY,
              relayOperation("post season leaderboard", () =>
                Effect.runPromise(
                  processSeasonTops(
                    "post",
                    {
                      ...seasonLedgerReads(ledgerCredentialsOf(relay.env)),
                      allocate: (id, start) =>
                        Effect.runPromise(
                          relay.ledgerPermit(
                            relayOperation("allocate season prizes", () =>
                              allocateSeason(ledgerCredentialsOf(relay.env), id, start),
                            ),
                          ),
                        ),
                      post: (id, start, wallets) =>
                        Effect.runPromise(
                          relay.ledgerPermit(
                            relayOperation("post season top", () =>
                              postSeasonTop(ledgerCredentialsOf(relay.env), id, start, wallets),
                            ),
                          ),
                        ),
                    },
                    relay.ctx.storage,
                  ),
                ),
              ),
            ),
          );
          const value = yield* Effect.result(runRelay(relay.env.SHARD_CHAIN_ID, relay.ports, relay.store));
          const chests = yield* Effect.result(
            finishRequestedChests(
              chestPortsOf(relay.env, (effect) => relay.ledgerPermit(effect)),
              relay.chests,
            ),
          );
          const observation = {
            seasons: Result.isSuccess(seasons) ? seasons.success : { error: seasons.failure.operation },
            checked_at: Math.floor(Date.now() / 1000),
            value: Result.isSuccess(value) ? value.success : { status: "unavailable", reason: value.failure.operation },
            chests: Result.isSuccess(chests) ? chests.success : null,
          };
          yield* relayOperation("publish relay health", () => relay.ctx.storage.put("lastTick", observation));
          return observation;
        }),
      ),
    );
  }
  async reset(row: string, reason: string) {
    return Effect.runPromise(
      this.ingesting.withPermit(
        relayOperation("reset relay row", async () => {
          const progress = await this.store.progress();
          if (progress.halted !== row) throw new Error("fault_row_mismatch");
          return this.store.resetFromChain(row, reason, {
            head: () => Effect.runPromise(this.ports.shard.confirmedHead()),
            hash: (number) => Effect.runPromise(this.ports.shard.blockHash(number)),
            paid: async (withdrawal) =>
              (
                await Effect.runPromise(
                  onIdentityChain(this.env.LEDGER_RPC_URL, this.env.IDENTITY, this.ports.ledger.payment(withdrawal)),
                )
              )?.paid ?? false,
          });
        }),
      ),
    );
  }
  async health() {
    const observation = await this.ctx.storage.get<{
      checked_at: number;
      value: { status: string };
      chests: { failed: number } | null;
      seasons?: string | null | { error: string };
    }>("lastTick");
    const progress = await this.store.progress();
    const success =
      observation !== undefined &&
      observation.value.status === "ready" &&
      observation.chests !== null &&
      observation.chests.failed === 0 &&
      !progress.halted &&
      observation.seasons === null;
    return {
      service: "value-relay",
      success,
      checked_at: observation?.checked_at ?? null,
      jobs: observation ?? null,
      held: await this.held(),
      ...progress,
    };
  }
  async labor(claim: LaborClaim) {
    const relay = this;
    return Effect.runPromise(
      this.shardSigning.withPermit(
        Effect.gen(function* () {
          const progress = yield* relayOperation("read relay progress", () => relay.store.progress());
          if (BigInt(claim.chainId) !== BigInt(relay.env.SHARD_CHAIN_ID) || progress.halted)
            return yield* Effect.fail(new Error("relay_halted_or_wrong_chain"));
          const day = yield* currentLaborDay(shardConnectionOf(relay.env));
          if (claim.day !== day) return yield* Effect.fail(new RelayFailure({ operation: "labor_day_differs" }));
          return yield* grantDailyLabor(relay.ports, claim);
        }),
      ),
    );
  }
  async openBlitz(key: LedgerGameKey, window: { start: number; end: number }) {
    this.requireLaunchChain(key);
    const relay = this;
    return Effect.runPromise(
      this.ledgerPermit(
        Effect.gen(function* () {
          const entry = yield* paidGameEntry(relay.env.LEDGER_RPC_URL, relay.env.LEDGER_ADDRESS, key);
          yield* openBlitzOnLedger(ledgerCredentialsOf(relay.env), key, window);
          return entry;
        }),
      ),
    );
  }
  async blitzDeadline(key: LedgerGameKey) {
    this.requireLaunchChain(key);
    return Effect.runPromise(
      onIdentityChain(this.env.LEDGER_RPC_URL, this.env.IDENTITY, blitzDeadline(ledgerCredentialsOf(this.env), key)),
    );
  }
  async blitzRoster(key: LedgerGameKey): Promise<LedgerRosterSnapshot> {
    this.requireLaunchChain(key);
    return Effect.runPromise(
      onIdentityChain(
        this.env.LEDGER_RPC_URL,
        this.env.IDENTITY,
        relayOperation("read closed ledger roster", async () => {
          const provider = rpcAt(this.env.LEDGER_RPC_URL);
          const head = await readConfirmedLedgerHead(provider);
          const game = await readLedgerGame(provider, this.env.LEDGER_ADDRESS, key, head.number);
          if (game.cancelled || game.finalized) throw new Error("ledger_game_not_seatable");
          const secondsUntilClose = Math.max(0, game.start - head.time);
          const registrations = secondsUntilClose
            ? []
            : await readRegisteredPlayers(
                provider,
                this.env.LEDGER_ADDRESS,
                key,
                head.number,
                game.registeredCount,
                game.registrationLimit,
              );
          return {
            gameId: key.gameId,
            blockNumber: head.number,
            blockHash: head.hash,
            secondsUntilClose,
            end: game.end,
            registrations,
          };
        }),
      ),
    );
  }
  async validateBlitz(key: LedgerGameKey, window: { start: number; end: number }) {
    this.requireLaunchChain(key);
    return Effect.runPromise(
      onIdentityChain(
        this.env.LEDGER_RPC_URL,
        this.env.IDENTITY,
        validateBlitzWindow(ledgerCredentialsOf(this.env), key, window),
      ),
    );
  }
  async refundBlitz(key: LedgerGameKey) {
    this.requireLaunchChain(key);
    return Effect.runPromise(this.ledgerPermit(refundBlitzOnLedger(ledgerCredentialsOf(this.env), key)));
  }
  private requireLaunchChain(key: LedgerGameKey) {
    if (
      BigInt(key.chainId) !== BigInt(this.env.SHARD_CHAIN_ID) ||
      !Number.isInteger(key.gameId) ||
      key.gameId <= 0 ||
      key.gameId > 0xffffffff
    )
      throw new Error("wrong_launch_chain_or_game");
  }
  async held() {
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
const relayPortsOf = (env: RelayEnv, storage: DurableObjectStorage, permit: LedgerPermit): RelayPorts => {
  const reader = new ShardReader(shardConnectionOf(env));
  return {
    identity: identityAdapter(env.IDENTITY),
    ledger: ledgerPortsOf(env, permit),
    realms: {
      ownerOf: (realmId) => relayOperation("read Realm owner", () => env.IDENTITY.realmOwnerOf(realmId)),
    },
    shard: {
      ...shardWithdrawalPorts(
        reader,
        frontierReceiptBindings(
          reader,
          { rpcUrl: env.LEDGER_RPC_URL, address: env.LEDGER_ADDRESS },
          env.IDENTITY,
          env.SHARD_HERALD_URL,
          storage,
        ),
      ),
      result: shardResultPort(reader),
      grantLabor: (claim) =>
        writeLaborGrant(
          {
            connection: shardConnectionOf(env),
            operatorAddress: env.SHARD_LEDGER_OPERATOR_ADDRESS,
            privateKey: env.SHARD_LEDGER_OPERATOR_PRIVATE_KEY,
          },
          claim,
        ),
    },
  };
};
const shardConnectionOf = (env: RelayEnv) => ({
  rpcUrl: env.SHARD_RPC_URL,
  gamesAddress: env.SHARD_GAMES_ADDRESS,
  chainId: env.SHARD_CHAIN_ID,
});
const ledgerPortsOf = (env: RelayEnv, permit: LedgerPermit): RelayPorts["ledger"] => ({
  reportMany: (rows) =>
    permit(
      ledgerBatches(ledgerCredentialsOf(env), (decisions) => env.IDENTITY.recordPayDecisions(decisions)).reportMany(
        rows,
      ),
    ),
  payMany: (rows) =>
    permit(
      ledgerBatches(ledgerCredentialsOf(env), (decisions) => env.IDENTITY.recordPayDecisions(decisions)).payMany(rows),
    ),
  voided: (withdrawal) => ledgerWithdrawalVoided(env.LEDGER_RPC_URL, env.LEDGER_ADDRESS)(withdrawal),
  payment: (withdrawal) => ledgerPaymentRead(env.LEDGER_RPC_URL, env.LEDGER_ADDRESS)(withdrawal),
  postResult: (result) => permit(ledgerResultAdapter(ledgerCredentialsOf(env))(result)),
});
const ledgerCredentialsOf = (env: RelayEnv) => ({
  rpcUrl: env.LEDGER_RPC_URL,
  contractAddress: env.LEDGER_ADDRESS,
  accountAddress: env.LEDGER_OPERATOR_ADDRESS,
  privateKey: env.LEDGER_OPERATOR_PRIVATE_KEY,
});

const chestPortsOf = (env: RelayEnv, permit: LedgerPermit) => ({
  ...chestLedgerReads({ rpcUrl: env.LEDGER_RPC_URL, contractAddress: env.LEDGER_ADDRESS }),
  finish: (tokenId: string) => permit(finishChestOnLedger(ledgerCredentialsOf(env), tokenId)),
});

const relayOf = (env: RelayEnv) => env.RELAY.get(env.RELAY.idFromName(env.SHARD_CHAIN_ID));
/** Diagnostics expose reasons only; the monitor independently verifies contract evidence. */
export class RelayDiagnostics extends WorkerEntrypoint<RelayEnv> {
  override fetch() {
    return new Response(null, { status: 404 });
  }
  held() {
    return relayOf(this.env).held();
  }
}
export class ValueLaunch extends WorkerEntrypoint<RelayEnv> {
  override fetch() {
    return new Response(null, { status: 404 });
  }
  blitzDeadline(key: LedgerGameKey) {
    return relayOf(this.env).blitzDeadline(key);
  }
  blitzRoster(key: LedgerGameKey) {
    return relayOf(this.env).blitzRoster(key);
  }
  openBlitz(key: LedgerGameKey, window: { start: number; end: number }) {
    return relayOf(this.env).openBlitz(key, window);
  }
  validateBlitz(key: LedgerGameKey, window: { start: number; end: number }) {
    return relayOf(this.env).validateBlitz(key, window);
  }
  refundBlitz(key: LedgerGameKey) {
    return relayOf(this.env).refundBlitz(key);
  }
}
export default {
  async fetch(request: Request, env: RelayEnv): Promise<Response> {
    if (new URL(request.url).pathname === "/api/value/operator/reset" && request.method === "POST") {
      if (!(await presentsOperatorToken(request, env.OPERATOR_TOKEN)))
        return Response.json({ error: "unauthorized" }, { status: 401 });
      const body = (await request.json().catch(() => null)) as { row?: unknown; reason?: unknown } | null;
      if (
        !body ||
        typeof body.row !== "string" ||
        !body.row ||
        typeof body.reason !== "string" ||
        !body.reason.trim() ||
        body.reason.length > 500 ||
        Object.keys(body).sort().join() !== "reason,row"
      )
        return Response.json({ error: "reset_row_and_reason_required" }, { status: 400 });
      try {
        return Response.json(await relayOf(env).reset(body.row, body.reason));
      } catch {
        return Response.json({ error: "fault_row_mismatch_or_unavailable" }, { status: 409 });
      }
    }

    if (new URL(request.url).pathname === "/api/value/labor" && request.method === "POST")
      return handleLaborRequest(request, {
        origin: env.BASE_URL,
        chainId: env.SHARD_CHAIN_ID,
        accountForRealmsId: (id) => env.IDENTITY.accountForRealmsId(id),
        authenticate: (cookie) => env.IDENTITY.authenticate(cookie),
        currentDay: () => currentLaborDay(shardConnectionOf(env)),
        grant: (claim) => relayOf(env).labor(claim),
      });
    if (new URL(request.url).pathname !== "/health") return new Response(null, { status: 404 });
    const health = await relayOf(env).health();
    return Response.json(health, { status: health.success ? 200 : 503, headers: { "cache-control": "no-store" } });
  },
  async scheduled(_controller: ScheduledController, env: RelayEnv): Promise<void> {
    await relayOf(env).tick();
  },
};
