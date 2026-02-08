import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FACTORY_QUERIES, buildApiUrl, fetchWithErrorHandling, SqlApi } from "@bibliothecadao/torii";

export type Chain = "slot" | "slottest" | "local" | "sepolia" | "mainnet";

export interface ResolvedWorld {
  manifest: { contracts: unknown[]; world?: { address: string }; [key: string]: unknown };
  worldAddress: string;
  toriiUrl: string;
  rpcUrl: string;
}

// ---------------------------------------------------------------------------
// Hex / felt helpers (from game client's normalize.ts)
// ---------------------------------------------------------------------------

const strip0x = (v: string) => (v.startsWith("0x") || v.startsWith("0X") ? v.slice(2) : v);

const normalizeSelector = (v: string) => {
  const body = strip0x(v).toLowerCase().padStart(64, "0");
  return `0x${body}`;
};

const nameToPaddedFelt = (name: string) => {
  const bytes = new TextEncoder().encode(name);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `0x${hex.padStart(64, "0")}`;
};

// ---------------------------------------------------------------------------
// Factory endpoint resolution (from common/factory/endpoints.ts)
// ---------------------------------------------------------------------------

function getFactorySqlBaseUrl(chain: Chain, cartridgeApiBase: string): string {
  switch (chain) {
    case "mainnet":
      return `${cartridgeApiBase}/x/eternum-factory-mainnet/torii/sql`;
    case "sepolia":
      return `${cartridgeApiBase}/x/eternum-factory-sepolia/torii/sql`;
    case "slot":
    case "slottest":
    case "local":
      return `${cartridgeApiBase}/x/eternum-factory-slot-a/torii/sql`;
  }
}

// ---------------------------------------------------------------------------
// Base manifest loading
// ---------------------------------------------------------------------------

const MANIFEST_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../contracts/game",
);

const MANIFEST_FILES: Record<Chain, string> = {
  local: "manifest_local.json",
  slot: "manifest_slot.json",
  slottest: "manifest_slottest.json",
  sepolia: "manifest_sepolia.json",
  mainnet: "manifest_mainnet.json",
};

