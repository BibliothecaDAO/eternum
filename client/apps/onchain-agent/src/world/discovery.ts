import { readFile } from "node:fs/promises";
import path from "node:path";
import { fetchFactoryRows, decodePaddedFeltAscii, extractNameFelt } from "./factory-sql";
import { resolveWorldContracts, resolveWorldDeploymentFromFactory, isToriiAvailable } from "./factory-resolver";
import { patchManifestWithFactory } from "./manifest-patcher";
import { normalizeRpcUrl } from "./normalize";
import type { WorldProfile } from "./types";

export type Chain = "slot" | "slottest" | "local" | "sepolia" | "mainnet";

export type GameStatus = "upcoming" | "ongoing" | "ended" | "unknown";

export interface DiscoveredWorld {
  name: string;
  chain: Chain;
  status: GameStatus;
}

function getFactorySqlBaseUrl(chain: Chain): string {
  const base = process.env.CARTRIDGE_API_BASE || "https://api.cartridge.gg";
  switch (chain) {
    case "mainnet":
      return `${base}/x/eternum-factory-mainnet/torii/sql`;
    case "sepolia":
      return `${base}/x/eternum-factory-sepolia/torii/sql`;
    case "slot":
    case "slottest":
    case "local":
      return `${base}/x/eternum-factory-slot-a/torii/sql`;
  }
}

const buildToriiBaseUrl = (worldName: string) => `https://api.cartridge.gg/x/${worldName}/torii`;

function getDefaultRpcUrl(chain: Chain): string {
  const base = process.env.CARTRIDGE_API_BASE || "https://api.cartridge.gg";
  switch (chain) {
    case "mainnet":
      return `${base}/x/starknet/mainnet`;
    case "sepolia":
      return `${base}/x/starknet/sepolia`;
    case "slot":
    case "slottest":
    case "local":
      return `${base}/x/eternum-blitz-slot-3/katana`;
  }
}

const WORLD_CONFIG_QUERY = `SELECT "season_config.start_main_at" AS start_main_at, "season_config.end_at" AS end_at FROM "s1_eternum-WorldConfig" LIMIT 1;`;

const parseMaybeHexToNumber = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    try {
      if (v.startsWith("0x") || v.startsWith("0X")) return Number(BigInt(v));
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  return null;
};

function deriveGameStatus(startMainAt: number | null, endAt: number | null): GameStatus {
  const nowSec = Math.floor(Date.now() / 1000);
  if (endAt != null && endAt > 0 && nowSec > endAt) return "ended";
  if (startMainAt != null && startMainAt > 0 && nowSec >= startMainAt) return "ongoing";
  if (startMainAt != null && startMainAt > 0 && nowSec < startMainAt) return "upcoming";
  return "unknown";
}

