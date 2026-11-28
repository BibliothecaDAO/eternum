import { createContext, useCallback, useContext } from "react";

import { useGame } from "@/hooks/context/game-context";
import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { playerAspectOf, usePlayerAspects } from "@/hooks/use-player-aspect";

import { linkFrom, openOnMap } from "@/play/navigation/open-place";
import { getActiveGame } from "@/runtime/world/store";
import { needsRealmVisit, startRealmVisit } from "@/sync/active-game-client";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { isExpeditionRealm, Position, structureMapPosition } from "@bibliothecadao/eternum";
import type { AspectId } from "@bibliothecadao/types";
import { useChatPeople } from "../../hooks/use-chat-people";
import { placeLoaded, placeOnMap, sameGame, type SharedPlace } from "../../model/place";

/**
 * A place a message carries, as this client reads it (usePlaceReader): its name and painting, what opens it (none
 * once gone, from a closed Frontier day, or in another game), whether it is known to be gone, and whether it stands in
 * another game.
 */
export interface PlaceReading {
  name: string;
  icon: IconMeaning;
  open: (() => void) | null;
  gone: boolean;
  elsewhere: boolean;
}

/**
 * The map as chat reads it, where a map is (in a game): the place selected on it, to share (or the one a phone's Chat
 * set aside as it opened), and a place a message carries as the map reads it now. Outside a game there is no map: a
 * place reads as the message has it, and opens nothing.
 */
export interface ChatMap {
  selected: SharedPlace | null;
  read: (place: SharedPlace) => PlaceReading;
  /** A player's realm in this game, by their Realms id, as a place to open; none for a player with no realm here. */
  realmOf: (playerId: string) => SharedPlace | null;
  aspectOf: (playerId: string) => AspectId | null;
  /** The game's registered players with a claimed name, each with their portrait: whom chat mentions in a game. */
  players: readonly { name: string; portrait: string | null }[];
}

export const ChatMapContext = createContext<ChatMap | null>(null);

export const useChatMap = () => useContext(ChatMapContext);

const NO_ASPECT = (): AspectId | null => null;

export const useChatPlayerAspect = (): ((playerId: string) => AspectId | null) => useChatMap()?.aspectOf ?? NO_ASPECT;

export const useGamePlayerAspect = (): ((playerId: string) => AspectId | null) => {
  const people = useChatPeople();
  const playerAspects = usePlayerAspects();
  return useCallback(
    (playerId: string) => playerAspectOf(playerAspects, people.accountOf(playerId)),
    [playerAspects, people],
  );
};

const PLACE_MODELS = ["Structure", "ExplorerTroops", "TileOccupancy"] as const;

/**
 * How this game reads a place a message carries, the one reading the chip and the chat strip share. A place in another
 * game (another chain, or another game on this one) is never looked up here: it reads as the message has it and opens
 * nothing. One in this game is named and painted as the map has it (a message cannot rename a place), else as the
 * message has it, and opens as the Feed opens its stories, on today's map only (linkFrom): an army selected where it
 * stands now, a structure on its tile, a site's tile on its layer. Gone (the map holds it no more, or its day closed),
 * it opens nothing. One this map has not loaded, out of the player's view, is not gone (playtest 29 October 2026, B5):
 * an army or a realm opens by visiting its owner, the one way the stream brings another player's realm and armies; as
 * the visit's rows arrive it opens where the place stood when shared, read-only, selected there, and the visit's Leave
 * returns home. A site out of view no visit brings (its region holds it): it opens nothing.
 */
export const usePlaceReader = (): ((place: SharedPlace) => PlaceReading) => {
  const {
    setup: { store },
  } = useGame();
  useNativeRevision(PLACE_MODELS);
  const viewer = useAccountAddress();
  const selectArmy = useSelectArmyOnMap();
  const here = getActiveGame();
  return (place) => {
    const asSent = { name: place.name, icon: place.icon };
    if (!here || !sameGame(place.game, here)) return { ...asSent, open: null, gone: false, elsewhere: true };
    const now = placeOnMap(store, place.game, place, place.at);
    if (now) {
      const liveTile = liveTileOf(store, place);
      if (!liveTile) return { name: now.name, icon: now.icon, open: null, gone: true, elsewhere: false };
      const owner = now.owner ?? place.owner;
      const open =
        owner !== undefined && needsRealmVisit(store, place.game.gameId, BigInt(owner.player), viewer)
          ? visitOpener(place, owner, liveTile)
          : openerOf(place, liveTile, selectArmy);
      return { name: now.name, icon: now.icon, open, gone: open === null, elsewhere: false };
    }
    if (placeLoaded(store, place.game, place)) return { ...asSent, open: null, gone: true, elsewhere: false };
    if (!place.tile || !place.owner) return { ...asSent, open: null, gone: false, elsewhere: false };
    const open = visitOpener(place, place.owner, place.tile);
    return { ...asSent, open, gone: open === null, elsewhere: false };
  };
};

const liveTileOf = (
  store: ReturnType<typeof useGame>["setup"]["store"],
  place: SharedPlace,
): NonNullable<SharedPlace["tile"]> | null => {
  const gameId = place.game.gameId;
  if (place.kind === "army") {
    const stands = store.entityOccupancy(gameId, place.entityId);
    return stands ? { col: stands.col, row: stands.row, alt: stands.alt } : null;
  }
  const structure = store.get("Structure", { game_id: gameId, entity_id: place.entityId });
  const onMap = structure && (isExpeditionRealm(store, structure) || store.entityOccupancy(gameId, place.entityId));
  const site = onMap ? structureMapPosition(store, structure) : null;
  return site ? { col: site.x, row: site.y, alt: site.alt } : null;
};

const visitOpener = (
  place: SharedPlace,
  owner: NonNullable<SharedPlace["owner"]>,
  tile: NonNullable<SharedPlace["tile"]>,
): (() => void) | null => {
  const select =
    place.kind === "army"
      ? { kind: "army" as const, entityId: place.entityId, tile: "own" as const }
      : { kind: "structure" as const, entityId: place.entityId };
  return linkFrom(place.at, () =>
    startRealmVisit({ player: owner.player, structureId: owner.realm, opensOn: { tile, select } }),
  );
};

const openerOf = (
  place: SharedPlace,
  tile: NonNullable<SharedPlace["tile"]>,
  selectArmy: (entityId: number) => void,
): (() => void) | null => {
  if (place.kind === "army") return linkFrom(place.at, () => selectArmy(place.entityId));
  const intent = { kind: "structure" as const, entityId: place.entityId };
  return linkFrom(place.at, () => openOnMap(Position.fromContract({ x: tile.col, y: tile.row }), intent));
};
