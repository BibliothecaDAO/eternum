import { useGame } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getActiveGame } from "@/runtime/world/store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";
import { useRealmsAccountOf } from "@/shell/herald";
import { getBlockTimestamp, isRealmCategory } from "@bibliothecadao/eternum";
import type { ReactNode } from "react";

import { placeKey, placeOnMap, type SharedPlace, sharedPlaceOf } from "../../model/place";
import { type ChatMap, ChatMapContext, useChatMap, usePlaceReader } from "./use-chat-map";

/**
 * The game's map for the chat inside it: what the player selected (or, on a phone, what Chat set aside as it opened
 * over the map), read again as the map's facts change, and each place read by usePlaceReader.
 */
export const GameChatMap = ({ children }: { children: ReactNode }) => {
  const {
    setup: { store },
  } = useGame();
  const read = usePlaceReader();
  const accountOf = useRealmsAccountOf();
  const selection = useUIStore((state) => state.mapSelection ?? state.setAsidePick);
  const layer = useUIStore((state) => state.mapLayer);
  const here = getActiveGame();
  const game = here && { chainId: here.chainId, gameId: here.gameId, name: here.name };
  const now = getBlockTimestamp().currentBlockTimestamp;
  const map: ChatMap = {
    selected: game ? sharedPlaceOf(store, game, selection, layer, now) : null,
    read,
    realmOf: (playerId) => {
      const account = game && accountOf(playerId);
      if (!game || !account) return null;
      for (const structure of store.structuresOwnedBy(game.gameId, BigInt(account)))
        if (isRealmCategory(structure.base.category))
          return placeOnMap(store, game, { kind: "structure", entityId: Number(structure.entity_id) }, now);
      return null;
    },
  };
  return <ChatMapContext.Provider value={map}>{children}</ChatMapContext.Provider>;
};

/**
 * A place in a message, as a chip: its painting and its name, as usePlaceReader reads them. Pressed, the map opens on
 * it. Where the map has it no more (gone, or from a closed Frontier day) it is struck through and opens nothing; in
 * another game it names that game and opens nothing here; with no map (outside a game) it is only read.
 */
export const PlaceChip = ({ place }: { place: SharedPlace }) => {
  const map = useChatMap();
  const { name, icon, open, elsewhere } = map?.read(place) ?? {
    name: place.name,
    icon: place.icon,
    open: null,
    elsewhere: true,
  };
  const gone = map !== null && !elsewhere && open === null;
  return (
    <span
      className={cn("inline-flex items-center gap-1 align-middle", gone && "line-through opacity-50")}
      data-place={name}
      data-place-key={placeKey(place)}
      data-elsewhere={elsewhere || undefined}
    >
      <HudChip icons={[icon]} onPress={open ?? undefined} disabled={map !== null && open === null}>
        {name}
      </HudChip>
      {elsewhere && (
        <span className="text-hud-label text-hud-cue">
          {CHAT_WORDS.inGame} {place.game.name}
        </span>
      )}
    </span>
  );
};