async function checkWorldAvailability(worldName: string): Promise<{ available: boolean; status: GameStatus }> {
  const toriiBaseUrl = buildToriiBaseUrl(worldName);

  const available = await isToriiAvailable(toriiBaseUrl);
  if (!available) return { available: false, status: "ended" };

  try {
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(WORLD_CONFIG_QUERY)}`;
    const res = await fetch(url);
    if (!res.ok) return { available: true, status: "unknown" };
    const rows = (await res.json()) as Record<string, unknown>[];
    const row = rows[0];
    if (!row) return { available: true, status: "unknown" };

    const startMainAt = parseMaybeHexToNumber(row.start_main_at);
    const endAt = parseMaybeHexToNumber(row.end_at);
    const status = deriveGameStatus(startMainAt, endAt);
    return { available: true, status };
  } catch {
    return { available: true, status: "unknown" };
  }
}

const DISCOVERABLE_CHAINS: Chain[] = ["slot", "sepolia", "mainnet"];

async function discoverWorldsForChain(chain: Chain): Promise<DiscoveredWorld[]> {
  const factoryUrl = getFactorySqlBaseUrl(chain);
  if (!factoryUrl) return [];

  try {
    const query = `SELECT name FROM [wf-WorldDeployed] LIMIT 1000;`;
    const rows = await fetchFactoryRows(factoryUrl, query);

    const seen = new Set<string>();
    const candidates: { name: string; chain: Chain }[] = [];

    for (const row of rows) {
      const nameFelt = extractNameFelt(row);
      if (!nameFelt) continue;
      const name = decodePaddedFeltAscii(nameFelt);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      candidates.push({ name, chain });
    }

    // Check availability + game status in parallel
    const checks = await Promise.all(
      candidates.map(async (c) => {
        const { available, status } = await checkWorldAvailability(c.name);
        return { ...c, available, status };
      }),
    );

    // Filter out unavailable and ended worlds
    return checks
      .filter((w) => w.available && w.status !== "ended")
      .map(({ name, chain, status }) => ({ name, chain, status }));
  } catch {
    return [];
  }
}

export async function discoverAllWorlds(): Promise<DiscoveredWorld[]> {
  const results = await Promise.all(DISCOVERABLE_CHAINS.map(discoverWorldsForChain));
  return results.flat();
}

const normalizeTokenAddress = (value: unknown): string | undefined => {
  if (value == null) return undefined;
  if (typeof value === "string") return value || undefined;
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  return undefined;
};

const TOKEN_CONFIG_QUERY = `SELECT "blitz_registration_config.entry_token_address" AS entry_token_address, "blitz_registration_config.fee_token" AS fee_token FROM "s1_eternum-WorldConfig" LIMIT 1;`;

async function fetchTokenAddresses(
  toriiBaseUrl: string,
): Promise<{ entryTokenAddress?: string; feeTokenAddress?: string }> {
  try {
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(TOKEN_CONFIG_QUERY)}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const rows = (await res.json()) as Record<string, unknown>[];
    const row = rows[0];
    if (!row) return {};
    return {
      entryTokenAddress: normalizeTokenAddress(row.entry_token_address),
      feeTokenAddress: normalizeTokenAddress(row.fee_token),
    };
  } catch {
    return {};
  }
}

export async function buildWorldProfile(chain: Chain, worldName: string): Promise<WorldProfile> {
  const factoryUrl = getFactorySqlBaseUrl(chain);

  const [contractsBySelector, deployment] = await Promise.all([
    resolveWorldContracts(factoryUrl, worldName),
    resolveWorldDeploymentFromFactory(factoryUrl, worldName),
  ]);

  const worldAddress = deployment?.worldAddress;
  if (!worldAddress) {
    throw new Error(`Could not resolve world address for "${worldName}" on ${chain}`);
  }

  const toriiBaseUrl = `https://api.cartridge.gg/x/${worldName}/torii`;
  const rpcUrl = normalizeRpcUrl(deployment?.rpcUrl ?? getDefaultRpcUrl(chain));

  const { entryTokenAddress, feeTokenAddress } = await fetchTokenAddresses(toriiBaseUrl);

  return {
    name: worldName,
    chain,
    toriiBaseUrl,
    rpcUrl,
    worldAddress,
    contractsBySelector,
    entryTokenAddress,
    feeTokenAddress,
    fetchedAt: Date.now(),
  };
}

const MANIFEST_CHAIN_MAP: Record<Chain, string> = {
  slot: "manifest_slot.json",
  slottest: "manifest_slottest.json",
  local: "manifest_local.json",
  sepolia: "manifest_sepolia.json",
  mainnet: "manifest_mainnet.json",
};

export async function buildResolvedManifest(chain: Chain, profile: WorldProfile): Promise<{ contracts: unknown[] }> {
  const manifestFile = MANIFEST_CHAIN_MAP[chain];
  const manifestPath = path.resolve(
    import.meta.dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "contracts",
    "game",
    manifestFile,
  );

  const raw = await readFile(manifestPath, "utf8");
  const baseManifest = JSON.parse(raw);

  return patchManifestWithFactory(baseManifest, profile.worldAddress, profile.contractsBySelector);
}
