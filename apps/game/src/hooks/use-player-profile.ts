import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import {
  identityProfiles,
  isPlayerProfileKnown,
  type PlayerNameReading,
  readPlayerName,
  readPlayerProfile,
} from "@/services/identity/player-profiles";
import { readPlayers } from "@/sync/fact-views";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import type { ContractAddress, Player } from "@bibliothecadao/types";
import { useMemo, useSyncExternalStore } from "react";

/**
 * A player's profile as a surface draws their face: the claimed name (or nothing), the portrait, and whether they are
 * known yet: until then a surface shows an empty ring, never the address's stock face. Their name reads through
 * `usePlayerName`, the one rule.
 */
type PlayerProfile = Pick<Player, "name" | "portrait"> & { known: boolean };

const NO_PROFILE: PlayerProfile = { name: null, portrait: null, known: true };
const PLAYER_FACTS = ["PlayerEntry"] as const;

const toAddress = (address: string | bigint): ContractAddress => BigInt(address);

export { getPlayerDisplayName, type PlayerNameReading, readPlayerName } from "@/services/identity/player-profiles";

/** Changes whenever a player name may: an identity answer, or the signed-in session. Names never come from the chain. */
export const usePlayerNamesRevision = () => {
  const profiles = useSyncExternalStore(
    identityProfiles.subscribe,
    identityProfiles.getVersion,
    identityProfiles.getVersion,
  );
  const user = useIdentitySessionStore((state) => state.session?.user);
  const account = useAccountStore((state) => state.account?.address);
  return [profiles, user, account] as const;
};

/** Calls `onChange` whenever a player name may have changed: an identity answer, or the session. */
export const watchPlayerNames = (onChange: () => void): (() => void) => {
  const stopProfiles = identityProfiles.subscribe(onChange);
  const stopSession = useIdentitySessionStore.subscribe((state, previous) => {
    if (state.session?.user !== previous.session?.user) onChange();
  });
  return () => {
    stopProfiles();
    stopSession();
  };
};

/** The game's registered players, each with their name and portrait. */
export const usePlayers = (): Player[] => {
  const {
    setup: { store },
  } = useGame();
  const registrations = useNativeRevision(PLAYER_FACTS);
  const names = usePlayerNamesRevision();
  return useMemo(() => readPlayers(store), [store, registrations, ...names]);
};

export const usePlayerProfile = (address: string | bigint | null | undefined): PlayerProfile => {
  const names = usePlayerNamesRevision();
  const owner = address === null || address === undefined ? null : toAddress(address);
  return useMemo(
    () => (owner === null ? NO_PROFILE : { ...readPlayerProfile(owner), known: isPlayerProfileKnown(owner) }),
    [owner, ...names],
  );
};

/** A player's name as the one rule reads it (named, waiting or unavailable), read again whenever a name may change. */
export const usePlayerName = (address: string | bigint | null | undefined): PlayerNameReading | null => {
  const names = usePlayerNamesRevision();
  const owner = address === null || address === undefined ? null : toAddress(address);
  return useMemo(() => (owner === null ? null : readPlayerName(owner)), [owner, ...names]);
};

/** The name a surface writes for a player: the one rule's text. */
export const usePlayerDisplayName = (address: string | bigint | null | undefined): string | null =>
  usePlayerName(address)?.text ?? null;

/** The chosen portrait, else one of the stock portraits picked from the address so it stays stable. */
export const playerAvatarUrl = (
  address: string | bigint,
  profile: Pick<PlayerProfile, "name" | "portrait"> = readPlayerProfile(address),
): string => playerPortraitUrl(address, profile.portrait);

const isStarknetAddress = (value: string): boolean => /^0x[0-9a-fA-F]+$/.test(value);

/**
 * A chat sender by their registered name; the chat server's own display name stands in only for a sender this
 * game has not registered, and the shortened address for one with neither.
 */
export const resolveChatSenderName = (playerId: string, displayName: string | null | undefined): string => {
  if (!isStarknetAddress(playerId)) return displayName?.trim() || playerId;
  // The chat server stores the sender's address as its display name when they had none; that never shows.
  const serverName = displayName?.trim();
  const reading = readPlayerName(playerId);
  if (reading.state === "named" && reading.claimed) return reading.text;
  return serverName && !isStarknetAddress(serverName) ? serverName : reading.text;
};
