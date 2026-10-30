import { createContext, useContext } from "react";

import { useGame } from "@/hooks/context/game-context";
import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { linkFrom, openOnMap } from "@/play/navigation/open-place";
import { getActiveGame } from "@/runtime/world/store";
import { startRealmVisit } from "@/sync/active-game-client";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { isExpeditionRealm, Position, structureMapPosition } from "@bibliothecadao/eternum";
import { type PlaceTile, placeLoaded, placeOnMap, sameGame, type SharedPlace } from "../../model/place";

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
  /** The game's registered players with a claimed name, each with their portrait: whom chat mentions in a game. */
  players: readonly { name: string; portrait: string }[];
}

export const ChatMapContext = createContext<ChatMap | null>(null);

export const useChatMap = () => useContext(ChatMapContext);

const PLACE_MODELS = ["Structure", "ExplorerTroops", "TileOccupancy"] as const;

/**
 * How this game reads a place a message carries, the one reading the chip and the chat strip share. A place in another
 * game (another chain, or another game on this one) is never looked up here: it reads as the message has it and opens
 * nothing. One in this game is named and painted as the map has it (a message cannot rename a place), else as the
 * message has it, and opens as the Feed opens its stories, on today's map only (linkFrom): an army selected where it
 * stands now, a structure on its tile, a site's tile on its layer. Gone (the map holds it no more, or its day closed),
 * it opens nothing. One this map has not loaded, out of the player's view, is not gone (playtest 29 October 2026, B5):
 * an army or a realm opens by visiting its owner, the one way the stream brings another player's realm and armies, the
 * map moving to where it stood when shared and selecting it there as its rows arrive. A site out of view no visit
 * brings (its region holds it): it opens nothing.
 */
export const usePlaceReader = (): ((place: SharedPlace) => PlaceReading) => {
  const {
    setup: { store },
  } = useGame();
  useNativeRevision(PLACE_MODELS);
  const selectArmy = useSelectArmyOnMap();
  const here = getActiveGame();
  return (place) => {
    const asSent = { name: place.name, icon: place.icon };
    if (!here || !sameGame(place.game, here)) return { ...asSent, open: null, gone: false, elsewhere: true };
    const now = placeOnMap(store, place.game, place, place.at);
    if (now) {
      const open = openerOf(store, place, selectArmy);
      return { name: now.name, icon: now.icon, open, gone: open === null, elsewhere: false };
    }
    if (placeLoaded(store, place.game, place)) return { ...asSent, open: null, gone: true, elsewhere: false };
    const tile = place.tile;
    const owner = place.kind === "site" ? undefined : place.owner;
    if (!tile || !owner) return { ...asSent, open: null, gone: false, elsewhere: false };
    const open = linkFrom(place.at, () => {
      startRealmVisit({ player: owner.player, structureId: owner.realm, opensOn: null });
      openWhereShared(place, tile);
    });
    return { ...asSent, open, gone: open === null, elsewhere: false };
  };
};

/**
 * A place opened on the tile the message names (a site's own, or where an army or structure stood when shared), on its
 * layer, with it selected there once the map has it.
 */
const openWhereShared = (place: SharedPlace, { col, row, alt }: PlaceTile) => {
  useUIStore.getState().setMapLayer(alt);
  const at = Position.fromContract({ x: col, y: row });
  if (place.kind === "site") openOnMap(at, "tile");
  else if (place.kind === "army") openOnMap(at, { kind: "army", entityId: place.entityId, tile: "own" });
  else openOnMap(at, { kind: "structure", entityId: place.entityId });
};

const openerOf = (
  store: ReturnType<typeof useGame>["setup"]["store"],
  place: SharedPlace,
  selectArmy: (entityId: number) => void,
): (() => void) | null => {
  const gameId = place.game.gameId;
  if (place.kind === "army")
    return store.entityOccupancy(gameId, place.entityId) ? linkFrom(place.at, () => selectArmy(place.entityId)) : null;
  if (place.kind === "site") return linkFrom(place.at, () => openWhereShared(place, place.tile));
  // A Frontier realm stands on its day's site; any other structure on the tile it occupies, none once it is gone.
  const structure = store.get("Structure", { game_id: gameId, entity_id: place.entityId });
  const onMap = structure && (isExpeditionRealm(store, structure) || store.entityOccupancy(gameId, place.entityId));
  const site = onMap ? structureMapPosition(store, structure) : null;
  if (!site) return null;
  const intent = { kind: "structure" as const, entityId: place.entityId };
  return linkFrom(place.at, () => openOnMap(Position.fromContract(site), intent));
};
