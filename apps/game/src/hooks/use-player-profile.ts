import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { identityProfiles } from "@/services/identity/player-profiles";
import { getActiveGameStore } from "@/sync/active-game-client";
import { readPlayerProfile, readPlayers } from "@/sync/fact-views";
import { displayPlayerName } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import type { ContractAddress, Player } from "@bibliothecadao/types";
import { useMemo, useSyncExternalStore } from "react";

/** What every surface shows for a player: the resolved name (or nothing) and the portrait. */
type PlayerProfile = Pick<Player, "name" | "portrait">;

const NO_PROFILE: PlayerProfile = { name: null, portrait: null };
const PORTRAIT_COUNT = 12;
const PLAYER_NAME_FACTS = ["AddressName"] as const;

const toAddress = (address: string | bigint): ContractAddress => BigInt(address);

/**
 * The one player resolver: identity's profile over the chain name, read from the native store and identity's
 * answers; nothing re-derives a name from the chain or the URL. Before a game boots no address has a chain name.
 */
const getPlayerProfile = (address: string | bigint): PlayerProfile => {
  const store = getActiveGameStore();
  return store ? readPlayerProfile(store, toAddress(address)) : NO_PROFILE;
};

/** Changes whenever a name source changes: a chain name, an identity answer, or the signed-in session. */
const useProfileRevision = () => {
  const names = useNativeRevision(PLAYER_NAME_FACTS);
  const profiles = useSyncExternalStore(identityProfiles.subscribe, identityProfiles.getVersion);
  const user = useIdentitySessionStore((state) => state.session?.user);
  const account = useAccountStore((state) => state.account?.address);
  return [names, profiles, user, account] as const;
};

/** Calls `onChange` whenever a player name may have changed: a chain name, an identity answer, or the session. */
export const watchPlayerNames = (store: NativeFactStore, onChange: () => void): (() => void) => {
  const stopNames = store.subscribe((changes) => {
    if (changes.some((change) => change.model === "AddressName")) onChange();
  });
  const stopProfiles = identityProfiles.subscribe(onChange);
  const stopSession = useIdentitySessionStore.subscribe((state, previous) => {
    if (state.session?.user !== previous.session?.user) onChange();
  });
  return () => {
    stopNames();
    stopProfiles();
    stopSession();
  };
};

export const usePlayers = (): Player[] => {
  const {
    setup: { store },
  } = useGame();
  const revision = useProfileRevision();
  return useMemo(() => readPlayers(store), [store, ...revision]);
};

export const usePlayerProfile = (address: string | bigint | null | undefined): PlayerProfile => {
  const {
    setup: { store },
  } = useGame();
  const revision = useProfileRevision();
  const owner = address === null || address === undefined ? null : toAddress(address);
  return useMemo(() => (owner === null ? NO_PROFILE : readPlayerProfile(store, owner)), [store, owner, ...revision]);
};

/** The resolved name alone, for callers that keep their own fallback (the story formatter shortens itself). */
export const getPlayerName = (address: string | bigint): string | null => getPlayerProfile(address).name;

/** The name a surface shows for an address: resolved name, else the shortened address. */
export const getPlayerDisplayName = (address: string | bigint): string =>
  displayPlayerName(toAddress(address), getPlayerProfile(address).name);

export const usePlayerDisplayName = (address: string | bigint | null | undefined): string | null => {
  const profile = usePlayerProfile(address);
  return address === null || address === undefined ? null : displayPlayerName(toAddress(address), profile.name);
};

/** The chosen portrait, else one of the stock portraits picked from the address so it stays stable. */
export const playerAvatarUrl = (address: string | bigint, profile: PlayerProfile = getPlayerProfile(address)): string =>
  `/images/avatars/${profile.portrait ?? stockPortrait(address)}.png`;

const stockPortrait = (address: string | bigint): string => {
  const key = toAddress(address).toString();
  const hash = Array.from(key).reduce((current, character) => (current * 31 + character.charCodeAt(0)) >>> 0, 0);
  return String((hash % PORTRAIT_COUNT) + 1).padStart(2, "0");
};

const isStarknetAddress = (value: string): boolean => /^0x[0-9a-fA-F]+$/.test(value);

/**
 * A chat sender by their registered name; the chat server's own display name stands in only for a sender this
 * game has not registered, and the shortened address for one with neither.
 */
export const resolveChatSenderName = (playerId: string, displayName: string | null | undefined): string => {
  if (!isStarknetAddress(playerId)) return displayName?.trim() || playerId;
  // The chat server stores the sender's address as its display name when they had none; that never shows.
  const serverName = displayName?.trim();
  return (
    getPlayerProfile(playerId).name ??
    (serverName && !isStarknetAddress(serverName) ? serverName : null) ??
    getPlayerDisplayName(playerId)
  );
};
