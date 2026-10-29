import { createContext, useContext } from "react";

import { useGame } from "@/hooks/context/game-context";
import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { linkFrom, openOnMap } from "@/play/navigation/open-place";
import { getActiveGame } from "@/runtime/world/store";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { isExpeditionRealm, Position, structureMapPosition } from "@bibliothecadao/eternum";
import { placeOnMap, sameGame, type SharedPlace } from "../../model/place";

/**
 * A place a message carries, as this client reads it (usePlaceReader): its name and painting, what opens it (none
 * once gone, from a closed Frontier day, or in another game), and whether it stands in another game.
 */
export interface PlaceReading {
  name: string;
  icon: IconMeaning;
  open: (() => void) | null;
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
}

export const ChatMapContext = createContext<ChatMap | null>(null);

export const useChatMap = () => useContext(ChatMapContext);

const PLACE_MODELS = ["Structure", "ExplorerTroops", "TileOccupancy"] as const;

/**
 * How this game reads a place a message carries, the one reading the chip and the chat strip share. A place in another
 * game (another chain, or another game on this one) is never looked up here: it reads as the message has it and opens
 * nothing. One in this game is named and painted as the map has it (a message cannot rename a place), else as the
 * message has it, and opens as the Feed opens its stories, on today's map only (linkFrom): an army selected where it
 * stands now, a structure on its tile, a site's tile on its layer. Gone, it opens nothing.
 */
export const usePlaceReader = (): ((place: SharedPlace) => PlaceReading) => {
  const {
    setup: { store },
  } = useGame();
  useNativeRevision(PLACE_MODELS);
  const selectArmy = useSelectArmyOnMap();
  const here = getActiveGame();
  return (place) => {
    const elsewhere = !here || !sameGame(place.game, here);
    const now = elsewhere ? null : placeOnMap(store, place.game, place, place.at);
    return {
      name: now?.name ?? place.name,
      icon: now?.icon ?? place.icon,
      open: now ? openerOf(store, place, selectArmy) : null,
      elsewhere,
    };
  };
};

const openerOf = (
  store: ReturnType<typeof useGame>["setup"]["store"],
  place: SharedPlace,
  selectArmy: (entityId: number) => void,
): (() => void) | null => {
  const gameId = place.game.gameId;
  if (place.kind === "army")
    return store.entityOccupancy(gameId, place.entityId) ? linkFrom(place.at, () => selectArmy(place.entityId)) : null;
  if (place.kind === "site") {
    const { col, row, alt } = place.tile;
    return linkFrom(place.at, () => {
      useUIStore.getState().setMapLayer(alt);
      openOnMap(Position.fromContract({ x: col, y: row }), "tile");
    });
  }
  // A Frontier realm stands on its day's site; any other structure on the tile it occupies, none once it is gone.
  const structure = store.get("Structure", { game_id: gameId, entity_id: place.entityId });
  const onMap = structure && (isExpeditionRealm(store, structure) || store.entityOccupancy(gameId, place.entityId));
  const site = onMap ? structureMapPosition(store, structure) : null;
  if (!site) return null;
  const intent = { kind: "structure" as const, entityId: place.entityId };
  return linkFrom(place.at, () => openOnMap(Position.fromContract(site), intent));
};
