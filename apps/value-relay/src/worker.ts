import {
  activeShards,
  requireActiveChain,
  readRegisteredShard,
  type ShardDirectory,
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
  BASE_URL: string;
  SHARD_LEDGER_OPERATOR_ADDRESS: string;
  SHARD_LEDGER_OPERATOR_PRIVATE_KEY: string;
  LEDGER_RPC_URL: string;
  LEDGER_ADDRESS: string;
  LEDGER_OPERATOR_ADDRESS: string;
  LEDGER_OPERATOR_PRIVATE_KEY: string;
  IDENTITY: ShardDirectory & {
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
  private readonly chests = new DurableChestStore(this.ctx.storage);

  private ledgerPermit<A, E>(operation: Effect.Effect<A, E>, chains: readonly string[] = []) {
    return this.ledgerSigning.withPermit(
      relayOperation("verify official value chain", async () => {
        for (const chain of new Set(chains)) await requireActiveChain(this.env.IDENTITY, chain);
      }).pipe(Effect.andThen(onIdentityChain(this.env.LEDGER_RPC_URL, this.env.IDENTITY, operation))),
    );
  }
  async ledgerTick() {
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
          const chests = yield* Effect.result(
            finishRequestedChests(
              chestPortsOf(relay.env, (effect) => relay.ledgerPermit(effect)),
              relay.chests,
            ),
          );
          const observation = {
            seasons: Result.isSuccess(seasons) ? seasons.success : { error: seasons.failure.operation },
            checked_at: Math.floor(Date.now() / 1000),
            chests: Result.isSuccess(chests) ? chests.success : null,
          };
          yield* relayOperation("publish relay health", () => relay.ctx.storage.put("lastTick", observation));
          return observation;
        }),
      ),
    );
  }
  async tick(chainId?: string) {
    const chain = chainId ?? (await this.ctx.storage.get<string>("chain"));
    if (!chain) return { status: "unavailable" as const, reason: "actor_chain_unbound" };
    const relay = this;
    const outcome = await Effect.runPromise(
      Effect.result(
        this.ingesting.withPermit(
          relayOperation("advance official shard", async () => {
            const ports = await relay.portsFor(chain);
            const previous = await relay.ctx.storage.get<string>("chain");
            if (previous && BigInt(previous) !== BigInt(chain)) throw new Error("actor_chain_differs");
            await relay.ctx.storage.put("chain", chain);
            const value = await Effect.runPromise(
              Effect.result(
                onIdentityChain(relay.env.LEDGER_RPC_URL, relay.env.IDENTITY, runRelay(chain, ports, relay.store)),
              ),
            );
            const observation = {
              checked_at: Math.floor(Date.now() / 1000),
              value: Result.isSuccess(value)
                ? value.success
                : { status: "unavailable", reason: value.failure.operation },
            };
            await relay.ctx.storage.put("shardTick", observation);
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
    return observation;
  }
  private async portsFor(chainId: string) {
    const bound = await this.ctx.storage.get<string>("chain");
    if (bound && BigInt(bound) !== BigInt(chainId)) throw new Error("actor_chain_differs");
    await requireActiveChain(this.env.IDENTITY, chainId);
    const shard = await readRegisteredShard(this.env.IDENTITY, chainId);
    return relayPortsOf(this.env, this.ctx.storage, shard);
  }
  reportMany(rows: readonly import("./ports").Withdrawal[]) {
    return Effect.runPromise(
      this.ledgerPermit(
        ledgerBatches(ledgerCredentialsOf(this.env), (decisions) =>
          this.env.IDENTITY.recordPayDecisions(decisions),
        ).reportMany(rows),
        rows.map((row) => row.chainId),
      ),
    );
  }
  payMany(rows: readonly import("./ports").PayableClaim[]) {
    return Effect.runPromise(
      this.ledgerPermit(
        ledgerBatches(ledgerCredentialsOf(this.env), (decisions) =>
          this.env.IDENTITY.recordPayDecisions(decisions),
        ).payMany(rows),
        rows.map((row) => row.withdrawal.chainId),
      ),
    );
  }
  postResult(result: import("./ports").BlitzResult) {
    return Effect.runPromise(
      this.ledgerPermit(ledgerResultAdapter(ledgerCredentialsOf(this.env))(result), [result.chainId]),
    );
  }
  async shardHealth() {
    const progress = await this.store.progress();
    const observation = await this.ctx.storage.get<{ checked_at: number; value: { status: string } }>("shardTick");
    return {
      ...progress,
      ...observation,
      success:
        observation?.value.status === "ready" &&
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
          return this.store.resetFromChain(row, reason, {
            head: () => Effect.runPromise(ports.shard.confirmedHead()),
            hash: (number) => Effect.runPromise(ports.shard.blockHash(number)),
            paid: async (withdrawal) =>
              (
                await Effect.runPromise(
                  onIdentityChain(this.env.LEDGER_RPC_URL, this.env.IDENTITY, ports.ledger.payment(withdrawal)),
                )
              )?.paid ?? false,
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
          const day = yield* currentLaborDay(connectionOf(shard));
          if (claim.day !== day) return yield* Effect.fail(new RelayFailure({ operation: "labor_day_differs" }));
          return yield* grantDailyLabor(ports, claim);
        }),
      ),
    );
  }
  async openBlitz(key: LedgerGameKey, window: { start: number; end: number }) {
    await this.requireLaunchChain(key);
    const relay = this;
    return Effect.runPromise(
      this.ledgerPermit(
        Effect.gen(function* () {
          const entry = yield* paidGameEntry(relay.env.LEDGER_RPC_URL, relay.env.LEDGER_ADDRESS, key);
          yield* openBlitzOnLedger(ledgerCredentialsOf(relay.env), key, window);
          return entry;
        }),
        [key.chainId],
      ),
    );
  }
  async blitzDeadline(key: LedgerGameKey) {
    await this.requireLaunchChain(key);
    return Effect.runPromise(
      onIdentityChain(this.env.LEDGER_RPC_URL, this.env.IDENTITY, blitzDeadline(ledgerCredentialsOf(this.env), key)),
    );
  }
  async blitzRoster(key: LedgerGameKey): Promise<LedgerRosterSnapshot> {
    await this.requireLaunchChain(key);
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
    await this.requireLaunchChain(key);
    return Effect.runPromise(
      onIdentityChain(
        this.env.LEDGER_RPC_URL,
        this.env.IDENTITY,
        validateBlitzWindow(ledgerCredentialsOf(this.env), key, window),
      ),
    );
  }
  async refundBlitz(key: LedgerGameKey) {
    await this.requireLaunchChain(key);
    return Effect.runPromise(this.ledgerPermit(refundBlitzOnLedger(ledgerCredentialsOf(this.env), key), [key.chainId]));
  }
  private async requireLaunchChain(key: LedgerGameKey) {
    if (!Number.isInteger(key.gameId) || key.gameId <= 0 || key.gameId > 0xffffffff)
      throw new Error("wrong_launch_chain_or_game");
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
const connectionOf = (shard: Awaited<ReturnType<typeof readRegisteredShard>>) => ({
  rpcUrl: shard.rpcUrl,
  gamesAddress: shard.contracts.games!,
  chainId: shard.chainId,
});
const relayPortsOf = (
  env: RelayEnv,
  storage: DurableObjectStorage,
  shard: Awaited<ReturnType<typeof readRegisteredShard>>,
): RelayPorts => {
  const reader = new ShardReader(connectionOf(shard));
  return {
    identity: identityAdapter(env.IDENTITY),
    realms: { ownerOf: (realmId) => relayOperation("read Realm owner", () => env.IDENTITY.realmOwnerOf(realmId)) },
    ledger: {
      payment: (row) => ledgerPaymentRead(env.LEDGER_RPC_URL, env.LEDGER_ADDRESS)(row),
      voided: (row) => ledgerWithdrawalVoided(env.LEDGER_RPC_URL, env.LEDGER_ADDRESS)(row),
      reportMany: (rows) => relayOperation("report withdrawal page", () => ledgerOf(env).reportMany(rows)),
      payMany: (rows) => relayOperation("pay withdrawal page", () => ledgerOf(env).payMany(rows)),
      postResult: (row) => relayOperation("post shard result", () => ledgerOf(env).postResult(row)),
    },
    shard: {
      ...shardWithdrawalPorts(
        reader,
        frontierReceiptBindings(reader, { rpcUrl: env.LEDGER_RPC_URL, address: env.LEDGER_ADDRESS }, env.IDENTITY),
      ),
      result: shardResultPort(reader),
      grantLabor: (claim) =>
        relayOperation("grant on official shard", async () => {
          await requireActiveChain(env.IDENTITY, claim.chainId);
          return Effect.runPromise(
            writeLaborGrant(
              {
                connection: connectionOf(shard),
                operatorAddress: env.SHARD_LEDGER_OPERATOR_ADDRESS,
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
  rpcUrl: env.LEDGER_RPC_URL,
  contractAddress: env.LEDGER_ADDRESS,
  accountAddress: env.LEDGER_OPERATOR_ADDRESS,
  privateKey: env.LEDGER_OPERATOR_PRIVATE_KEY,
});

const chestPortsOf = (env: RelayEnv, permit: LedgerPermit) => ({
  ...chestLedgerReads({ rpcUrl: env.LEDGER_RPC_URL, contractAddress: env.LEDGER_ADDRESS }),
  finish: (tokenId: string) => permit(finishChestOnLedger(ledgerCredentialsOf(env), tokenId)),
});

const relayOf = (env: RelayEnv, chainId: string) =>
  env.RELAY.get(env.RELAY.idFromName(`0x${BigInt(chainId).toString(16)}`));
const ledgerOf = (env: RelayEnv) => env.RELAY.get(env.RELAY.idFromName("ledger"));
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
}
export class ValueLaunch extends WorkerEntrypoint<RelayEnv> {
  override fetch() {
    return new Response(null, { status: 404 });
  }
  blitzDeadline(key: LedgerGameKey) {
    return ledgerOf(this.env).blitzDeadline(key);
  }
  blitzRoster(key: LedgerGameKey) {
    return ledgerOf(this.env).blitzRoster(key);
  }
  openBlitz(key: LedgerGameKey, window: { start: number; end: number }) {
    return ledgerOf(this.env).openBlitz(key, window);
  }
  validateBlitz(key: LedgerGameKey, window: { start: number; end: number }) {
    return ledgerOf(this.env).validateBlitz(key, window);
  }
  refundBlitz(key: LedgerGameKey) {
    return ledgerOf(this.env).refundBlitz(key);
  }
}
export default {
  async fetch(request: Request, env: RelayEnv): Promise<Response> {
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
        return Response.json(
          await relayOf(env, body.chainId as string).reset(body.chainId as string, body.row, body.reason),
        );
      } catch {
        return Response.json({ error: "fault_row_mismatch_or_unavailable" }, { status: 409 });
      }
    }

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
        currentDay: () => currentLaborDay(connectionOf(shard)),
        grant: (claim) => relayOf(env, claim.chainId).labor(claim),
      });
    }
    if (new URL(request.url).pathname !== "/health") return new Response(null, { status: 404 });
    const health = await healthOf(env);
    return Response.json(health, { status: health.success ? 200 : 503, headers: { "cache-control": "no-store" } });
  },
  async scheduled(_controller: ScheduledController, env: RelayEnv): Promise<void> {
    await ledgerOf(env).ledgerTick();
    for (const shard of await activeShards(env.IDENTITY)) {
      try {
        await relayOf(env, shard.chainId).tick(shard.chainId);
      } catch {
        /* One unavailable shard must not suppress another shard. */
      }
    }
  },
};
