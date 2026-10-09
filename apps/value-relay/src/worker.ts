import { DurableObject } from "cloudflare:workers";
import { Effect, Semaphore } from "effect";
import { ledgerResultAdapter, ledgerMonitorReads } from "./ledger";
import { ledgerPaymentAdapter, realmsOwnershipAdapter } from "./chain";
import { pendingRelayPorts } from "./adapters";
import { runRelay, grantDailyLabor } from "./relay";
import { DurableRelayStore } from "./state";
import { relayOperation, type RelayPorts, type LaborClaim } from "./ports";

interface RelayEnv {
  SHARD_CHAIN_ID: string;
  LEDGER_RPC_URL: string;
  LEDGER_ADDRESS: string;
  LEDGER_OPERATOR_ADDRESS: string;
  LEDGER_OPERATOR_PRIVATE_KEY: string;
  REALMS_ADDRESS: string;
  IDENTITY: {
    payoutWallet(id: string): Promise<import("@realms-world/identity").PayoutWallet>;
    linkedWallet(id: string): Promise<string | null>;
  };
  RELAY: DurableObjectNamespace<ValueRelay>;
}

/** A single transaction stream per official chain, isolated from the shard host. */
export class ValueRelay extends DurableObject<RelayEnv> {
  private readonly signing = Semaphore.makeUnsafe(1);
  private readonly store = new DurableRelayStore(this.ctx.storage);
  private readonly ports = relayPortsOf(this.env);

  async tick() {
    return Effect.runPromise(this.signing.withPermit(runRelay(this.env.SHARD_CHAIN_ID, this.ports, this.store)));
  }
  async labor(claim: LaborClaim) {
    const relay = this;
    return Effect.runPromise(
      this.signing.withPermit(
        Effect.gen(function* () {
          const progress = yield* relayOperation("read relay progress", () => relay.store.progress());
          if (BigInt(claim.chainId) !== BigInt(relay.env.SHARD_CHAIN_ID) || progress.halted)
            return yield* Effect.fail(new Error("relay_halted_or_wrong_chain"));
          yield* grantDailyLabor(relay.ports, claim);
        }),
      ),
    );
  }
  async status() {
    return this.store.progress();
  }
}

const relayPortsOf = (env: RelayEnv): RelayPorts =>
  pendingRelayPorts(env.IDENTITY, ledgerPortsOf(env), {
    ownerOf: (realmId) =>
      relayOperation("read Realm owner", () =>
        Effect.runPromise(realmsOwnershipAdapter(env.LEDGER_RPC_URL, env.REALMS_ADDRESS).ownerOf(realmId)),
      ),
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

const relayOf = (env: RelayEnv) => env.RELAY.get(env.RELAY.idFromName(env.SHARD_CHAIN_ID));
export default {
  async fetch(request: Request, env: RelayEnv): Promise<Response> {
    if (new URL(request.url).pathname !== "/health") return new Response(null, { status: 404 });
    return Response.json(
      { service: "value-relay", interfaces: "pending", ...(await relayOf(env).status()) },
      { status: 503 },
    );
  },
  async scheduled(_controller: ScheduledController, env: RelayEnv): Promise<void> {
    await relayOf(env).tick();
  },
};
