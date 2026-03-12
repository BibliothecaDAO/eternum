/**
 * World discovery — resolves a chain + world name into all the config
 * the agent needs (torii URL, world address, RPC URL, contract addresses).
 *
 * Reuses shared factory utilities from @bibliothecadao/torii and
 * common/factory/endpoints so the agent stays in sync with the game client.
 */

import { FACTORY_QUERIES, buildApiUrl, fetchWithErrorHandling } from "@bibliothecadao/torii";
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

/** Extract the RPC URL from a factory WorldDeployed row (mirrors game client's extractRpcUrlFromRow). */
function extractRpcUrl(row: Record<string, unknown>): string | null {
  const keys = ["rpc_url", "rpcUrl", "node_url", "nodeUrl", "rpc", "node"];
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  const data = asRecord(row.data);
  if (data) {
    for (const key of keys) {
      const v = data[key];
      if (typeof v === "string" && v.length > 0) return v;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full connection descriptor for a deployed Eternum world.
 * Resolved from the Cartridge factory; provides everything the agent needs
 * to connect to Torii and StarkNet.
 */
interface WorldInfo {
  /** Base Torii GraphQL/SQL URL for the world (e.g. `https://api.cartridge.gg/x/<worldName>/torii`). */
  toriiUrl: string;
  /** Normalized 64-hex-digit world contract address (0x-prefixed). */
  worldAddress: string;
  /** StarkNet RPC endpoint for sending transactions; derived from the factory row or chain defaults. */
  rpcUrl: string;
  /** Normalized selector → contract address, from the factory's wf-WorldContract table. */
  contractsBySelector: Record<string, string>;
}

/**
 * Resolve a world name and chain into full connection info.
 *
 * 1. Derives the Torii URL from the world name and verifies it is reachable.
 * 2. Fetches the world address from the factory's wf-WorldDeployed table.
 * 3. Fetches all contract addresses from the factory's wf-WorldContract table.
 * 4. Determines the RPC URL from the factory row, falling back to per-chain defaults.
 *
 * @param chain - Target chain identifier (e.g. "mainnet", "sepolia", "slot").
 * @param worldName - Cartridge world slug (e.g. "eternum-blitz-slot-4").
 * @returns Resolved {@link WorldInfo} with Torii URL, world address, RPC URL, and contract map.
 * @throws {Error} If the Torii endpoint is unreachable or returns a non-OK response.
 * @throws {Error} If the chain has no known factory endpoint.
 * @throws {Error} If the world is not found in the factory registry.
 * @throws {Error} If the world address cannot be extracted from the factory row.
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

  // Extract RPC URL from factory row, or fall back to chain defaults.
  // Slot worlds share a single katana instance (mirrors game client's profile-builder.ts).
  const factoryRpc = extractRpcUrl(deployedRows[0]);
  const defaultRpc = (() => {
    switch (chain) {
      case "slot":
        return `${CARTRIDGE_API}/x/eternum-blitz-slot-4/katana`;
      case "slottest":
        return `${CARTRIDGE_API}/x/eternum-blitz-slot-test/katana`;
      case "sepolia":
        return `${CARTRIDGE_API}/x/starknet/sepolia`;
      default:
        return `${CARTRIDGE_API}/x/starknet/mainnet`;
    }
  })();
  const rpcUrl = factoryRpc ?? defaultRpc;

  return { toriiUrl, worldAddress, rpcUrl, contractsBySelector };
}

// ---------------------------------------------------------------------------
// Manifest patching (mirrors game client's manifest-patcher.ts)
// ---------------------------------------------------------------------------

/**
 * Return a deep-cloned manifest with contract addresses overwritten from the factory map
 * and the world address updated. Mirrors the game client's `patchManifestWithFactory`.
 *
 * @param baseManifest - Original Dojo manifest to patch (not mutated).
 * @param worldAddress - Normalized world contract address to set on `manifest.world.address`.
 * @param contractsBySelector - Map of normalized selector → live contract address from the factory.
 * @returns New manifest with addresses replaced wherever a factory entry exists.
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
