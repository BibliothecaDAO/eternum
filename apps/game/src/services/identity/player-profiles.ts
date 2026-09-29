import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { displayPlayerName, getInternalAddressName, type PlayerNameResolver } from "@bibliothecadao/eternum";
import {
  fetchIdentityProfiles,
  IDENTITY_PROFILES_BATCH_LIMIT,
  type IdentityProfile,
  profileOfIdentityUser,
} from "@realms-world/identity";

type Listener = () => void;

interface IdentityProfilesDeps {
  fetchProfiles(accounts: string[]): Promise<Record<string, IdentityProfile>>;
}

/**
 * The client's copy of identity's public profiles, keyed by gameplay account address. Addresses are asked for once, in batches; the answer wakes whoever derives player rows.
 */
const createIdentityProfiles = (deps: IdentityProfilesDeps) => {
  const profiles = new Map<string, IdentityProfile>();
  const requested = new Set<string>();
  const listeners = new Set<Listener>();
  const pending: string[] = [];
  let version = 0;

  const notify = () => {
    version += 1;
    listeners.forEach((listener) => listener());
  };

  // A failed batch stays asked: retrying on the next derive would loop, since the derive is what asks. A reload
  // asks again; until then those players read by their chain name.
  const load = async (accounts: string[]) => {
    let landed = false;
    for (let start = 0; start < accounts.length; start += IDENTITY_PROFILES_BATCH_LIMIT) {
      const batch = accounts.slice(start, start + IDENTITY_PROFILES_BATCH_LIMIT);
      try {
        Object.entries(await deps.fetchProfiles(batch)).forEach(([account, profile]) =>
          profiles.set(normalize(account), profile),
        );
        landed = true;
      } catch (error) {
        console.error("identity_profiles_load_failed", error);
      }
    }
    if (landed) notify();
  };

  return {
    get: (account: string | bigint): IdentityProfile | undefined => profiles.get(normalize(account)),
    /** Asks identity for every address not asked before, in one batch per task; the listeners fire when an answer lands. */
    request: (accounts: Iterable<string | bigint>): void => {
      const fresh = [...accounts].map(normalize).filter((account) => !requested.has(account));
      if (fresh.length === 0) return;
      fresh.forEach((account) => requested.add(account));
      if (pending.length === 0) queueMicrotask(() => void load(pending.splice(0)));
      pending.push(...fresh);
    },
    subscribe: (listener: Listener): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Changes whenever an answer lands; a store snapshot for React. */
    getVersion: (): number => version,
  };
};

const normalize = (account: string | bigint): string => `0x${BigInt(account).toString(16)}`;

export const identityProfiles = createIdentityProfiles({
  fetchProfiles: (accounts) => fetchIdentityProfiles(window.location.origin, accounts),
});

/**
 * The one place a player's name comes from, for every display: a known internal address's name (the bank and the
 * like), else the player's Realms profile, asked for on first read; the signed-in player's own session stands in
 * until identity answers. A name written on chain is never read.
 */
export const readPlayerProfile = (address: string | bigint): IdentityProfile => {
  const internalName = getInternalAddressName(address.toString());
  if (internalName) return { name: internalName, portrait: null };
  identityProfiles.request([address]);
  return identityProfiles.get(address) ?? readOwnProfile(address) ?? { name: null, portrait: null };
};

const readOwnProfile = (address: string | bigint): IdentityProfile | null => {
  const own = useAccountStore.getState().account?.address;
  const user = useIdentitySessionStore.getState().session?.user;
  return own && user && BigInt(own) === BigInt(address) ? profileOfIdentityUser(user) : null;
};

export const getPlayerName: PlayerNameResolver = (address) => readPlayerProfile(address).name;

/** The name a surface shows for a player: their chosen name, else "Player-<last six>". */
export const getPlayerDisplayName = (address: string | bigint): string =>
  displayPlayerName(`0x${BigInt(address).toString(16)}`, getPlayerName(address));
