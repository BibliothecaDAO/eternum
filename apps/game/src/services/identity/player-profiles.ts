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
  /** Addresses identity has answered for: a profile, or none to give, which leaves the player unclaimed. */
  const answered = new Set<string>();
  /** Addresses whose ask failed: their name is unavailable, which is not the same as unclaimed. */
  const unavailable = new Set<string>();
  const listeners = new Set<Listener>();
  const pending: string[] = [];
  let version = 0;

  const notify = () => {
    version += 1;
    listeners.forEach((listener) => listener());
  };

  // A failed batch stays asked: retrying on the next derive would loop, since the derive is what asks. A reload
  // asks again; until then those players' names are unavailable.
  const load = async (accounts: string[]) => {
    let landed = false;
    for (let start = 0; start < accounts.length; start += IDENTITY_PROFILES_BATCH_LIMIT) {
      const batch = accounts.slice(start, start + IDENTITY_PROFILES_BATCH_LIMIT);
      try {
        Object.entries(await deps.fetchProfiles(batch)).forEach(([account, profile]) =>
          profiles.set(normalize(account), profile),
        );
        batch.forEach((account) => answered.add(account));
      } catch (error) {
        console.error("identity_profiles_load_failed", error);
        batch.forEach((account) => unavailable.add(account));
      }
      landed = true;
    }
    if (landed) notify();
  };

  return {
    get: (account: string | bigint): IdentityProfile | undefined => profiles.get(normalize(account)),
    /** Whether identity answered for this address: until then its name is not known, not absent. */
    isAnswered: (account: string | bigint): boolean => answered.has(normalize(account)),
    /** Whether the ask for this address failed: its name is unavailable until the next load asks again. */
    isUnavailable: (account: string | bigint): boolean => unavailable.has(normalize(account)),
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
 * like), else the signed-in player's own session for their own account (a name just claimed shows at once, where
 * identity's answer for it was cached before the claim), else the player's Realms profile, asked for on first read. A
 * name written on chain is never read.
 */
/**
 * Whether a player's name and portrait are known: an internal account's, the signed-in player's own, or one identity
 * answered for. Until then a surface shows that it is waiting, never the address's stand-in name and stock face
 * (qa-app-1 P3-4).
 */
export const isPlayerProfileKnown = (address: string | bigint): boolean =>
  getInternalAddressName(address.toString()) !== undefined ||
  readOwnProfile(address) !== null ||
  identityProfiles.isAnswered(address);

/**
 * Whether a player's name is unavailable: identity's ask failed and nothing else names them. A surface says so, never
 * the address's stand-in, which would claim the player chose no name (whole-review P2-1).
 */
export const isPlayerProfileUnavailable = (address: string | bigint): boolean =>
  !isPlayerProfileKnown(address) && identityProfiles.isUnavailable(address);

export const readPlayerProfile = (address: string | bigint): IdentityProfile => {
  const internalName = getInternalAddressName(address.toString());
  if (internalName) return { name: internalName, portrait: null };
  identityProfiles.request([address]);
  return readOwnProfile(address) ?? identityProfiles.get(address) ?? { name: null, portrait: null };
};

const readOwnProfile = (address: string | bigint): IdentityProfile | null => {
  const own = useAccountStore.getState().account?.address;
  const user = useIdentitySessionStore.getState().session?.user;
  return own && user && BigInt(own) === BigInt(address) ? profileOfIdentityUser(user) : null;
};

export const getPlayerName: PlayerNameResolver = (address) => readPlayerProfile(address).name;

/** The name a surface shows for a player: their claimed name, else "Lord" and the account's last four. */
export const getPlayerDisplayName = (address: string | bigint): string =>
  displayPlayerName(`0x${BigInt(address).toString(16)}`, getPlayerName(address));
