import { fetchFactoryRows, getFactorySqlBaseUrl } from "./factory-sql";

type SupportedChain = "mainnet" | "sepolia" | "slot" | "slottest" | "local";
type CacheStatus = "hit" | "miss" | "stale";

type WorldDeploymentRecord = {
  chain: SupportedChain;
  worldName: string;
  worldAddress: string | null;
  rpcUrl: string | null;
  fetchedAt: number;
};

type CachedWorldDeployment = WorldDeploymentRecord & {
  cacheStatus: CacheStatus;
};

type CacheEntry = {
  deployment: WorldDeploymentRecord;
  fetchedAt: number;
};

const SUPPORTED_CHAINS: readonly SupportedChain[] = ["mainnet", "sepolia", "slot", "slottest", "local"];

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_STALE_MS = 5 * 60_000;
const DEFAULT_TIMEOUT_MS = 10_000;

const isSupportedChain = (chain: string): chain is SupportedChain => {
  return (SUPPORTED_CHAINS as readonly string[]).includes(chain);
};

const nameToPaddedFelt = (name: string) => {
  const bytes = new TextEncoder().encode(name);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return `0x${hex.padStart(64, "0")}`;
};

const buildWorldDeploymentQuery = (worldName: string) => {
  const paddedName = nameToPaddedFelt(worldName);
  return `SELECT * FROM [wf-WorldDeployed] WHERE name = "${paddedName}" LIMIT 1;`;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

const normalizeAddress = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "bigint") {
    return `0x${value.toString(16)}`;
  }
  return null;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const extractFirstString = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = normalizeString(record[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

const extractRpcUrlFromRow = (row: Record<string, unknown>): string | null => {
  const direct = extractFirstString(row, ["rpc_url", "rpcUrl", "node_url", "nodeUrl", "rpc", "node"]);
  if (direct) {
    return direct;
  }

  const data = asRecord(row.data);
  if (data) {
    const nested = extractFirstString(data, ["rpc_url", "rpcUrl", "node_url", "nodeUrl", "rpc", "node"]);
    if (nested) {
      return nested;
    }
  }

  return extractFirstString(row, ["data.rpc_url", "data.rpcUrl", "data.node_url", "data.nodeUrl"]);
};

const extractWorldAddressFromRow = (row: Record<string, unknown>): string | null => {
  const direct =
    normalizeAddress(row.address) ??
    normalizeAddress(row.contract_address) ??
    normalizeAddress(row.world_address) ??
    normalizeAddress(row.worldAddress);
  if (direct) {
    return direct;
  }

  const data = asRecord(row.data);
  if (data) {
    return (
      normalizeAddress(data.address) ??
      normalizeAddress(data.contract_address) ??
      normalizeAddress(data.world_address) ??
      normalizeAddress(data.worldAddress)
    );
  }

  return (
    normalizeAddress(row["data.address"]) ??
    normalizeAddress(row["data.contract_address"]) ??
    normalizeAddress(row["data.world_address"]) ??
    normalizeAddress(row["data.worldAddress"])
  );
};

const toCacheKey = (chain: SupportedChain, worldName: string) => `${chain}:${worldName}`;

export class WorldDeploymentService {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<CachedWorldDeployment | null>>();
  private readonly ttlMs: number;
  private readonly staleMs: number;
  private readonly timeoutMs: number;

  constructor(opts?: { ttlMs?: number; staleMs?: number; timeoutMs?: number }) {
    this.ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;
    this.staleMs = opts?.staleMs ?? DEFAULT_STALE_MS;
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async getWorldDeployment(chain: string, worldName: string): Promise<CachedWorldDeployment | null> {
    if (!isSupportedChain(chain)) {
      throw new Error("invalid chain");
    }

    const cacheKey = toCacheKey(chain, worldName);
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.fetchedAt <= this.ttlMs) {
      return {
        ...cached.deployment,
        cacheStatus: "hit",
      };
    }

    const existingRequest = this.inFlight.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }

    const request = this.fetchAndCacheWorldDeployment(chain, worldName, cached).finally(() => {
      if (this.inFlight.get(cacheKey) === request) {
        this.inFlight.delete(cacheKey);
      }
    });

    this.inFlight.set(cacheKey, request);
    return request;
  }

  private async fetchAndCacheWorldDeployment(
    chain: SupportedChain,
    worldName: string,
    cached: CacheEntry | undefined,
  ): Promise<CachedWorldDeployment | null> {
    try {
      const deployment = await this.fetchWorldDeployment(chain, worldName);
      if (!deployment) {
        return null;
      }

      const cacheStatus: CacheStatus = cached ? "stale" : "miss";
      return {
        ...deployment,
        cacheStatus,
      };
    } catch (error) {
      if (cached && Date.now() - cached.fetchedAt <= this.staleMs) {
        return {
          ...cached.deployment,
          cacheStatus: "stale",
        };
      }
      throw error;
    }
  }

  private async fetchWorldDeployment(chain: SupportedChain, worldName: string): Promise<WorldDeploymentRecord | null> {
    const baseUrl = getFactorySqlBaseUrl(chain);
    if (!baseUrl) {
      return null;
    }

    const query = buildWorldDeploymentQuery(worldName);
    const rows = await fetchFactoryRows(baseUrl, query, this.timeoutMs);
    if (rows.length === 0) {
      return null;
    }

    const deployment: WorldDeploymentRecord = {
      chain,
      fetchedAt: Date.now(),
      rpcUrl: extractRpcUrlFromRow(rows[0]!),
      worldAddress: extractWorldAddressFromRow(rows[0]!),
      worldName,
    };

    this.cache.set(toCacheKey(chain, worldName), {
      deployment,
      fetchedAt: deployment.fetchedAt,
    });

    return deployment;
  }
}

export const worldDeploymentService = new WorldDeploymentService();
