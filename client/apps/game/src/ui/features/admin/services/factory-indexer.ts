import { CARTRIDGE_API_BASE, TORII_CREATOR_URL } from "../constants";
import { getFactorySqlBaseUrl } from "../constants";
import { resolveWorldAddressFromFactory } from "@/runtime/world/factory-resolver";
import type { Chain } from "@contracts";

export interface ToriiConfigPayload {
  env: string;
  rpc_url: string;
  torii_namespaces: string;
  workflow_file?: string;
  ref?: string;
  external_contracts?: string[];
  torii_prefix?: string; // world name
  torii_world_address?: string; // deployed world contract
}

export const checkIndexerExists = async (worldName: string): Promise<boolean> => {
  const url = `${CARTRIDGE_API_BASE}/x/${worldName}/torii/sql`;
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
};

export const createIndexer = async (payload: ToriiConfigPayload): Promise<void> => {
  const params = new URLSearchParams();
  if (payload.torii_prefix) params.set("torii_prefix", payload.torii_prefix);
  params.set("env", payload.env);
  params.set("rpc_url", payload.rpc_url);
  params.set("torii_namespaces", payload.torii_namespaces);
  if (payload.torii_world_address) params.set("torii_world_address", payload.torii_world_address);
  if (payload.workflow_file) params.set("workflow_file", String(payload.workflow_file));
  if (payload.ref) params.set("ref", String(payload.ref));
  if (payload.external_contracts?.length) {
    for (const c of payload.external_contracts) params.append("contract", c);
  }

  const res = await fetch(`${TORII_CREATOR_URL}?${params.toString()}`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Failed to create indexer: ${res.status} ${res.statusText}`);
  }
};

export const getWorldDeployedAddress = async (chain: Chain, worldName: string): Promise<string | null> => {
  const base = getFactorySqlBaseUrl(chain);
  return resolveWorldAddressFromFactory(base, worldName);
};
