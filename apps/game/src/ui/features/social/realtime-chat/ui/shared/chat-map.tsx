import { useGame } from "@/hooks/context/game-context";
import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { linkFrom, openOnMap } from "@/play/navigation/open-place";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudChip } from "@/ui/design-system/kit/hud-elements";
import {
  configManager,
  getBlockTimestamp,
  isExpeditionRealm,
  Position,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import type { ReactNode } from "react";

import { placeOnMap, type SharedPlace, sharedPlaceOf } from "../../model/place";
import { type ChatMap, ChatMapContext, useChatMap } from "./use-chat-map";

/**
 * The game's map for the chat inside it: what the player selected, read again as the map's facts change, and a place
 * opened as the Feed opens its stories, on today's map only (linkFrom): an army selected where it stands now, a
 * structure on the map with it selected.
 */
export const GameChatMap = ({ children }: { children: ReactNode }) => {
  const {
    setup: { store },
  } = useGame();
  useNativeRevision(["Structure", "ExplorerTroops", "TileOccupancy"]);
  const selection = useUIStore((state) => state.mapSelection);
  const selectArmy = useSelectArmyOnMap();
  const gameId = configManager.getActiveGameId();
  const openerOf = (place: SharedPlace) => {
    if (place.kind === "army")
      return store.entityOccupancy(gameId, place.entityId)
        ? linkFrom(place.at, () => selectArmy(place.entityId))
        : null;
    // A Frontier realm stands on its day's site; any other structure on the tile it occupies, none once it is gone.
    const structure = store.get("Structure", { game_id: gameId, entity_id: place.entityId });
    const onMap = structure && (isExpeditionRealm(store, structure) || store.entityOccupancy(gameId, place.entityId));
    const site = onMap ? structureMapPosition(store, structure) : null;
    if (!site) return null;
    const intent = { kind: "structure" as const, entityId: place.entityId };
    return linkFrom(place.at, () => openOnMap(Position.fromContract(site), intent));
  };
  const map: ChatMap = {
    selected: sharedPlaceOf(store, gameId, selection, getBlockTimestamp().currentBlockTimestamp),
    read: (place) => {
      const now = placeOnMap(store, gameId, place.kind, place.entityId, place.at);
      return { name: now?.name ?? place.name, icon: now?.icon ?? place.icon, open: openerOf(place) };
    },
  };
  return <ChatMapContext.Provider value={map}>{children}</ChatMapContext.Provider>;
};

/**
 * A place in a message, as a chip: its painting and its name, as the map reads them (ChatMap.read). Pressed, the map
 * opens on it. Where the map has it no more (gone, or from a closed Frontier day) it is struck through and opens
 * nothing; with no map (outside a game) it is only read.
 */
export const PlaceChip = ({ place }: { place: SharedPlace }) => {
  const map = useChatMap();
  const { name, icon, open } = map?.read(place) ?? { name: place.name, icon: place.icon, open: null };
  return (
    <span className={cn("inline-flex align-middle", map && !open && "line-through opacity-50")} data-place={name}>
      <HudChip icons={[icon]} onPress={open ?? undefined} disabled={map !== null && open === null}>
        {name}
      </HudChip>
    </span>
  );
};
