import type { WorldSummary, WorldSummaryChain } from "@bibliothecadao/types";
import { fetchFactoryPrizeAddresses } from "./factory-prize-addresses";
import { fetchFactoryWorldNames } from "./factory-worlds";
import { fetchWorldSummary } from "./world-summary";

export interface WorldAvailabilityEntry {
  alive: boolean;
  lastChecked: number;
}

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
    prizeDistributionAddress: null,
    feeTokenAddress: null,
    registrationCount: null,
    registrationCountMax: null,
    settledPlayersCount: null,
    settledRealmsCount: null,
    settledVillagesCount: null,
    numHyperstructuresLeft: null,
    winnerJackpotAmount: null,
  };
}

function resolveChain(chain: string): WorldSummaryChain {
  return chain === "mainnet" ? "mainnet" : "slot";
}

export class ToriiAvailabilityService {
  private cache = new Map<string, WorldSummary>();
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private pollInFlight: Promise<void> | null = null;
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
    this.factoryChains = opts?.factoryChains ?? ["mainnet", "slot"];
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
  ): Promise<boolean> {
    const now = Date.now();
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
      this.cache.set(worldName, dead);
      return false;
    }

    const summaryFields = await fetchWorldSummary(worldName, this.probeTimeoutMs);
    this.cache.set(worldName, {
      name: worldName,
      chain,
      alive: true,
      lastCheckedAt: now,
      ...summaryFields,
      prizeDistributionAddress,
    });
    return true;
  }

  /**
   * Returns a `name → boolean` map for backcompat consumers of /api/availability/worlds.
   */
  getAvailability(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const [name, entry] of this.cache) {
      result[name] = entry.alive;
    }
    return result;
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

    const pollPromise = this.runPollCycle().finally(() => {
      if (this.pollInFlight === pollPromise) {
        this.pollInFlight = null;
      }
    });
    this.pollInFlight = pollPromise;
    return pollPromise;
  }

  private async runPollCycle(): Promise<void> {
    const chainByName = new Map<string, WorldSummaryChain>();
    const prizeByName = new Map<string, string>();

    for (const chain of this.factoryChains) {
      try {
        const [names, prizeAddresses] = await Promise.all([
          fetchFactoryWorldNames(chain, this.factoryTimeoutMs),
          fetchFactoryPrizeAddresses(chain, this.factoryTimeoutMs),
        ]);
        const chainKey = resolveChain(chain);
        for (const name of names) {
          if (!chainByName.has(name)) {
            chainByName.set(name, chainKey);
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

    const entries = Array.from(chainByName.entries());
    const concurrency = 10;

    for (let i = 0; i < entries.length; i += concurrency) {
      const batch = entries.slice(i, i + concurrency);
      await Promise.all(
        batch.map(([name, chain]) => this.probeWorld(name, chain, prizeByName.get(name) ?? null)),
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
