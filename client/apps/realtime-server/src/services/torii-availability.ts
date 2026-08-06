import type { WorldSummary, WorldSummaryChain } from "@bibliothecadao/types";
import { fetchFactoryPrizeAddresses } from "./factory-prize-addresses";
import { fetchFactoryWorldDeployments, type FactoryWorldDeployment } from "./factory-worlds";
import { fetchJackpotBalance } from "./jackpot-balance";
import { fetchWorldSummaryResult } from "./world-summary";

const CARTRIDGE_API_BASE = "https://api.cartridge.gg";

function buildNullSummary(name: string, chain: WorldSummaryChain, alive: boolean, now: number): WorldSummary {
  return {
    name,
    chain,
    alive,
    lastCheckedAt: now,
    mode: null,
    startSettlingAt: null,
    startMainAt: null,
    endAt: null,
    devModeOn: null,
    mmrEnabled: null,
    singleRealmMode: null,
    twoPlayerMode: null,
    seasonPassAddress: null,
    villagePassAddress: null,
    worldAddress: null,
    prizeDistributionAddress: null,
    entryTokenAddress: null,
    feeTokenAddress: null,
    feeAmount: null,
    registrationCount: null,
    registrationCountMax: null,
    registrationStartAt: null,
    registrationEndAt: null,
    settledPlayersCount: null,
    settledRealmsCount: null,
    settledVillagesCount: null,
    winnerJackpotAmount: null,
  };
}

function resolveChain(chain: string): WorldSummaryChain {
  return chain === "mainnet" ? "mainnet" : "appchain";
}

function getWorldCacheKey(chain: WorldSummaryChain, name: string): string {
  return `${chain}:${name}`;
}

type SummaryFields = Omit<WorldSummary, "name" | "chain" | "alive" | "lastCheckedAt">;

function extractSummaryFields(summary: WorldSummary | undefined, fallback: WorldSummary): SummaryFields {
  if (!summary) return fallback;
  return {
    mode: summary.mode,
    startSettlingAt: summary.startSettlingAt,
    startMainAt: summary.startMainAt,
    endAt: summary.endAt,
    devModeOn: summary.devModeOn,
    mmrEnabled: summary.mmrEnabled,
    singleRealmMode: summary.singleRealmMode,
    twoPlayerMode: summary.twoPlayerMode,
    seasonPassAddress: summary.seasonPassAddress,
    villagePassAddress: summary.villagePassAddress,
    worldAddress: summary.worldAddress,
    prizeDistributionAddress: summary.prizeDistributionAddress,
    entryTokenAddress: summary.entryTokenAddress,
    feeTokenAddress: summary.feeTokenAddress,
    feeAmount: summary.feeAmount,
    registrationCount: summary.registrationCount,
    registrationCountMax: summary.registrationCountMax,
    registrationStartAt: summary.registrationStartAt,
    registrationEndAt: summary.registrationEndAt,
    settledPlayersCount: summary.settledPlayersCount,
    settledRealmsCount: summary.settledRealmsCount,
    settledVillagesCount: summary.settledVillagesCount,
    winnerJackpotAmount: summary.winnerJackpotAmount,
  };
}

export class ToriiAvailabilityService {
  private cache = new Map<string, WorldSummary>();
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private pollInFlight: Promise<void> | null = null;
  private hasCompletedPoll = false;
  private factoryChains: string[];
  private pollIntervalMs: number;
  private probeTimeoutMs: number;
  private factoryTimeoutMs: number;

  constructor(opts?: {
    factoryChains?: string[];
    pollIntervalMs?: number;
    probeTimeoutMs?: number;
    factoryTimeoutMs?: number;
  }) {
    this.factoryChains = opts?.factoryChains ?? ["mainnet", "appchain"];
    this.pollIntervalMs = opts?.pollIntervalMs ?? 30_000;
    this.probeTimeoutMs = opts?.probeTimeoutMs ?? 5_000;
    this.factoryTimeoutMs = opts?.factoryTimeoutMs ?? 10_000;
  }

