import { useGame } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getActiveGame } from "@/runtime/world/store";
import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";
import { useRealmsAccountOf } from "@/shell/herald";
import { getBlockTimestamp, isRealmCategory } from "@bibliothecadao/eternum";
import { playerAvatarUrl, usePlayers } from "@/hooks/use-player-profile";
import { type ReactNode, useMemo } from "react";

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
  const registered = usePlayers();
  const players = useMemo(
    () =>
      registered.flatMap((player) =>
        player.name === null ? [] : [{ name: player.name, portrait: playerAvatarUrl(player.address, player) }],
      ),
    [registered],
  );
  const selection = useUIStore((state) => state.mapSelection ?? state.setAsidePick);
  const layer = useUIStore((state) => state.mapLayer);
  const here = getActiveGame();
  const game = here && { chainId: here.chainId, gameId: here.gameId, name: here.name };
  const now = getBlockTimestamp().currentBlockTimestamp;
  const map: ChatMap = {
    selected: game ? sharedPlaceOf(store, game, selection, layer, now) : null,
    read,
    players,
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
 * A place in a message, named and painted by usePlaceReader. It opens locally or by visiting its owner. A chip with
 * no action is inert; only a place known gone says "gone". Other-game and lobby chips name their game. An unloaded
 * place without a visit target keeps its name without claiming it is gone.
 */
export const PlaceChip = ({ place }: { place: SharedPlace }) => {
  const map = useChatMap();
  const { name, icon, open, gone, elsewhere } = map?.read(place) ?? {
    name: place.name,
    icon: place.icon,
    open: null,
    gone: false,
    elsewhere: true,
  };
  const inert = open === null;
  const why = elsewhere ? `${CHAT_WORDS.inGame} ${place.game.name}` : gone ? CHAT_WORDS.placeGone : null;
  return (
    <span
      className="inline-flex items-center align-middle"
      data-place={name}
      data-place-key={placeKey(place)}
      data-elsewhere={elsewhere || undefined}
      data-gone={gone || undefined}
    >
      <HudChip icons={[icon]} onPress={open ?? undefined} disabled={inert}>
        {why ? `${name} · ${why}` : name}
      </HudChip>
    </span>
  );
};
