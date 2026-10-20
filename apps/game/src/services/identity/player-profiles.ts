import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { displayPlayerName, getInternalAddressName } from "@bibliothecadao/eternum";
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
 * Whether a player's name and portrait are known: an internal account's, the signed-in player's own, or one identity
 * answered for. Until then a surface shows that it is waiting, never the address's stand-in name and stock face
 * (qa-app-1 P3-4).
 */
export const isPlayerProfileKnown = (address: string | bigint): boolean =>
  getInternalAddressName(address.toString()) !== undefined ||
  readOwnProfile(address) !== null ||
  identityProfiles.isAnswered(address);

/**
 * A player's profile: a known internal address's name (the bank and the like), else the signed-in player's own session
 * for their own account (a name just claimed shows at once, where identity's answer for it was cached before the
 * claim), else the player's Realms profile, asked for on first read. A name written on chain is never read.
 */
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

/** What a name not known shows: waiting on identity, or identity's ask failed. */
const NAME_WAITING_MARK = "…";
const NAME_UNAVAILABLE_MARK = "—";

/**
 * How a player's name reads, decided in one place for every surface, drawn or imperative:
 * - `named`: the zero address is the neutral side; a known player shows their claimed name (`claimed`), or, when
 *   identity answered with none, the unclaimed rule ("Lord" and the account's last four);
 * - `waiting`: identity has not answered yet. "…", never the stand-in, which would claim the player chose no name;
 * - `unavailable`: identity's ask failed. "—", for the same reason (whole-review P2-1, P3-1).
 * `text` is what an imperative surface writes; a drawn one may style each state, never decide it.
 */
export type PlayerNameReading =
  | { state: "named"; text: string; claimed: boolean }
  | { state: "waiting"; text: string }
  | { state: "unavailable"; text: string };

export const readPlayerName = (address: string | bigint): PlayerNameReading => {
  if (BigInt(address) === 0n) return readKnownPlayerName(address, null);
  const { name } = readPlayerProfile(address);
  if (isPlayerProfileKnown(address)) return readKnownPlayerName(address, name);
  return identityProfiles.isUnavailable(address)
    ? { state: "unavailable", text: NAME_UNAVAILABLE_MARK }
    : { state: "waiting", text: NAME_WAITING_MARK };
};

/**
 * A player whose name is known, from identity or from a service that answered for them (a rating row): the zero
 * address is the neutral side, else the claimed name, else the unclaimed rule.
 */
export const readKnownPlayerName = (address: string | bigint, name: string | null): PlayerNameReading => ({
  state: "named",
  text: displayPlayerName(`0x${BigInt(address).toString(16)}`, name),
  claimed: BigInt(address) === 0n || name !== null,
});

/**
 * The name every imperative surface writes for a player, and the resolver the game client's views and stories name
 * owners by (`PlayerNameResolver`).
 */
export const getPlayerDisplayName = (address: string | bigint): string => readPlayerName(address).text;
