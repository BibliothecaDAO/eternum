import {
  decodePaddedFeltAscii,
  extractNameFelt,
  fetchFactoryRows,
  getFactorySqlBaseUrl,
} from "../../../../../common/factory/endpoints";

export interface WorldAvailabilityEntry {
  alive: boolean;
  lastChecked: number;
}

const FACTORY_WORLDS_QUERY = `SELECT name, address FROM [wf-WorldDeployed] LIMIT 1000;`;

const CARTRIDGE_API_BASE = "https://api.cartridge.gg";

/**
 * Fetch world names from a factory indexer.
 */
async function fetchWorldNamesFromFactory(chain: string, timeoutMs: number): Promise<string[]> {
  const baseUrl = getFactorySqlBaseUrl(chain);
  if (!baseUrl) return [];

  const rows = await fetchFactoryRows(baseUrl, FACTORY_WORLDS_QUERY, { timeoutMs });

  const names: string[] = [];
  for (const row of rows) {
    const nameFelt = extractNameFelt(row);
    if (!nameFelt) continue;
    const decoded = decodePaddedFeltAscii(nameFelt);
    if (decoded) names.push(decoded);
  }

  return names;
}

export class ToriiAvailabilityService {
  private cache = new Map<string, WorldAvailabilityEntry>();
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
   * Probe a single world's torii endpoint.
   * Returns true if the endpoint is alive (2xx), false otherwise.
   */
  async probeWorld(worldName: string): Promise<boolean> {
    try {
      const url = `${CARTRIDGE_API_BASE}/x/${worldName}/torii/sql`;
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(this.probeTimeoutMs),
      });
      const alive = response.ok;
      this.cache.set(worldName, { alive, lastChecked: Date.now() });
      return alive;
    } catch {
      this.cache.set(worldName, { alive: false, lastChecked: Date.now() });
      return false;
    }
  }

  /**
   * Get the full availability map as a plain object.
   */
  getAvailability(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const [name, entry] of this.cache) {
      result[name] = entry.alive;
    }
    return result;
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
    const allNames = new Set<string>();

    for (const chain of this.factoryChains) {
      try {
        const names = await fetchWorldNamesFromFactory(chain, this.factoryTimeoutMs);
        for (const name of names) {
          allNames.add(name);
        }
      } catch (err) {
        console.error(`[torii-availability] Failed to fetch worlds for chain ${chain}:`, err);
      }
    }

    // Probe all worlds with concurrency limit of 10
    const names = Array.from(allNames);
    const concurrency = 10;

    for (let i = 0; i < names.length; i += concurrency) {
      const batch = names.slice(i, i + concurrency);
      await Promise.all(batch.map((name) => this.probeWorld(name)));
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
