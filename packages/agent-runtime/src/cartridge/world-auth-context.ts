import { FACTORY_QUERIES, buildApiUrl, fetchWithErrorHandling } from "@bibliothecadao/torii";

import { buildCartridgePolicies } from "./policies";
import { computeCartridgePolicyFingerprint } from "./policy-fingerprint";
import { getEmbeddedManifest } from "./embedded-data";

import type { CartridgeWorldAuthContext } from "../types";

type AuthChain = CartridgeWorldAuthContext["chain"];

const CARTRIDGE_API_BASE = "https://api.cartridge.gg";

export async function resolveWorldAuthContext(input: {
  worldId: string;
  worldName?: string;
  chain?: AuthChain;
  rpcUrl?: string;
  toriiBaseUrl?: string;
  cartridgeApiBase?: string;
}): Promise<CartridgeWorldAuthContext> {
  const chain = input.chain ?? "slot";
  const worldName = input.worldName ?? input.worldId;
  const cartridgeApiBase = input.cartridgeApiBase ?? CARTRIDGE_API_BASE;
  const toriiBaseUrl = input.toriiBaseUrl ?? `${cartridgeApiBase}/x/${worldName}/torii`;
  const deployment = await resolveWorldDeployment({
    chain,
    worldName,
    worldId: input.worldId,
    toriiBaseUrl,
    rpcUrl: input.rpcUrl,
    cartridgeApiBase,
  });
  const manifest = patchManifest(getEmbeddedManifest(chain), deployment.worldAddress, deployment.contractsBySelector);
  const policies = buildCartridgePolicies({
    chain,
    manifest,
    entryTokenAddress: deployment.entryTokenAddress,
    feeTokenAddress: deployment.feeTokenAddress,
  });

  return {
    worldId: input.worldId,
    worldName,
    chain,
    chainId: resolveChainId(chain),
    rpcUrl: deployment.rpcUrl,
    toriiBaseUrl,
    worldAddress: deployment.worldAddress,
    manifest,
    contractsBySelector: deployment.contractsBySelector,
    entryTokenAddress: deployment.entryTokenAddress,
    feeTokenAddress: deployment.feeTokenAddress,
    policies: policies as unknown as Record<string, unknown>,
    policyFingerprint: computeCartridgePolicyFingerprint({
      chain,
      chainId: resolveChainId(chain),
      rpcUrl: deployment.rpcUrl,
      worldAddress: deployment.worldAddress,
      policies: policies as unknown as Record<string, unknown>,
    }),
  };
}

function resolveChainId(chain: AuthChain): string {
  switch (chain) {
    case "mainnet":
    case "slot":
      return "SN_MAIN";
    case "sepolia":
    case "slottest":
    case "local":
    default:
      return "SN_SEPOLIA";
  }
}

async function resolveWorldDeployment(input: {
  chain: AuthChain;
  worldName: string;
  worldId: string;
  toriiBaseUrl: string;
  rpcUrl?: string;
  cartridgeApiBase: string;
}) {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(input.chain, input.cartridgeApiBase);
  const [contractsBySelector, deployment, tokenAddresses] = await Promise.all([
    resolveWorldContracts(factorySqlBaseUrl, input.worldName),
    resolveWorldDeploymentFromFactory(factorySqlBaseUrl, input.worldName),
    resolveTokenAddresses(input.toriiBaseUrl),
  ]);

  return {
    worldAddress: deployment?.worldAddress ?? input.worldId,
    rpcUrl: normalizeRpcUrl(deployment?.rpcUrl ?? input.rpcUrl ?? defaultRpcUrl(input.chain, input.cartridgeApiBase)),
    contractsBySelector,
    entryTokenAddress: tokenAddresses.entryTokenAddress,
    feeTokenAddress: tokenAddresses.feeTokenAddress,
  };
}

async function resolveWorldContracts(factorySqlBaseUrl: string, worldName: string): Promise<Record<string, string>> {
  if (!factorySqlBaseUrl || !worldName) {
    return {};
  }

  const rows = await fetchWithErrorHandling<{ contract_address: string; contract_selector: string }>(
    buildApiUrl(factorySqlBaseUrl, FACTORY_QUERIES.WORLD_CONTRACTS_BY_PADDED_NAME(nameToPaddedFelt(worldName))),
    `Factory contract lookup failed for world "${worldName}".`,
  ).catch(() => []);

  const contractsBySelector: Record<string, string> = {};
  for (const row of rows) {
    contractsBySelector[normalizeSelector(row.contract_selector)] = row.contract_address;
  }

  return contractsBySelector;
}

async function resolveWorldDeploymentFromFactory(factorySqlBaseUrl: string, worldName: string) {
  if (!factorySqlBaseUrl || !worldName) {
    return null;
  }

  const rows = await fetchWithErrorHandling<Record<string, unknown>>(
    buildApiUrl(factorySqlBaseUrl, FACTORY_QUERIES.WORLD_DEPLOYED_BY_PADDED_NAME(nameToPaddedFelt(worldName))),
    `Factory world lookup failed for world "${worldName}".`,
  ).catch(() => []);

  if (rows.length === 0) {
    return null;
  }

  return {
    worldAddress: extractWorldAddress(rows[0]),
    rpcUrl: extractRpcUrl(rows[0]),
  };
}

