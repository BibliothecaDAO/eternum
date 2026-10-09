import { openBlitzOnLedger, refundBlitzOnLedger, validateBlitzWindow } from "./blitz-launch";
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
import { ledgerResultAdapter, ledgerMonitorReads } from "./ledger";
import { ledgerPaymentAdapter, ledgerPaymentRead, ledgerReportAdapter, realmsOwnershipAdapter } from "./chain";
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
  REALMS_ADDRESS: string;
  IDENTITY: {
    wasReadyPayoutWallet(account: string, wallet: string, at: number): Promise<boolean>;
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
  private readonly signing = Semaphore.makeUnsafe(1);
  private readonly store = new DurableRelayStore(this.ctx.storage);
  private readonly ports = relayPortsOf(this.env, this.ctx.storage);
  private readonly chests = new DurableChestStore(this.ctx.storage);

  async tick() {
    const relay = this;
    return Effect.runPromise(
      this.signing.withPermit(
        Effect.gen(function* () {
          const value = yield* Effect.result(runRelay(relay.env.SHARD_CHAIN_ID, relay.ports, relay.store));
          const chests = yield* Effect.result(finishRequestedChests(chestPortsOf(relay.env), relay.chests));
          const observation = {
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
      this.signing.withPermit(
        relayOperation("reset relay row", async () => {
          const progress = await this.store.progress();
          if (progress.halted !== row) throw new Error("fault_row_mismatch");
          const number =
            row === "confirmed_head_regressed"
              ? (progress.page?.head ?? progress.nextBlock - 1)
              : Number(row.split(":").at(-1));
          if (!Number.isSafeInteger(number) || number < 0) throw new Error("fault_row_unavailable");
          const hash = await Effect.runPromise(this.ports.shard.blockHash(number));
          return this.store.reset(row, reason, hash);
        }),
      ),
    );
  }
  async health() {
    const observation = await this.ctx.storage.get<{
      checked_at: number;
      value: { status: string };
      chests: { failed: number } | null;
    }>("lastTick");
    const progress = await this.store.progress();
    const success =
      observation !== undefined &&
      observation.value.status === "ready" &&
      observation.chests !== null &&
      observation.chests.failed === 0 &&
      !progress.halted;
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
      this.signing.withPermit(
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
    return Effect.runPromise(this.signing.withPermit(openBlitzOnLedger(ledgerCredentialsOf(this.env), key, window)));
  }
  async validateBlitz(key: LedgerGameKey, window: { start: number; end: number }) {
    this.requireLaunchChain(key);
    return Effect.runPromise(validateBlitzWindow(ledgerCredentialsOf(this.env), key, window));
  }
  async refundBlitz(key: LedgerGameKey) {
    this.requireLaunchChain(key);
    return Effect.runPromise(this.signing.withPermit(refundBlitzOnLedger(ledgerCredentialsOf(this.env), key)));
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
      transactionHash: row.kind === "receipt" ? row.receipt.transactionHash : row.withdrawal.transactionHash,
    }));
  }
  async status() {
    return this.store.progress();
  }
}

const relayPortsOf = (env: RelayEnv, storage: DurableObjectStorage): RelayPorts => {
  const reader = new ShardReader(shardConnectionOf(env));
  return {
    identity: identityAdapter(env.IDENTITY),
    ledger: ledgerPortsOf(env),
    realms: {
      ownerOf: (realmId) =>
        relayOperation("read Realm owner", () =>
          Effect.runPromise(realmsOwnershipAdapter(env.LEDGER_RPC_URL, env.REALMS_ADDRESS).ownerOf(realmId)),
        ),
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
const ledgerPortsOf = (env: RelayEnv): RelayPorts["ledger"] => ({
  payment: (withdrawal) => ledgerPaymentRead(env.LEDGER_RPC_URL, env.LEDGER_ADDRESS)(withdrawal),
  report: (withdrawal) => ledgerReportAdapter(ledgerCredentialsOf(env))(withdrawal),
  pay: (withdrawal, wallet) =>
    relayOperation("pay Frontier claim", () =>
      Effect.runPromise(
        ledgerPaymentAdapter(ledgerCredentialsOf(env), (account, wallet, at) =>
          env.IDENTITY.wasReadyPayoutWallet(account, wallet, at),
        )(withdrawal, wallet),
      ),
    ),
  postResult: (result) =>
    relayOperation("post Blitz result", () => Effect.runPromise(ledgerResultAdapter(ledgerCredentialsOf(env))(result))),
  paidClaims: (cursor, fromBlock) =>
    relayOperation("read ledger paid claims", () =>
      Effect.runPromise(ledgerMonitorReads(env.LEDGER_RPC_URL, env.LEDGER_ADDRESS).paidClaims(cursor, fromBlock)),
    ),
  postedResults: (cursor, fromBlock) =>
    relayOperation("read ledger posted results", () =>
      Effect.runPromise(ledgerMonitorReads(env.LEDGER_RPC_URL, env.LEDGER_ADDRESS).postedResults(cursor, fromBlock)),
    ),
});
const ledgerCredentialsOf = (env: RelayEnv) => ({
  rpcUrl: env.LEDGER_RPC_URL,
  contractAddress: env.LEDGER_ADDRESS,
  accountAddress: env.LEDGER_OPERATOR_ADDRESS,
  privateKey: env.LEDGER_OPERATOR_PRIVATE_KEY,
});

const chestPortsOf = (env: RelayEnv) => ({
  ...chestLedgerReads({ rpcUrl: env.LEDGER_RPC_URL, contractAddress: env.LEDGER_ADDRESS }),
  finish: (tokenId: string) => finishChestOnLedger(ledgerCredentialsOf(env), tokenId),
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
