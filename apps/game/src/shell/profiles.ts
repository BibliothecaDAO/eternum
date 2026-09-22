import { useSyncExternalStore } from "react";

import { identityProfiles } from "@/services/identity/player-profiles";
import type { IdentityProfile } from "@realms-world/identity";

/** Public names and portraits for gameplay accounts, from identity, asked for once per address. */
export const useProfiles = (accounts: readonly string[]): ((account: string) => IdentityProfile | undefined) => {
  identityProfiles.request(accounts);
  useSyncExternalStore(identityProfiles.subscribe, identityProfiles.getVersion);
  return identityProfiles.get;
};
