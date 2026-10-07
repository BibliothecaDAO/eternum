import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useState } from "react";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { useGoToFrontierPlace } from "../frontier-home";
import { canResearchNow } from "../research/research-plan";
import { useResearchPlan } from "../research/research-reader";
import { type Place, PlaceNav } from "./place-nav";

/** What the HUD has open over the map: a nav page, the Menu, or a way the Menu opens. */
export type HudSurface = "research" | "chat" | "menu" | "today" | "settings";

/**
 * What the HUD has open. Opening a surface lets go of the tile, plot or building the player had tapped, so one sheet
 * stands at a time.
 */
export const useHudSurface = () => {
  const [surface, setSurface] = useState<HudSurface | null>(null);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const open = (next: HudSurface | null) => {
    if (next) {
      setSelectedHex(null);
      setSelectedBuildingHex(null);
    }
    setSurface(next);
  };
  return [surface, open] as const;
};

/**
 * The place bar over the game: Map and Realm move the camera between the day's map and the realm board, the other
 * slots open their page or the Menu (a second tap closes it). A spectator with no realm has only the map.
 */
export const FrontierNav = ({
  realm,
  surface,
  onSurface,
  unread,
}: {
  realm: NativeRows["Structure"] | null;
  surface: HudSurface | null;
  onSurface: (surface: HudSurface | null) => void;
  unread: number;
}) => {
  const { isMapView } = useQuery();
  const place: Place =
    surface === "research" || surface === "chat" || surface === "menu" ? surface : isMapView ? "map" : "realm";
  const goToPlace = useGoToFrontierPlace(realm);
  const researchDot = canResearchNow(useResearchPlan(realm));
  const go = (to: Place) => {
    if (to === "map" || to === "realm") {
      onSurface(null);
      goToPlace(to === "map");
      return;
    }
    onSurface(surface === to ? null : to);
  };
  return <PlaceNav place={place} onGo={go} researchDot={researchDot} unread={unread} />;
};
