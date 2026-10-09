import { currentLaborDay, writeLaborGrant } from "./shard-labor";
import { handleLaborRequest } from "./labor-route";
import { ShardReader } from "./shard-rpc";
import { shardWithdrawalPorts } from "./shard-withdrawals";
import { chestLedgerReads, finishChestOnLedger } from "./chest-ledger";
import { DurableChestStore, finishRequestedChests } from "./chests";
import { DurableObject } from "cloudflare:workers";
import { Effect, Result, Semaphore } from "effect";
import { ledgerResultAdapter, ledgerMonitorReads } from "./ledger";
import { ledgerPaymentAdapter, realmsOwnershipAdapter } from "./chain";
import { pendingRelayPorts } from "./adapters";
import { runRelay, grantDailyLabor } from "./relay";
import { DurableRelayStore } from "./state";
import { RelayFailure, relayOperation, type RelayPorts, type LaborClaim } from "./ports";

interface RelayEnv {
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
    payoutWallet(id: string): Promise<import("@realms-world/identity").PayoutWallet>;
    linkedWallet(id: string): Promise<string | null>;
    authenticate(cookie: string): Promise<{ realmsId: string; account: string } | null>;
    realmsIdForAccount(account: string): Promise<string | null>;
  };
  RELAY: DurableObjectNamespace<ValueRelay>;
}

/** A single transaction stream per official chain, isolated from the shard host. */
export class ValueRelay extends DurableObject<RelayEnv> {
  private readonly signing = Semaphore.makeUnsafe(1);
  private readonly store = new DurableRelayStore(this.ctx.storage);
  private readonly ports = relayPortsOf(this.env);
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
          const day = yield* currentLaborDay();
          if (claim.day !== day) return yield* Effect.fail(new RelayFailure({ operation: "labor_day_differs" }));
          return yield* grantDailyLabor(relay.ports, claim);
        }),
      ),
    );
  }
  async status() {
    return this.store.progress();
  }
}

const relayPortsOf = (env: RelayEnv): RelayPorts => {
  const ports = pendingRelayPorts(env.IDENTITY, ledgerPortsOf(env), {
    ownerOf: (realmId) =>
      relayOperation("read Realm owner", () =>
        Effect.runPromise(realmsOwnershipAdapter(env.LEDGER_RPC_URL, env.REALMS_ADDRESS).ownerOf(realmId)),
      ),
  });
  return {
    ...ports,
    shard: {
      ...ports.shard,
      grantLabor: (claim) =>
        writeLaborGrant(
          {
            connection: shardConnectionOf(env),
            operatorAddress: env.SHARD_LEDGER_OPERATOR_ADDRESS,
            privateKey: env.SHARD_LEDGER_OPERATOR_PRIVATE_KEY,
          },
          claim,
        ),
      ...shardWithdrawalPorts(
        new ShardReader({
          rpcUrl: env.SHARD_RPC_URL,
          gamesAddress: env.SHARD_GAMES_ADDRESS,
          chainId: env.SHARD_CHAIN_ID,
        }),
        {
          realmsIdForAccount: (account) => env.IDENTITY.realmsIdForAccount(account),
          frontierSeason: () =>
            Effect.fail(new RelayFailure({ operation: "interface_unavailable:frontier.game_season_binding" })),
        },
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
  pay: (withdrawal, wallet) =>
    relayOperation("pay Frontier claim", () =>
      Effect.runPromise(ledgerPaymentAdapter(ledgerCredentialsOf(env))(withdrawal, wallet)),
    ),
  postResult: (result) =>
    relayOperation("post Blitz result", () => Effect.runPromise(ledgerResultAdapter(ledgerCredentialsOf(env))(result))),
  paidClaims: (cursor) =>
    relayOperation("read ledger paid claims", () =>
      Effect.runPromise(ledgerMonitorReads(env.LEDGER_RPC_URL, env.LEDGER_ADDRESS).paidClaims(cursor)),
    ),
  postedResults: (cursor) =>
    relayOperation("read ledger posted results", () =>
      Effect.runPromise(ledgerMonitorReads(env.LEDGER_RPC_URL, env.LEDGER_ADDRESS).postedResults(cursor)),
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
export default {
  async fetch(request: Request, env: RelayEnv): Promise<Response> {
    if (new URL(request.url).pathname === "/api/value/labor" && request.method === "POST")
      return handleLaborRequest(request, {
        origin: env.BASE_URL,
        chainId: env.SHARD_CHAIN_ID,
        authenticate: (cookie) => env.IDENTITY.authenticate(cookie),
        currentDay: currentLaborDay,
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
