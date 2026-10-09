import { presentsOperatorToken } from "@realms-world/identity";
import { chestLedgerReads } from "./chest-ledger";
import { DurableChestStore, overdueChestRequests } from "./chests";
import { DurableObject } from "cloudflare:workers";
import { Effect, Result, Semaphore } from "effect";
import { ledgerMonitorReads } from "./ledger";
import { ledgerPauserAdapter } from "./chain";
import { ShardReader } from "./shard-rpc";
import { shardConservationPort } from "./shard-conservation";
import { frontierReceiptBindings } from "./frontier-binding";
import { shardResultPort } from "./shard-results";
import { shardWithdrawalPorts } from "./shard-withdrawals";
import { relayOperation } from "./ports";
import { runMonitor, resetMonitorRow, type MonitorProgress } from "./monitor";

interface MonitorEnv {
  OPERATOR_TOKEN: string;
  SHARD_HERALD_URL: string;
  SHARD_RPC_URL: string;
  SHARD_GAMES_ADDRESS: string;
  SHARD_CHAIN_ID: string;
  IDENTITY: {
    matchesLedgerLinkWrite(write: import("@realms-world/identity").LedgerAccountLinkWrite): Promise<boolean>;
    realmsIdForAccount(account: string): Promise<string | null>;
    wasReadyPayoutWallet(account: string, wallet: string, at: number): Promise<boolean>;
  };
  RELAY_REPORT: { held(): Promise<{ kind: string; reason: string; transactionHash: string }[]> };
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
            runMonitor(monitorPortsOf(monitor.env, monitor.ctx.storage), {
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
          const held = yield* Effect.result(
            relayOperation("read relay held obligations", () => monitor.env.RELAY_REPORT.held()),
          );
          const observation = {
            checked_at: Math.floor(Date.now() / 1000),
            value: Result.isSuccess(value) ? value.success : null,
            value_error: Result.isFailure(value) ? value.failure.operation : null,
            chests: Result.isSuccess(chests) ? chests.success : null,
            held: Result.isSuccess(held) ? held.success : null,
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
      held?: { kind: string; reason: string; transactionHash: string }[] | null;
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
  async reset(row: string, reason: string) {
    if (!reason.trim() || reason.length > 500) throw new Error("reset_reason_required");
    return Effect.runPromise(
      this.checking.withPermit(
        relayOperation("reset monitor halt", async () => {
          const snapshot = await this.status();
          const fault = snapshot.fault ?? (await legacyFault(this.env, snapshot, row));
          return this.ctx.storage.transaction(async (tx) => {
            const previous = (await tx.get<MonitorProgress>("progress")) ?? { halted: null };
            const sequence = ((await tx.get<number>("reset:sequence")) ?? 0) + 1;
            const progress = resetMonitorRow({ ...previous, fault }, row);
            await tx.put(`reset:${sequence}`, {
              row,
              reason: reason.trim(),
              at: Math.floor(Date.now() / 1000),
              previous,
            });
            await tx.put("reset:sequence", sequence);
            await tx.put("progress", progress);
            await tx.delete("observation");
            return progress;
          });
        }),
      ),
    );
  }
  async status(): Promise<MonitorProgress> {
    return (await this.ctx.storage.get<MonitorProgress>("progress")) ?? { halted: null };
  }
}
const legacyFault = async (
  env: MonitorEnv,
  previous: MonitorProgress,
  row: string,
): Promise<NonNullable<MonitorProgress["fault"]>> => {
  const paid = /^paid_(?:claim|wallet)_mismatch:(0x[0-9a-f]+)$/i.exec(previous.halted ?? "");
  const result = /^blitz_result_mismatch:(\d+)$/.exec(previous.halted ?? "");
  const stream = paid ? "paidClaims" : result ? "postedResults" : null;
  if (!stream) {
    if (row === `availability:${previous.halted}` && previous.halted?.startsWith("unverified_value:")) return { row };
    throw new Error("fault_row_unavailable");
  }
  const cursor = previous.cursors?.[stream] ?? { fromBlock: 0, page: null };
  const reads = ledgerMonitorReads(env.LEDGER_RPC_URL, env.LEDGER_ADDRESS);
  const page =
    stream === "paidClaims"
      ? await Effect.runPromise(reads.paidClaims(cursor.page, cursor.fromBlock))
      : await Effect.runPromise(reads.postedResults(cursor.page, cursor.fromBlock));
  const index = page.rows.findIndex((value) =>
    paid
      ? "transactionHash" in value && BigInt(value.transactionHash) === BigInt(paid[1]!)
      : "gameId" in value && value.gameId === Number(result![1]),
  );
  const value = page.rows[index];
  if (
    !value ||
    row !== `${stream}:${value.chainId}:${"transactionHash" in value ? value.transactionHash : value.gameId}`
  )
    throw new Error("fault_row_mismatch");
  return {
    row,
    stream,
    cursor: { fromBlock: cursor.fromBlock, page: cursor.page ?? JSON.stringify({ head: page.head, token: "" }) },
    offset: index,
  };
};

const monitorPortsOf = (env: MonitorEnv, storage: DurableObjectStorage) => {
  const reader = new ShardReader({
    rpcUrl: env.SHARD_RPC_URL,
    gamesAddress: env.SHARD_GAMES_ADDRESS,
    chainId: env.SHARD_CHAIN_ID,
  });
  return {
    identity: {
      matchesLedgerLinkWrite: (write: import("@realms-world/identity").LedgerAccountLinkWrite) =>
        relayOperation("verify identity ledger link history", () => env.IDENTITY.matchesLedgerLinkWrite(write)),
      wasReadyPayoutWallet: (account: string, wallet: string, at: number) =>
        relayOperation("verify historical payout wallet", () => env.IDENTITY.wasReadyPayoutWallet(account, wallet, at)),
    },
    shard: {
      conservation: shardConservationPort(reader.connection, env.SHARD_HERALD_URL),
      withdrawal: shardWithdrawalPorts(
        reader,
        frontierReceiptBindings(
          reader,
          { rpcUrl: env.LEDGER_RPC_URL, address: env.LEDGER_ADDRESS },
          env.IDENTITY,
          env.SHARD_HERALD_URL,
          storage,
        ),
      ).withdrawal,
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
    if (new URL(request.url).pathname === "/api/operator/monitor/reset" && request.method === "POST") {
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
        return Response.json({ error: "reset_reason_required" }, { status: 400 });
      try {
        return Response.json(await monitorOf(env).reset(body.row, body.reason), {
          headers: { "cache-control": "no-store" },
        });
      } catch {
        return Response.json({ error: "fault_row_mismatch" }, { status: 409 });
      }
    }
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
