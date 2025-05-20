import { ContractAddress } from "@bibliothecadao/types";
import { getChecksumAddress } from "starknet";
import { env } from "./../../../env";

const API_BASE_URL = env.VITE_PUBLIC_TORII + "/sql";

// Define SQL queries separately for better maintainability
const QUERIES = {
  STRUCTURES_BY_OWNER:
    "SELECT `base.coord_x`, `base.coord_y`, entity_id, owner FROM [s1_eternum-Structure] WHERE owner == '{owner}';",
};

// API response types
export interface StructureLocation {
  "base.coord_x": number;
  "base.coord_y": number;
  entity_id: number;
  owner: ContractAddress;
}

/**
 * Fetch structures by owner from the API
 */
export async function fetchStructuresByOwner(owner: string): Promise<StructureLocation[]> {
  const url = `${API_BASE_URL}?query=${encodeURIComponent(
    QUERIES.STRUCTURES_BY_OWNER.replace("{owner}", getChecksumAddress(owner).toLowerCase()),
  )}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch structures by owner: ${response.statusText}`);
  }

  return await response.json();
}