  /**
   * Probe a single world's torii endpoint and fold in summary data if alive.
   * Returns true if the endpoint is alive, false otherwise.
   */
  async probeWorld(
    worldName: string,
    chain: WorldSummaryChain = "mainnet",
    prizeDistributionAddress: string | null = null,
    worldAddress: string | null = null,
  ): Promise<boolean> {
    const now = Date.now();
    const cacheKey = getWorldCacheKey(chain, worldName);
    let alive = false;
    try {
      const url = `${CARTRIDGE_API_BASE}/x/${worldName}/torii/sql`;
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(this.probeTimeoutMs),
      });
      alive = response.ok;
    } catch {
      alive = false;
    }

    if (!alive) {
      const dead = buildNullSummary(worldName, chain, false, now);
      dead.prizeDistributionAddress = prizeDistributionAddress;
      dead.worldAddress = worldAddress;
      this.cache.set(cacheKey, dead);
      return false;
    }

    const fallbackFields = buildNullSummary(worldName, chain, true, now);
    const previousSummary = this.cache.get(cacheKey);
    const summaryResult = await fetchWorldSummaryResult(worldName, this.probeTimeoutMs);
    const summaryFields = summaryResult.ok
      ? summaryResult.fields
      : extractSummaryFields(previousSummary, fallbackFields);

    // Resolve the jackpot server-side (one RPC call per world per cycle) so
    // clients can read it from the summary instead of polling RPC themselves.
    // Only mainnet worlds render a prize pool; keep the last good value on failure.
    const resolvedPrizeAddress = prizeDistributionAddress ?? summaryFields.prizeDistributionAddress;
    let winnerJackpotAmount = previousSummary?.winnerJackpotAmount ?? null;
    if (chain === "mainnet" && summaryFields.feeTokenAddress && resolvedPrizeAddress) {
      const fetched = await fetchJackpotBalance(
        summaryFields.feeTokenAddress,
        resolvedPrizeAddress,
        this.probeTimeoutMs,
      );
      if (fetched != null) winnerJackpotAmount = fetched;
    }

    this.cache.set(cacheKey, {
      name: worldName,
      chain,
      alive: true,
      lastCheckedAt: now,
      ...summaryFields,
      winnerJackpotAmount,
      prizeDistributionAddress: resolvedPrizeAddress,
      worldAddress: worldAddress ?? summaryFields.worldAddress,
    });
    return true;
  }

  /**
   * Returns a `name → boolean` map for backcompat consumers of /api/availability/worlds.
   */
  getAvailability(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const entry of this.cache.values()) {
      result[entry.name] = entry.alive;
    }
    return result;
  }

  isSummaryReady(): boolean {
    return this.hasCompletedPoll && this.cache.size > 0;
  }

  /**
   * Returns the full list of per-world summaries. Stable order: (chain, name).
   */
  getSummaries(): WorldSummary[] {
    return Array.from(this.cache.values()).sort((a, b) => {
      if (a.chain !== b.chain) return a.chain.localeCompare(b.chain);
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Run one full poll cycle: fetch world names from all factory chains, then probe each.
   */
  async pollOnce(): Promise<void> {
    if (this.pollInFlight) {
      return this.pollInFlight;
    }

    const pollPromise = this.runPollCycle()
      .then(() => {
        this.hasCompletedPoll = true;
      })
      .finally(() => {
        if (this.pollInFlight === pollPromise) {
          this.pollInFlight = null;
        }
      });
    this.pollInFlight = pollPromise;
    return pollPromise;
  }

  private async runPollCycle(): Promise<void> {
    const deploymentByName = new Map<
      string,
      FactoryWorldDeployment & {
        chain: WorldSummaryChain;
      }
    >();
    const prizeByName = new Map<string, string>();

    for (const chain of this.factoryChains) {
      try {
        const [deployments, prizeAddresses] = await Promise.all([
          fetchFactoryWorldDeployments(chain, this.factoryTimeoutMs),
          fetchFactoryPrizeAddresses(chain, this.factoryTimeoutMs),
        ]);
        const chainKey = resolveChain(chain);
        for (const deployment of deployments) {
          if (!deploymentByName.has(deployment.name)) {
            deploymentByName.set(deployment.name, { ...deployment, chain: chainKey });
          }
        }
        for (const [name, address] of prizeAddresses) {
          if (!prizeByName.has(name)) {
            prizeByName.set(name, address);
          }
        }
      } catch (err) {
        console.error(`[torii-availability] Failed to fetch worlds for chain ${chain}:`, err);
      }
    }

    const entries = Array.from(deploymentByName.values());
    const concurrency = 10;

    for (let i = 0; i < entries.length; i += concurrency) {
      const batch = entries.slice(i, i + concurrency);
      await Promise.all(
        batch.map((deployment) =>
          this.probeWorld(
            deployment.name,
            deployment.chain,
            prizeByName.get(deployment.name) ?? null,
            deployment.worldAddress,
          ),
        ),
      );
    }
  }

  /**
   * Start background polling. Runs pollOnce immediately, then every pollIntervalMs.
   */
  start(): void {
    this.stop();
    this.pollOnce().catch((err) => {
      console.error("[torii-availability] Initial poll failed:", err);
    });
    this.pollIntervalId = setInterval(() => {
      this.pollOnce().catch((err) => {
        console.error("[torii-availability] Poll failed:", err);
      });
    }, this.pollIntervalMs);
  }

  /**
   * Stop background polling.
   */
  stop(): void {
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }
}

/** Singleton instance for use across the app. */
export const availabilityService = new ToriiAvailabilityService();
