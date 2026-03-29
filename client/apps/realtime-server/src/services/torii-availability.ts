export interface WorldAvailabilityEntry {
  alive: boolean;
  lastChecked: number;
}

const FACTORY_WORLDS_QUERY = `SELECT name, address FROM [wf-WorldDeployed] LIMIT 1000;`;

const CARTRIDGE_API_BASE = "https://api.cartridge.gg";

/**
 * Decode a zero-padded felt (hex string) into an ASCII string.
 */
const decodePaddedFeltAscii = (felt: string): string => {
  const hex = felt.startsWith("0x") || felt.startsWith("0X") ? felt.slice(2) : felt;
  const stripped = hex.replace(/^0+/, "");
  if (!stripped || stripped.length % 2 !== 0) return "";
  let result = "";
  for (let i = 0; i < stripped.length; i += 2) {
    result += String.fromCharCode(parseInt(stripped.slice(i, i + 2), 16));
  }
  return result;
};

/**
 * Get the factory SQL base URL for a chain (inline to avoid cross-package import issues).
 */
function getFactorySqlBaseUrl(chain: string): string {
  switch (chain) {
    case "mainnet":
      return `${CARTRIDGE_API_BASE}/x/eternum-factory-mainnet/torii/sql`;
    case "sepolia":
      return `${CARTRIDGE_API_BASE}/x/eternum-factory-sepolia/torii/sql`;
    case "slot":
    case "slottest":
    case "local":
      return `${CARTRIDGE_API_BASE}/x/eternum-factory-slot-d/torii/sql`;
    default:
      return "";
  }
}

/**
 * Extract the name felt from a factory row (handles multiple response shapes).
 */
const extractNameFelt = (row: Record<string, unknown>): string | null => {
  const direct = row.name ?? row["data.name"];
  if (typeof direct === "string") return direct;
  if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
    const nested = (row.data as Record<string, unknown>).name;
    if (typeof nested === "string") return nested;
  }
  return null;
};

/**
 * Fetch world names from a factory indexer.
 */
async function fetchWorldNamesFromFactory(chain: string): Promise<string[]> {
  const baseUrl = getFactorySqlBaseUrl(chain);
  if (!baseUrl) return [];

  const url = `${baseUrl}?query=${encodeURIComponent(FACTORY_WORLDS_QUERY)}`;
  const response = await fetch(url);
  if (!response.ok) return [];

  const rows = (await response.json()) as Record<string, unknown>[];
  if (!Array.isArray(rows)) return [];

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
  private factoryChains: string[];
  private pollIntervalMs: number;
  private probeTimeoutMs: number;

  constructor(opts?: { factoryChains?: string[]; pollIntervalMs?: number; probeTimeoutMs?: number }) {
    this.factoryChains = opts?.factoryChains ?? ["mainnet", "slot"];
    this.pollIntervalMs = opts?.pollIntervalMs ?? 30_000;
    this.probeTimeoutMs = opts?.probeTimeoutMs ?? 5_000;
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
    const allNames = new Set<string>();

    for (const chain of this.factoryChains) {
      try {
        const names = await fetchWorldNamesFromFactory(chain);
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
