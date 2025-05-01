import { ContractAddress } from "@bibliothecadao/types";
import { env } from "../../env";

const API_BASE_URL = env.VITE_PUBLIC_TORII + "/sql";

// Define SQL queries separately for better maintainability
const QUERIES = {
  REALM_SETTLEMENTS: "SELECT `base.coord_x`, `base.coord_y`, owner FROM [s1_eternum-Structure] WHERE category == 1;",
};

// API response types
export interface StructureLocation {
  "base.coord_x": number;
  "base.coord_y": number;
  owner: ContractAddress;
}

/**
 * Fetch settlement structures from the API
 */
export async function fetchRealmSettlements(): Promise<StructureLocation[]> {
  const url = `${API_BASE_URL}?query=${encodeURIComponent(QUERIES.REALM_SETTLEMENTS)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch settlements: ${response.statusText}`);
  }

  return await response.json();
}
