/**
 * World discovery — resolves a chain + world name into all the config
 * the agent needs (torii URL, world address, RPC URL, contract addresses).
 *
 * Reuses shared factory utilities from @bibliothecadao/torii and
 * common/factory/endpoints so the agent stays in sync with the game client.
 */

import {
  FACTORY_QUERIES,
  buildApiUrl,
  fetchWithErrorHandling,
} from "@bibliothecadao/torii";
import type { Chain } from "../auth/policies.js";

const CARTRIDGE_API = "https://api.cartridge.gg";

/** Factory SQL base URL per chain (mirrors common/factory/endpoints.ts). */
function getFactorySqlBaseUrl(chain: Chain): string {
  switch (chain) {
    case "mainnet":
      return `${CARTRIDGE_API}/x/eternum-factory-mainnet/torii/sql`;
    case "sepolia":
      return `${CARTRIDGE_API}/x/eternum-factory-sepolia/torii/sql`;
    case "slot":
    case "slottest":
    case "local":
      return `${CARTRIDGE_API}/x/eternum-factory-slot-d/torii/sql`;
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Helpers (mirrors game client's factory-resolver.ts / normalize.ts)
// ---------------------------------------------------------------------------

function normalizeSelector(v: string): string {
  const body = (v.startsWith("0x") || v.startsWith("0X") ? v.slice(2) : v).toLowerCase();
  return `0x${body.padStart(64, "0")}`;
}

function normalizeAddress(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      const n = BigInt(value);
      if (n <= 0n) return null;
      return `0x${n.toString(16).padStart(64, "0")}`;
    } catch {
      return null;
    }
  }
  if (typeof value === "bigint" && value > 0n) return `0x${value.toString(16).padStart(64, "0")}`;
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function extractWorldAddress(row: Record<string, unknown>): string | null {
  for (const key of ["address", "contract_address", "world_address", "worldAddress"]) {
    const addr = normalizeAddress(row[key]);
    if (addr) return addr;
  }
  const data = asRecord(row.data);
  if (data) {
    for (const key of ["address", "contract_address", "world_address", "worldAddress"]) {
      const addr = normalizeAddress(data[key]);
      if (addr) return addr;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WorldInfo {
  toriiUrl: string;
  worldAddress: string;
  rpcUrl: string;
  /** Normalized selector → contract address, from the factory's wf-WorldContract table. */
  contractsBySelector: Record<string, string>;
}

/**
 * Resolve a world name + chain into the full connection info the agent needs.
 *
 * 1. Torii URL derived from the world name
 * 2. World address from factory's wf-WorldDeployed table
 * 3. Contract addresses from factory's wf-WorldContract table
 * 4. RPC URL defaults based on chain
 */
export async function discoverWorld(chain: Chain, worldName: string): Promise<WorldInfo> {
  const toriiUrl = `${CARTRIDGE_API}/x/${worldName}/torii`;

  // Verify Torii is reachable
  try {
    const res = await fetch(`${toriiUrl}/sql`, { method: "HEAD" });
    if (!res.ok) throw new Error(`Torii not available: ${res.status}`);
  } catch (err) {
    throw new Error(
      `Cannot reach Torii for world "${worldName}" at ${toriiUrl}: ${err instanceof Error ? err.message : err}`,
    );
  }

  // Resolve from factory
  const factoryUrl = getFactorySqlBaseUrl(chain);
  if (!factoryUrl) {
    throw new Error(`No factory endpoint for chain "${chain}"`);
  }

  // Run both factory queries in parallel
  const [deployedRows, contractRows] = await Promise.all([
    fetchWithErrorHandling<Record<string, unknown>>(
      buildApiUrl(factoryUrl, FACTORY_QUERIES.WORLD_DEPLOYED_BY_PADDED_NAME(nameToPaddedFelt(worldName))),
      `Factory lookup failed for world "${worldName}"`,
    ),
    fetchWithErrorHandling<{ contract_address: string; contract_selector: string }>(
      buildApiUrl(factoryUrl, FACTORY_QUERIES.WORLD_CONTRACTS_BY_PADDED_NAME(nameToPaddedFelt(worldName))),
      `Factory contract lookup failed for world "${worldName}"`,
    ),
  ]);

  if (deployedRows.length === 0) {
    throw new Error(`World "${worldName}" not found in factory for chain "${chain}"`);
  }

  const worldAddress = extractWorldAddress(deployedRows[0]);
  if (!worldAddress) {
    throw new Error(`Could not extract world address for "${worldName}" from factory`);
  }

  // Build selector → address map (same as game client's resolveWorldContracts)
  const contractsBySelector: Record<string, string> = {};
  for (const row of contractRows) {
    const key = normalizeSelector(row.contract_selector);
    contractsBySelector[key] = row.contract_address;
  }

  // Default RPC based on chain
  const rpcUrl =
    chain === "sepolia"
      ? `${CARTRIDGE_API}/x/starknet/sepolia`
      : `${CARTRIDGE_API}/x/starknet/mainnet`;

  return { toriiUrl, worldAddress, rpcUrl, contractsBySelector };
}

// ---------------------------------------------------------------------------
// Manifest patching (mirrors game client's manifest-patcher.ts)
// ---------------------------------------------------------------------------

/**
 * Returns a new manifest with contract addresses overwritten from the factory map
 * and the world address set. This is the same logic as the game client's
 * `patchManifestWithFactory`.
 */
export function patchManifest(
  baseManifest: any,
  worldAddress: string,
  contractsBySelector: Record<string, string>,
): any {
  const manifest = JSON.parse(JSON.stringify(baseManifest));

  if (manifest?.world) {
    manifest.world.address = worldAddress;
  }

  if (Array.isArray(manifest?.contracts)) {
    manifest.contracts = manifest.contracts.map((c: any) => {
      if (!c?.selector) return c;
      const key = normalizeSelector(c.selector);
      const addr = contractsBySelector[key];
      if (addr) {
        return { ...c, address: addr };
      }
      return c;
    });
  }

  return manifest;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function nameToPaddedFelt(name: string): string {
  const bytes = new TextEncoder().encode(name);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `0x${hex.padStart(64, "0")}`;
}
