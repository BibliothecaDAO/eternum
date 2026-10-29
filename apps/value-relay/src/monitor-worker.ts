import { decodeMonitorSettings, type MonitorSettings } from "./monitor-env";
import { checkSlotRoster, slotRosterReads } from "./roster-monitor";
import { ledgerAddress, ledgerContractOf } from "./environment";
import { bindLedgerState, ledgerOrNull, ledgerStateName } from "./ledger-state";
import { activeShards, isDevShardChain, readRegisteredShard, type ShardDirectory } from "@realms-world/value-ledger";
import { processSeasonTops } from "./season-tops";
import { seasonLedgerReads, challengeSeason } from "./season-ledger";
import { onIdentityChain } from "./ledger-chain";
import { presentsOperatorToken } from "@realms-world/identity";
import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import { Effect, Result, Semaphore } from "effect";
import { ledgerMonitorReads } from "./ledger";
import { ledgerPauserAdapter } from "./chain";
import { ShardReader, shardConnection } from "./shard-rpc";
import { shardConservationPort } from "./shard-conservation";
import { frontierReceiptBindings } from "./frontier-binding";
import { shardResultPort } from "./shard-results";
import { shardWithdrawalPorts } from "./shard-withdrawals";
import { relayOperation, type MonitorPorts } from "./ports";
import { runMonitor, resetMonitorRow, type MonitorProgress } from "./monitor";

interface MonitorEnv extends MonitorSettings {
  LAUNCH: import("@realms-world/value-ledger").LaunchCohorts;
  IDENTITY: ShardDirectory &
    import("@realms-world/value-ledger").RegistrationIdentity & {
      l2ChainId(): Promise<string>;
      realmsIdForAccount(account: string): Promise<string | null>;
      matchesPayDecision(decision: import("@realms-world/identity").LedgerPayDecision): Promise<boolean>;
    };
  RELAY_REPORT: { held(): Promise<{ kind: string; reason: string; transactionHash: string | null }[]> };
  MONITOR: DurableObjectNamespace<ValueMonitor>;
}

