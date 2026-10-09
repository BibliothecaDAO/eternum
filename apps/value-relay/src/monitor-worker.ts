import { DurableObject } from "cloudflare:workers";
import { Effect, Semaphore } from "effect";
import { ledgerMonitorReads } from "./ledger";
import { ledgerPauserAdapter } from "./chain";
import { pendingMonitorPorts } from "./adapters";
import { relayOperation } from "./ports";
import { runMonitor, type MonitorProgress } from "./monitor";

interface MonitorEnv {
  MONITOR: DurableObjectNamespace<ValueMonitor>;
  LEDGER_RPC_URL: string;
  LEDGER_ADDRESS: string;
  PAUSER_ACCOUNT_ADDRESS: string;
  PAUSER_PRIVATE_KEY: string;
}

export class ValueMonitor extends DurableObject<MonitorEnv> {
  private readonly checking = Semaphore.makeUnsafe(1);
  async tick() {
    return Effect.runPromise(
      this.checking.withPermit(
        runMonitor(monitorPortsOf(this.env), {
          load: () => this.status(),
          save: (progress) => this.ctx.storage.put("progress", progress),
        }),
      ),
    );
  }
  async status(): Promise<MonitorProgress> {
    return (await this.ctx.storage.get<MonitorProgress>("progress")) ?? { halted: null };
  }
}
const monitorPortsOf = (env: MonitorEnv) =>
  pendingMonitorPorts({
    paidClaims: (cursor) =>
      relayOperation("read ledger paid claims", () =>
        Effect.runPromise(ledgerMonitorReads(env.LEDGER_RPC_URL, env.LEDGER_ADDRESS).paidClaims(cursor)),
      ),
    postedResults: (cursor) =>
      relayOperation("read ledger posted results", () =>
        Effect.runPromise(ledgerMonitorReads(env.LEDGER_RPC_URL, env.LEDGER_ADDRESS).postedResults(cursor)),
      ),
    pause: () =>
      relayOperation("pause ledger payouts", () =>
        Effect.runPromise(
          ledgerPauserAdapter({
            rpcUrl: env.LEDGER_RPC_URL,
            contractAddress: env.LEDGER_ADDRESS,
            accountAddress: env.PAUSER_ACCOUNT_ADDRESS,
            privateKey: env.PAUSER_PRIVATE_KEY,
          })(),
        ),
      ),
  });

const monitorOf = (env: MonitorEnv) => env.MONITOR.get(env.MONITOR.idFromName("monitor"));
export default {
  async fetch(request: Request, env: MonitorEnv): Promise<Response> {
    if (new URL(request.url).pathname !== "/health") return new Response(null, { status: 404 });
    return Response.json(
      { service: "value-monitor", interfaces: "pending", ...(await monitorOf(env).status()) },
      { status: 503 },
    );
  },
  async scheduled(_controller: ScheduledController, env: MonitorEnv): Promise<void> {
    await monitorOf(env).tick();
  },
};
