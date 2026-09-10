import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { displayPlayerName, shortenPlayerAddress } from "@bibliothecadao/eternum";
import type { ContractAddress, Player } from "@bibliothecadao/types";

/** What every surface shows for a player: the resolved name (or nothing) and the portrait. */
type PlayerProfile = Pick<Player, "name" | "portrait">;

const NO_PROFILE: PlayerProfile = { name: null, portrait: null };
const PORTRAIT_COUNT = 12;

const toAddress = (address: string | bigint): ContractAddress => BigInt(address);

/**
 * The one player resolver. Names and portraits come from the players slice, where the bridge merges identity's
 * profile over the chain name; nothing re-derives a name from the chain or the URL.
 */
const getPlayerProfile = (address: string | bigint): PlayerProfile => {
  const owner = toAddress(address);
  return useWorldSlicesStore.getState().players.find((player) => player.address === owner) ?? NO_PROFILE;
};

export const usePlayerProfile = (address: string | bigint | null | undefined): PlayerProfile => {
  const owner = address === null || address === undefined ? null : toAddress(address);
  return useWorldSlicesStore((state) =>
    owner === null ? NO_PROFILE : (state.players.find((player) => player.address === owner) ?? NO_PROFILE),
  );
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
  return getPlayerProfile(playerId).name ?? displayName?.trim() ?? shortenPlayerAddress(playerId);
};
