import { useQuery } from "@/hooks/helpers/use-query";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { useGoToFrontierPlace } from "../frontier-home";
import { realmDot, useRealmStores } from "../realm-stores";
import { useResearchTree } from "../research/research-facts";
import { canResearchNow } from "../research/research-tree";
import { type Place, PlaceNav } from "./place-nav";

/** What the HUD has open over the map: a nav page, the Menu, or a way the Menu opens. */
export type HudSurface =
  | "research"
  | "log"
  | "chat"
  | "menu"
  | "today"
  | "settings"
  | "season"
  | "army"
  | "withdraw"
  | "realms";

/**
 * The place bar over the game: each slot opens its place over the map and a second tap closes it. Realm opens the
 * realm board and closes it back to the map; the others open their page or the Menu. The Realm slot carries a dot
 * while a store the realm spends is full or fills within the hour. A spectator, with no realm of their own, opens the
 * realm they watch, and has no Research.
 */
export const FrontierNav = ({
  rules,
  realm,
  board,
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
  surface: HudSurface | null;
  onSurface: (surface: HudSurface | null) => void;
  /** Events arrived since the Log was last read. */
  events: number;
  unread: number;
}) => {
  const { isMapView } = useQuery();
  const place: Place | null =
    surface === "research" || surface === "log" || surface === "chat" || surface === "menu"
      ? surface
      : surface === "season"
        ? "menu"
        : isMapView
          ? null
          : "realm";
  const goToPlace = useGoToFrontierPlace(board);
  const researchDot = canResearchNow(useResearchTree(realm)?.nodes);
  const stores = useRealmStores(realm, rules);
  const go = (to: Place) => {
    if (to === "realm") {
      onSurface(null);
      goToPlace(place === "realm");
      return;
    }
    onSurface(surface === to ? null : to);
  };
  return (
    <PlaceNav
      place={place}
      onGo={go}
      realmDot={stores ? realmDot([stores.wheat, stores.labor, stores.troops]) : undefined}
      researchDot={realm ? researchDot : undefined}
      events={events}
      unread={unread}
    />
  );
};
