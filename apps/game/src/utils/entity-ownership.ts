import { ContractAddress } from "@bibliothecadao/types";
import { configManager, isViewerOwner, nativeGameModeOf } from "@bibliothecadao/eternum";
import type { GameRef, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { gameKey, getActiveGame } from "@/runtime/world/store";
import { seatSide, type SeatSide } from "@/tokens";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { isWatching } from "./can-issue-orders";

// Addresses reach this comparison in every felt spelling the stack produces — padded from the gameplay account
// (`addAddressPadding`), unpadded from herald rows, bigint from native facts — so equality is numeric, never textual.
const toAddress = (value: unknown): bigint | null => {
  if (typeof value !== "string" && typeof value !== "bigint" && typeof value !== "number") return null;
  try {
    return ContractAddress(typeof value === "number" ? BigInt(value) : value);
  } catch {
    return null;
  }
};

export const isEntityOwnedByAccount = (
  store: NativeFactStore | null | undefined,
  entityId: number,
  accountAddress: string | undefined,
): boolean => {
  if (!store || !Number.isSafeInteger(entityId) || entityId <= 0 || !accountAddress) return false;
  try {
    const structure = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId });
    return isViewerOwner(toAddress(structure?.owner), toAddress(accountAddress));
  } catch {
    return false;
  }
};

/**
 * Whether two players are allies: tribe members, in Eternum only (owner, 2026-10-21: "no allies in frontier/blitz but in
 * eternum yes, tribe members"). The chain lets a tribe form in any mode (guilds.cairo checks no mode), so the mode is read
 * here, in the one rule every map label, token and minimap mark takes its side from; elsewhere a tribe makes no ally.
 */
export function arePlayersAllied(
  store: NativeFactStore | null | undefined,
  playerAddress: bigint | string | null | undefined,
  ownerAddress: bigint | string | undefined,
): boolean {
  const player = toAddress(playerAddress);
  const owner = toAddress(ownerAddress);
  if (!store || !player || !owner || player === owner) return false;
  if (nativeGameModeOf(configManager.getPresetId()) !== "eternum") return false;
  const playerGuild = store.get("GuildMember", { game_id: configManager.getActiveGameId(), actor: player })?.guild_id;
  if (!playerGuild) return false;
  return store.get("GuildMember", { game_id: configManager.getActiveGameId(), actor: owner })?.guild_id === playerGuild;
}

/**
 * An open game's players in seat order (`useOpenGameSeats`), for the one game they were read for: its shard's chain id
 * and its id there (`gameKey`), as two shards number their games alike.
 */
let openGameSeats: { game: string; order: bigint[] } | null = null;
let seatsRevision = 0;
const seatListeners = new Set<() => void>();

/** For a rendered surface (useSyncExternalStore): a count that moves whenever the seats change, and how to hear it. */
export const readSeatsRevision = (): number => seatsRevision;
export const subscribeSeats = (listener: () => void): (() => void) => {
  seatListeners.add(listener);
  return () => seatListeners.delete(listener);
};

/**
 * Sets an open game's seat order (a Frontier or Eternum game has no roster on the chain), as `useOpenGameSeats` read it
 * for that game. Labels and marks drawn by seat are told again.
 */
export const setOpenGameSeats = (game: GameRef, order: bigint[]): void => {
  const key = gameKey(game);
  const same =
    openGameSeats?.game === key &&
    openGameSeats.order.length === order.length &&
    openGameSeats.order.every((player, index) => player === order[index]);
  if (same) return;
  openGameSeats = { game: key, order };
  seatsRevision += 1;
  for (const listener of [...seatListeners]) listener();
};

/** Calls `listener` when whose a thing is may read otherwise: the seats change, or the viewer starts or stops watching. */
export const onSidesChanged = (listener: () => void): (() => void) => {
  const stopSeats = subscribeSeats(listener);
  const stopWatching = useUIStore.subscribe((state, previous) => {
    if (state.isSpectating !== previous.isSpectating) listener();
  });
  return () => {
    stopSeats();
    stopWatching();
  };
};

/**
 * The game's players in seat order, the same on every client and through the game: a Blitz or Duel game's roster, fixed
 * before play; else an open game's players in the order they joined it (`useOpenGameSeats`). Empty until this game's
 * own order is known: another game's, on this shard or another, never stands in while its read is on its way or failed.
 */
export const seatOrder = (store: NativeFactStore): bigint[] => {
  const roster = store.get("BlitzRoster", { game_id: configManager.getActiveGameId() });
  if (roster) return roster.players.map((player) => ContractAddress(player.account));
  const game = getActiveGame();
  return game && openGameSeats?.game === gameKey(game) ? openGameSeats.order : [];
};

/**
 * Whose a thing is to a watching viewer (owner, 2026-10-21: "when you're spectating maybe a diff color for every
 * player"): there is no "yours", so each player is told by their seat's colour, the same on the map's labels, the
 * minimap and the standings; nobody's things are grey. Null while the viewer plays: the three sides tell it
 * (`arePlayersAllied`, map-plates.css).
 */
export const watchedSide = (
  store: NativeFactStore | null | undefined,
  owner: bigint | string | null | undefined,
): SeatSide | null => {
  if (!isWatching()) return null;
  const address = toAddress(owner);
  return seatSide(store && address ? seatOrder(store).indexOf(address) : null);
};
