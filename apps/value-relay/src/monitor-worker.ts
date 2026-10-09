import { chestLedgerReads } from "./chest-ledger";
import { DurableChestStore, overdueChestRequests } from "./chests";
import { DurableObject } from "cloudflare:workers";
import { Effect, Result, Semaphore } from "effect";
import { ledgerMonitorReads } from "./ledger";
import { ledgerPauserAdapter } from "./chain";
import { ShardReader } from "./shard-rpc";
import { shardConservationPort } from "./shard-conservation";
import { shardResultPort } from "./shard-results";
import { shardWithdrawalPorts, pendingFrontierBindings } from "./shard-withdrawals";
import { relayOperation } from "./ports";
import { runMonitor, type MonitorProgress } from "./monitor";

interface MonitorEnv {
  SHARD_HERALD_URL: string;
  SHARD_RPC_URL: string;
  SHARD_GAMES_ADDRESS: string;
  SHARD_CHAIN_ID: string;
  IDENTITY: {
    realmsIdForAccount(account: string): Promise<string | null>;
    payoutWallet(id: string): Promise<import("@realms-world/identity").PayoutWallet>;
  };
  MONITOR: DurableObjectNamespace<ValueMonitor>;
  LEDGER_RPC_URL: string;
  LEDGER_ADDRESS: string;
  PAUSER_ACCOUNT_ADDRESS: string;
  PAUSER_PRIVATE_KEY: string;
}

export class ValueMonitor extends DurableObject<MonitorEnv> {
  private readonly checking = Semaphore.makeUnsafe(1);
  private readonly chests = new DurableChestStore(this.ctx.storage);
  async tick() {
    const monitor = this;
    return Effect.runPromise(
      this.checking.withPermit(
        Effect.gen(function* () {
          const value = yield* Effect.result(
            runMonitor(monitorPortsOf(monitor.env), {
              load: () => monitor.status(),
              save: (progress) => monitor.ctx.storage.put("progress", progress),
            }),
          );
          const chests = yield* Effect.result(
            overdueChestRequests(
              chestLedgerReads({ rpcUrl: monitor.env.LEDGER_RPC_URL, contractAddress: monitor.env.LEDGER_ADDRESS }),
              monitor.chests,
            ),
          );
          const observation = {
            checked_at: Math.floor(Date.now() / 1000),
            value: Result.isSuccess(value) ? value.success : null,
            value_error: Result.isFailure(value) ? value.failure.operation : null,
            chests: Result.isSuccess(chests) ? chests.success : null,
          };
          yield* relayOperation("publish chest monitor", () => monitor.ctx.storage.put("observation", observation));
          return observation;
        }),
      ),
    );
  }
  async health() {
    const observation = await this.ctx.storage.get<{
      checked_at: number;
      value: MonitorProgress | null;
      chests: { overdue: string[]; pending: number } | null;
      value_error: string | null;
    }>("observation");
    const progress = await this.status();
    const age = observation ? Math.floor(Date.now() / 1000) - observation.checked_at : Infinity;
    return {
      ...progress,
      ...observation,
      success:
        age >= 0 &&
        age <= 300 &&
        observation?.value !== null &&
        observation?.value !== undefined &&
        observation.chests !== null &&
        !progress.halted,
    };
  }
  async status(): Promise<MonitorProgress> {
    return (await this.ctx.storage.get<MonitorProgress>("progress")) ?? { halted: null };
  }
}
const monitorPortsOf = (env: MonitorEnv) => {
  const reader = new ShardReader({
    rpcUrl: env.SHARD_RPC_URL,
    gamesAddress: env.SHARD_GAMES_ADDRESS,
    chainId: env.SHARD_CHAIN_ID,
  });
  return {
    identity: {
      payoutWallet: (id: string) => relayOperation("verify paid wallet", () => env.IDENTITY.payoutWallet(id)),
    },
    shard: {
      conservation: shardConservationPort(reader.connection, env.SHARD_HERALD_URL),
      withdrawal: shardWithdrawalPorts(reader, pendingFrontierBindings(env.IDENTITY)).withdrawal,
      result: shardResultPort(reader),
    },
    ledger: {
      ...ledgerMonitorReads(env.LEDGER_RPC_URL, env.LEDGER_ADDRESS),
      pause: ledgerPauserAdapter({
        rpcUrl: env.LEDGER_RPC_URL,
        contractAddress: env.LEDGER_ADDRESS,
        accountAddress: env.PAUSER_ACCOUNT_ADDRESS,
        privateKey: env.PAUSER_PRIVATE_KEY,
      }),
    },
  };
};

const monitorOf = (env: MonitorEnv) => env.MONITOR.get(env.MONITOR.idFromName("monitor"));
export default {
  async fetch(request: Request, env: MonitorEnv): Promise<Response> {
    if (new URL(request.url).pathname !== "/health") return new Response(null, { status: 404 });
    const health = await monitorOf(env).health();
    return Response.json(
      { service: "value-monitor", ...health },
      { status: health.success ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  },
  async scheduled(_controller: ScheduledController, env: MonitorEnv): Promise<void> {
    await monitorOf(env).tick();
  },
};
