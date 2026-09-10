import { identityOrigin } from "@/hooks/context/identity-session";
import { fetchIdentityProfiles, IDENTITY_PROFILES_BATCH_LIMIT, type IdentityProfile } from "@realms-world/identity";

type Listener = () => void;

interface IdentityProfilesDeps {
  fetchProfiles(accounts: string[]): Promise<Record<string, IdentityProfile>>;
}

/**
 * The client's copy of identity's public profiles, keyed by gameplay account address (the address a chain name is
 * registered under). Addresses are asked for once, in batches; the answer wakes whoever derives player rows.
 */
export const createIdentityProfiles = (deps: IdentityProfilesDeps) => {
  const profiles = new Map<string, IdentityProfile>();
  const requested = new Set<string>();
  const listeners = new Set<Listener>();

  const notify = () => listeners.forEach((listener) => listener());

  const load = async (accounts: string[]) => {
    for (let start = 0; start < accounts.length; start += IDENTITY_PROFILES_BATCH_LIMIT) {
      const batch = accounts.slice(start, start + IDENTITY_PROFILES_BATCH_LIMIT);
      try {
        Object.entries(await deps.fetchProfiles(batch)).forEach(([account, profile]) =>
          profiles.set(normalize(account), profile),
        );
      } catch (error) {
        console.error("identity_profiles_load_failed", error);
        batch.forEach((account) => requested.delete(account));
      }
    }
    notify();
  };

  return {
    get: (account: string | bigint): IdentityProfile | undefined => profiles.get(normalize(account)),
    /** Asks identity for every address not asked before; the listeners fire when an answer lands. */
    request: (accounts: Iterable<string | bigint>): void => {
      const fresh = [...accounts].map(normalize).filter((account) => !requested.has(account));
      if (fresh.length === 0) return;
      fresh.forEach((account) => requested.add(account));
      void load(fresh);
    },
    subscribe: (listener: Listener): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

const normalize = (account: string | bigint): string => `0x${BigInt(account).toString(16)}`;

export const identityProfiles = createIdentityProfiles({
  fetchProfiles: (accounts) => fetchIdentityProfiles(identityOrigin, accounts),
});