async function loadBaseManifest(chain: Chain): Promise<Record<string, unknown>> {
  const file = MANIFEST_FILES[chain];
  const fullPath = path.join(MANIFEST_DIR, file);
  const raw = await readFile(fullPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.contracts)) {
    throw new Error(`Invalid base manifest at ${fullPath}: missing contracts[]`);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Factory queries
// ---------------------------------------------------------------------------

interface FactoryContractRow {
  contract_address: string;
  contract_selector: string;
  name?: string;
}

async function resolveWorldContracts(
  factorySqlBaseUrl: string,
  gameName: string,
): Promise<Record<string, string>> {
  const paddedName = nameToPaddedFelt(gameName);
  const query = FACTORY_QUERIES.WORLD_CONTRACTS_BY_PADDED_NAME(paddedName);
  const url = buildApiUrl(factorySqlBaseUrl, query);
  const rows = await fetchWithErrorHandling<FactoryContractRow>(url, "Factory: failed to fetch world contracts");

  const map: Record<string, string> = {};
  for (const row of rows) {
    map[normalizeSelector(row.contract_selector)] = row.contract_address;
  }
  return map;
}

async function resolveWorldDeployment(
  factorySqlBaseUrl: string,
  gameName: string,
): Promise<{ worldAddress: string | null; rpcUrl: string | null }> {
  const paddedName = nameToPaddedFelt(gameName);
  const query = FACTORY_QUERIES.WORLD_DEPLOYED_BY_PADDED_NAME(paddedName);
  const url = buildApiUrl(factorySqlBaseUrl, query);

  try {
    const rows = await fetchWithErrorHandling<Record<string, unknown>>(url, "Factory: failed to fetch world deployment");
    if (rows.length === 0) return { worldAddress: null, rpcUrl: null };
    const row = rows[0];

    const extractAddress = (r: Record<string, unknown>): string | null => {
      for (const key of ["address", "contract_address", "world_address", "worldAddress"]) {
        const v = r[key];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return null;
    };

    const extractRpc = (r: Record<string, unknown>): string | null => {
      for (const key of ["rpc_url", "rpcUrl", "node_url", "nodeUrl"]) {
        const v = r[key];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return null;
    };

    return {
      worldAddress: extractAddress(row),
      rpcUrl: extractRpc(row),
    };
  } catch {
    return { worldAddress: null, rpcUrl: null };
  }
}

// ---------------------------------------------------------------------------
// Manifest patching (from game client's manifest-patcher.ts)
// ---------------------------------------------------------------------------

function patchManifest(
  baseManifest: Record<string, unknown>,
  worldAddress: string,
  contractsBySelector: Record<string, string>,
): Record<string, unknown> {
  const manifest = JSON.parse(JSON.stringify(baseManifest));

  if (manifest.world && typeof manifest.world === "object") {
    (manifest.world as Record<string, unknown>).address = worldAddress;
  }

  if (Array.isArray(manifest.contracts)) {
    manifest.contracts = manifest.contracts.map((c: any) => {
      if (!c?.selector) return c;
      const key = normalizeSelector(c.selector);
      const addr = contractsBySelector[key];
      return addr ? { ...c, address: addr } : c;
    });
  }

  return manifest;
}

// ---------------------------------------------------------------------------
// RPC URL normalization
// ---------------------------------------------------------------------------

function normalizeRpcUrl(value: string): string {
  if (!value || value.includes("/rpc/")) return value;
  try {
    const url = new URL(value);
    if (!url.hostname.endsWith("cartridge.gg")) return value;
    const p = url.pathname.replace(/\/+$/, "");
    if (p.endsWith("/katana") || /\/starknet\/(mainnet|sepolia)$/i.test(p)) {
      url.pathname = `${p}/rpc/v0_9`;
      return url.toString();
    }
  } catch {
    // ignore
  }
  return value;
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

const CARTRIDGE_API_BASE = "https://api.cartridge.gg";

export async function resolveManifest(chain: Chain, gameName: string): Promise<ResolvedWorld> {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain, CARTRIDGE_API_BASE);
  const toriiUrl = `${CARTRIDGE_API_BASE}/x/${gameName}/torii/sql`;

  console.log(`Resolving world config for game "${gameName}" on chain "${chain}"...`);

  // Load base manifest
  const baseManifest = await loadBaseManifest(chain);

  // Query factory for contracts + deployment info
  const [contractsBySelector, deployment] = await Promise.all([
    resolveWorldContracts(factorySqlBaseUrl, gameName),
    resolveWorldDeployment(factorySqlBaseUrl, gameName),
  ]);

  // Resolve world address: try target Torii first, then factory fallback
  let worldAddress: string | null = null;
  try {
    const sqlApi = new SqlApi(toriiUrl);
    const addr = await sqlApi.fetchWorldAddress();
    if (addr != null) {
      worldAddress = typeof addr === "bigint" ? `0x${addr.toString(16)}` : String(addr);
    }
  } catch {
    // ignore, try factory fallback
  }
  if (!worldAddress) {
    worldAddress = deployment.worldAddress;
  }
  if (!worldAddress) {
    worldAddress = "0x0";
    console.warn("Could not resolve world address; defaulting to 0x0");
  }

  // Resolve RPC URL
  const defaultRpcUrl =
    chain === "slot" || chain === "slottest"
      ? `${CARTRIDGE_API_BASE}/x/eternum-blitz-slot-3/katana/rpc/v0_9`
      : chain === "mainnet" || chain === "sepolia"
        ? `${CARTRIDGE_API_BASE}/x/starknet/${chain}/rpc/v0_9`
        : "http://localhost:5050";
  const rpcUrl = normalizeRpcUrl(deployment.rpcUrl ?? defaultRpcUrl);

  // Patch manifest with factory-resolved addresses
  const patchedContractCount = Object.keys(contractsBySelector).length;
  const manifest = patchedContractCount > 0
    ? patchManifest(baseManifest, worldAddress, contractsBySelector)
    : baseManifest;

  // If no factory patching happened, still set the world address on the base manifest
  if (patchedContractCount === 0 && manifest.world && typeof manifest.world === "object") {
    (manifest.world as Record<string, unknown>).address = worldAddress;
  }

  console.log(`  World address: ${worldAddress}`);
  console.log(`  Torii: ${toriiUrl}`);
  console.log(`  RPC: ${rpcUrl}`);
  console.log(`  Factory contracts patched: ${patchedContractCount}`);

  return {
    manifest: manifest as ResolvedWorld["manifest"],
    worldAddress,
    toriiUrl,
    rpcUrl,
  };
}
