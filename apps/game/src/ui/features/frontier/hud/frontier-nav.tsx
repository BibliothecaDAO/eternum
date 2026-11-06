import { useHomeKind } from "@/hooks/helpers/use-home-kind";
import { homeIcon } from "@/ui/design-system/home-icons";
import { useQuery } from "@/hooks/helpers/use-query";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { useGoToFrontierPlace } from "../frontier-home";
import { realmDot, useRealmStores } from "../realm-stores";
import { useResearchTree } from "../research/research-facts";
import { canResearchNow } from "../research/research-tree";
import { layerViews, type MapLayers } from "./map-layers";
import { type Place, PlaceNav } from "./place-nav";

/** What the HUD has open over the map: a nav page, the Menu, or a way the Menu opens. */
export type HudSurface =
  | "research"
  | "feed"
  | "chat"
  | "menu"
  | "today"
  | "settings"
  | "season"
  | "army"
  | "army-lost"
  | "withdraw"
  | "realms";

/**
 * The place bar over the game: the Realm / World switch takes the player to the realm's board from the map, and back to
 * the world from the board, putting any page away; each other slot opens its place over the map and a second tap
 * closes it. The Realm slot carries a dot
 * while a store the realm spends is full or fills within the hour. A spectator, with no realm of their own, opens the
 * realm they watch, and has no Research. Once the realm has an Ethereal layer, the switch on the map names the layer
 * shown and opens the list of views: Realm, the world and each Ethereal layer (owner, 4 November 2026: "yeah B is pretty
 * good on mobile").
 */
export const FrontierNav = ({
  rules,
  realm,
  board,
  layers,
  surface,
  onSurface,
  events,
  unread,
}: {
  rules: ExpeditionRules;
  /** The player's own realm; none for a spectator. */
  realm: NativeRows["Structure"] | null;
  /** The realm the Realm slot goes to: the player's own, or the one a spectator watches. */
  board: NativeRows["Structure"] | null;
  /** The map's layers (useMapLayers); none on the board or before Ethereal I. */
  layers: MapLayers | null;
  surface: HudSurface | null;
  onSurface: (surface: HudSurface | null) => void;
  /** Events arrived since the Feed was last read. */
  events: number;
  unread: number;
}) => {
  const { isMapView } = useQuery();
  const kind = useHomeKind(board);
  const place: Place | null =
    surface === "research" || surface === "feed" || surface === "chat" || surface === "menu"
      ? surface
      : surface === "season"
        ? "menu"
        : null;
  const goToPlace = useGoToFrontierPlace(board);
  const researchDot = canResearchNow(useResearchTree(realm)?.nodes);
  const stores = useRealmStores(realm, rules);
  // A view choice shows its view, the Realm / World switch's and a layer's alike: the open page goes.
  const putPageAway = () => onSurface(null);
  const go = (to: Place) => {
    if (to === "realm") {
      putPageAway();
      goToPlace(!isMapView);
      return;
    }
    onSurface(surface === to ? null : to);
  };
  const realmIcon = board ? homeIcon(kind, board.base.level) : "realm";
  return (
    <PlaceNav
      realmIcon={realmIcon}
      views={layers && layerViews(layers, { icon: realmIcon, go: () => go("realm") }, putPageAway)}
      place={place}
      onRealm={!isMapView}
      onGo={go}
      realmDot={stores ? realmDot([stores.wheat, stores.labor, stores.troops]) : undefined}
      researchDot={realm ? researchDot : undefined}
      events={events}
      unread={unread}
    />
  );
};
