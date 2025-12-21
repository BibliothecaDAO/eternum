import type { Chain } from "@contracts";

export interface WorldProfile {
  name: string;
  chain: Chain;
  toriiBaseUrl: string;
  worldAddress: string;
  contractsBySelector: Record<string, string>;
  fetchedAt: number;
}

export interface WorldProfilesMap {
  [name: string]: WorldProfile;
}
