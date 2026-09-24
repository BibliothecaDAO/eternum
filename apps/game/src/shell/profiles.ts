import { usePlayerNamesRevision } from "@/hooks/use-player-profile";
import { identityProfiles, readPlayerProfile } from "@/services/identity/player-profiles";

/**
 * Names and portraits for gameplay accounts, from the one player resolver, re-rendering when identity answers or the
 * session changes. The accounts are asked for together before the first read.
 */
export const useProfiles = (accounts: readonly string[]): typeof readPlayerProfile => {
  identityProfiles.request(accounts);
  usePlayerNamesRevision();
  return readPlayerProfile;
};