async function resolveTokenAddresses(toriiBaseUrl: string) {
  const query =
    'SELECT "blitz_registration_config.entry_token_address" AS entry_token_address, "blitz_registration_config.fee_token" AS fee_token FROM "s1_eternum-WorldConfig" LIMIT 1;';
  const response = await fetch(`${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`).catch(() => null);
  if (!response?.ok) {
    return {
      entryTokenAddress: undefined,
      feeTokenAddress: undefined,
    };
  }

  const [row] = (await response.json()) as Array<Record<string, unknown>>;
  return {
    entryTokenAddress: normalizeAddress(row?.entry_token_address) ?? undefined,
    feeTokenAddress: normalizeAddress(row?.fee_token) ?? undefined,
  };
}

function getFactorySqlBaseUrl(chain: AuthChain, cartridgeApiBase: string): string {
  switch (chain) {
    case "mainnet":
      return `${cartridgeApiBase}/x/eternum-factory-mainnet/torii/sql`;
    case "sepolia":
      return `${cartridgeApiBase}/x/eternum-factory-sepolia/torii/sql`;
    case "slot":
    case "slottest":
    case "local":
      return `${cartridgeApiBase}/x/eternum-factory-slot-d/torii/sql`;
    default:
      return "";
  }
}

function defaultRpcUrl(chain: AuthChain, cartridgeApiBase: string): string {
  switch (chain) {
    case "slot":
      return `${cartridgeApiBase}/x/eternum-blitz-slot-4/katana/rpc/v0_9`;
    case "slottest":
    case "local":
      return `${cartridgeApiBase}/x/eternum-blitz-slot-test/katana/rpc/v0_9`;
    case "sepolia":
      return `${cartridgeApiBase}/x/starknet/sepolia/rpc/v0_9`;
    case "mainnet":
    default:
      return `${cartridgeApiBase}/x/starknet/mainnet/rpc/v0_9`;
  }
}

function patchManifest(
  baseManifest: Record<string, unknown>,
  worldAddress: string,
  contractsBySelector: Record<string, string>,
): Record<string, unknown> {
  const nextManifest = JSON.parse(JSON.stringify(baseManifest)) as Record<string, unknown>;
  const world = nextManifest.world as Record<string, unknown> | undefined;
  if (world) {
    world.address = worldAddress;
  }

  const contracts = Array.isArray(nextManifest.contracts)
    ? (nextManifest.contracts as Array<Record<string, unknown>>)
    : [];
  for (const contract of contracts) {
    const selector = typeof contract.selector === "string" ? normalizeSelector(contract.selector) : null;
    if (selector && contractsBySelector[selector]) {
      contract.address = contractsBySelector[selector];
    }
  }

  return nextManifest;
}

function normalizeSelector(value: string): string {
  const body = value.replace(/^0x/i, "").toLowerCase();
  return `0x${body.padStart(64, "0")}`;
}

function nameToPaddedFelt(name: string): string {
  const bytes = new TextEncoder().encode(name);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `0x${hex.padStart(64, "0")}`;
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.toLowerCase().startsWith("0x") ? value.toLowerCase() : null;
  }
  if (typeof value === "bigint") {
    return `0x${value.toString(16)}`;
  }
  return null;
}

function extractWorldAddress(row: Record<string, unknown>): string | null {
  return (
    normalizeAddress(row.address) ??
    normalizeAddress(row.contract_address) ??
    normalizeAddress(row.world_address) ??
    normalizeAddress(row.worldAddress) ??
    normalizeAddress(asRecord(row.data)?.address) ??
    normalizeAddress(asRecord(row.data)?.contract_address) ??
    normalizeAddress(asRecord(row.data)?.world_address) ??
    normalizeAddress(asRecord(row.data)?.worldAddress) ??
    null
  );
}

function extractRpcUrl(row: Record<string, unknown>): string | null {
  const keys = ["rpc_url", "rpcUrl", "node_url", "nodeUrl", "rpc", "node"];
  for (const key of keys) {
    if (typeof row[key] === "string" && row[key]) {
      return row[key] as string;
    }
  }
  const data = asRecord(row.data);
  if (!data) {
    return null;
  }
  for (const key of keys) {
    if (typeof data[key] === "string" && data[key]) {
      return data[key] as string;
    }
  }
  return null;
}

function normalizeRpcUrl(value: string): string {
  if (value.includes("/rpc/")) {
    return value;
  }

  try {
    const url = new URL(value);
    const trimmedPath = url.pathname.replace(/\/+$/, "");
    if (trimmedPath.endsWith("/katana") || /\/starknet\/(mainnet|sepolia)$/i.test(trimmedPath)) {
      url.pathname = `${trimmedPath}/rpc/v0_9`;
      return url.toString();
    }
  } catch {
    return value;
  }

  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
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
  return null;
}