export class ValueMonitor extends DurableObject<MonitorEnv> {
  private readonly checking = Semaphore.makeUnsafe(1);
  async tick() {
    const monitor = this;
    return Effect.runPromise(
      this.checking.withPermit(
        Effect.gen(function* () {
          const bound = yield* Effect.result(
            relayOperation("bind monitor state", () =>
              bindLedgerState(
                monitor.ctx.storage,
                ledgerOrNull(() => ledgerAddress(monitor.env.ENVIRONMENT)),
              ),
            ),
          );
          if (Result.isFailure(bound)) {
            const reason = bound.failure.operation;
            const checked_at = Math.floor(Date.now() / 1000);
            const observation = { checked_at, value: null, season_error: reason, value_error: reason, held: null };
            yield* relayOperation("publish value monitor", () => monitor.ctx.storage.put("observation", observation));
            return observation;
          }
          const seasonAudit = yield* Effect.result(
            onIdentityChain(
              monitor.env.L2_RPC_URL,
              monitor.env.IDENTITY,
              relayOperation("audit season leaderboard", () =>
                Effect.runPromise(
                  processSeasonTops(
                    "audit",
                    {
                      ...seasonLedgerReads({
                        rpcUrl: monitor.env.L2_RPC_URL,
                        ...ledgerContractOf(monitor.env.ENVIRONMENT),
                      }),
                      challenge: (id, omitted) =>
                        challengeSeason(
                          {
                            rpcUrl: monitor.env.L2_RPC_URL,
                            ...ledgerContractOf(monitor.env.ENVIRONMENT),
                            accountAddress: monitor.env.PAUSER_ACCOUNT_ADDRESS,
                            privateKey: monitor.env.PAUSER_PRIVATE_KEY,
                          },
                          id,
                          omitted,
                        ),
                      post: async () => {
                        throw new Error("monitor_cannot_post");
                      },
                    },
                    monitor.ctx.storage,
                  ),
                ),
              ),
            ),
          );
          const ports = monitorPortsOf(monitor.env, monitor.ctx.storage);
          const value = yield* Effect.result(
            onIdentityChain(
              monitor.env.L2_RPC_URL,
              monitor.env.IDENTITY,
              runMonitor(ports, {
                load: () => monitor.status(),
                save: (progress) => monitor.ctx.storage.put("progress", progress),
              }),
            ),
          );
          const held = yield* Effect.result(
            relayOperation("read relay held obligations", () => monitor.env.RELAY_REPORT.held()),
          );
          const observation = {
            checked_at: Math.floor(Date.now() / 1000),
            value: Result.isSuccess(value) ? value.success : null,
            season_error: Result.isSuccess(seasonAudit) ? seasonAudit.success : seasonAudit.failure.operation,
            value_error: Result.isFailure(value) ? value.failure.operation : null,
            held: Result.isSuccess(held) ? held.success : null,
          };
          yield* relayOperation("publish value monitor", () => monitor.ctx.storage.put("observation", observation));
          return observation;
        }),
      ),
    );
  }
  /** The slot that paid for a game, its roster verified; null when the launch directory declares it outside any slot. */
  async verifyRoster(chainId: string, gameId: number): Promise<number | null> {
    return Effect.runPromise(
      this.checking.withPermit(
        onIdentityChain(
          this.env.L2_RPC_URL,
          this.env.IDENTITY,
          relayOperation("verify paid roster before results", async () => {
            if ((await this.status()).halted) throw new Error("monitor_halted");
            const cohorts = await this.env.LAUNCH.rosterCohorts();
            const cohort = cohorts.find(
              (row) => BigInt(row.chainId) === BigInt(chainId) && row.games.some((game) => game.gameId === gameId),
            );
            if (cohort) {
              await this.checkRoster(cohort);
              return cohort.slotId;
            }
            if (await this.isDeclaredOutsideSlot(chainId, gameId)) return null;
            throw new Error("paid_game_slot_missing");
          }),
        ),
      ),
    );
  }
  /**
   * Only a dev shard runs games outside any slot, and only the directory's positive declaration of the exact game frees
   * its result from a slot; any other game stays unposted.
   */
  private async isDeclaredOutsideSlot(chainId: string, gameId: number) {
    if (!isDevShardChain(chainId)) return false;
    const chains = await this.env.LAUNCH.directoryGames();
    const chain = chains.find((row) => BigInt(row.chainId) === BigInt(chainId));
    return chain?.games.some((game) => game.gameId === gameId && game.slotId === null) ?? false;
  }
  private async checkRoster(cohort: import("@realms-world/value-ledger").SlotCohort) {
    await checkSlotRoster(cohort, {
      ...slotRosterReads(cohort, this.env.L2_RPC_URL, ledgerAddress(this.env.ENVIRONMENT), this.env.IDENTITY),
      pause: async () => {
        const row = `roster:${cohort.chainId}:${cohort.slotId}`;
        // A roster check has no fact to waive: its reset re-observes the roster.
        const halted: MonitorProgress = { ...(await this.status()), halted: row, fault: { row } };
        await this.ctx.storage.put("progress", halted);
        await Effect.runPromise(monitorPortsOf(this.env, this.ctx.storage).ledger.pause());
      },
    });
  }
  async health() {
    const observation = await this.ctx.storage.get<{
      checked_at: number;
      value: MonitorProgress | null;
      value_error: string | null;
      season_error: string | null;
      held?: { kind: string; reason: string; transactionHash: string | null }[] | null;
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
        observation.season_error === null &&
        observation.value_error === null &&
        !progress.halted,
    };
  }
  async reset(row: string, reason: string) {
    if (!reason.trim() || reason.length > 500) throw new Error("reset_reason_required");
    return Effect.runPromise(
      this.checking.withPermit(
        relayOperation("reset monitor halt", async () => {
          await bindLedgerState(
            this.ctx.storage,
            ledgerOrNull(() => ledgerAddress(this.env.ENVIRONMENT)),
          );
          const snapshot = await this.status();
          const fault = snapshot.fault ?? (await legacyFault(this.env, snapshot, row));
          return this.ctx.storage.transaction(async (tx) => {
            const previous = (await tx.get<MonitorProgress>("progress")) ?? { halted: null };
            const sequence = ((await tx.get<number>("reset:sequence")) ?? 0) + 1;
            const progress = resetMonitorRow({ ...previous, fault }, row);
            // What this reset cleared: the fault's exact fact, or null when it only cleared the halt and re-observes.
            const waived = fault.fact ?? null;
            await tx.put(`reset:${sequence}`, {
              row,
              reason: reason.trim(),
              at: Math.floor(Date.now() / 1000),
              previous,
              waived,
            });
            await tx.put("reset:sequence", sequence);
            await tx.put("progress", progress);
            await tx.delete("observation");
            return { ...progress, waived };
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
    throw new Error("fault_row_unavailable");
  }
  const cursor = previous.cursors?.[stream] ?? { page: null };
  const reads = ledgerMonitorReads(env.L2_RPC_URL, ledgerContractOf(env.ENVIRONMENT));
  const page =
    stream === "paidClaims"
      ? await Effect.runPromise(
          onIdentityChain(env.L2_RPC_URL, env.IDENTITY, reads.paidClaims(cursor.page, cursor.fromBlock, cursor.anchor)),
        )
      : await Effect.runPromise(
          onIdentityChain(
            env.L2_RPC_URL,
            env.IDENTITY,
            reads.postedResults(cursor.page, cursor.fromBlock, cursor.anchor),
          ),
        );
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
  // The halt names the row but never recorded what the operator saw, so its reset waives nothing and re-observes.
  return { row };
};

type LedgerPorts = MonitorPorts["ledger"];
const monitorPortsOf = (env: MonitorEnv, storage: DurableObjectStorage): MonitorPorts => {
  const shardPorts = async (chainId: string) => {
    const shard = await readRegisteredShard(env.IDENTITY, chainId);
    const reader = new ShardReader(shardConnection(shard));
    return { reader, shard };
  };
  // Resolved per read: a missing ledger fails that read, never the whole tick.
  const ledgerReads = () => ledgerMonitorReads(env.L2_RPC_URL, ledgerContractOf(env.ENVIRONMENT));
  return {
    identity: {
      matchesPayDecision: (decision: import("@realms-world/identity").LedgerPayDecision) =>
        relayOperation("verify signed pay decision", () => env.IDENTITY.matchesPayDecision(decision)),
    },
    shard: {
      withdrawal: (chainId: string, hash: string) =>
        relayOperation("audit registered shard receipt", async () => {
          const { reader, shard } = await shardPorts(chainId);
          return Effect.runPromise(
            shardWithdrawalPorts(
              reader,
              frontierReceiptBindings(
                reader,
                () => ({ rpcUrl: env.L2_RPC_URL, address: ledgerAddress(env.ENVIRONMENT) }),
                env.IDENTITY,
                shard.url,
              ),
            ).withdrawal(chainId, hash),
          );
        }),
      result: (chainId: string, gameId: number) =>
        relayOperation("audit registered shard result", async () => {
          const { reader } = await shardPorts(chainId);
          return Effect.runPromise(shardResultPort(reader)(chainId, gameId));
        }),
      conservation: () =>
        relayOperation("audit official shard conservation", async () => {
          const balances = [];
          for (const row of await activeShards(env.IDENTITY)) {
            const { reader, shard } = await shardPorts(row.chainId);
            const rows = await Effect.runPromise(shardConservationPort(reader.connection, shard.url, fetch, storage)());
            balances.push(...rows);
          }
          return balances;
        }),
    },
    ledger: {
      // Each read forwards its whole argument list, so the audit cursor's anchor reaches the ledger unchanged.
      frontierPool: (...read: Parameters<LedgerPorts["frontierPool"]>) =>
        relayOperation("ledger Frontier funding unavailable", () =>
          Effect.runPromise(ledgerReads().frontierPool(...read)),
        ),
      paidClaims: (...read: Parameters<LedgerPorts["paidClaims"]>) =>
        relayOperation("ledger paid claims unavailable", () => Effect.runPromise(ledgerReads().paidClaims(...read))),
      postedResults: (...read: Parameters<LedgerPorts["postedResults"]>) =>
        relayOperation("ledger results unavailable", () => Effect.runPromise(ledgerReads().postedResults(...read))),
      pause: () =>
        relayOperation("ledger pause unavailable", () =>
          Effect.runPromise(
            ledgerPauserAdapter({
              rpcUrl: env.L2_RPC_URL,
              contractAddress: ledgerAddress(env.ENVIRONMENT),
              accountAddress: env.PAUSER_ACCOUNT_ADDRESS,
              privateKey: env.PAUSER_PRIVATE_KEY,
            })(),
          ),
        ),
    },
  };
};

const monitorOf = (env: MonitorEnv) =>
  env.MONITOR.get(
    env.MONITOR.idFromName(
      ledgerStateName(
        "monitor",
        ledgerOrNull(() => ledgerAddress(env.ENVIRONMENT)),
      ),
    ),
  );
export default {
  async fetch(request: Request, raw: MonitorEnv): Promise<Response> {
    const env = { ...raw, ...decodeMonitorSettings(raw) };
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
    if (new URL(request.url).pathname !== "/api/operator/monitor/health" || request.method !== "GET")
      return new Response(null, { status: 404 });
    const health = await monitorOf(env).health();
    return Response.json(
      { service: "value-monitor", ...health },
      { status: health.success ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  },
  async scheduled(_controller: ScheduledController, raw: MonitorEnv): Promise<void> {
    const env = { ...raw, ...decodeMonitorSettings(raw) };
    await monitorOf(env).tick();
  },
};

export class RosterMonitor extends WorkerEntrypoint<MonitorEnv> {
  override fetch() {
    return new Response(null, { status: 404 });
  }
  verifyRoster(chainId: string, gameId: number) {
    return monitorOf(this.env).verifyRoster(chainId, gameId);
  }
}
