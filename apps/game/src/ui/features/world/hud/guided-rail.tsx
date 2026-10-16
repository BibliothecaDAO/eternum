import { useQuery } from "@/hooks/helpers/use-query";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import {
  type MapTileParts,
  SelectedWorldmapEntity,
} from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { useSelectedTileDetails } from "@/ui/features/world/components/bottom-right-panel";
import { HudChatWindow } from "@/ui/features/world/containers/hud-chat-window";
import { useCallback, useState } from "react";
import { EventsCard } from "./events-card";
import { NextUp } from "./next-up";

type Focus = "none" | "chat" | "log";

/**
 * The right rail: Next up on top (the one suggestion), the event log under it, always on, then what the player
 * picked, and chat at the foot, a strip that opens its own window. On the world map the picked tile shows its
 * structure, army or emptiness and its biome as two tabs, so each gets the rail's height; in the realm view the
 * picked building shows as one compact panel.
 */
export const GuidedRail = () => {
  const [focus, setFocus] = useState<Focus>("none");
  const toggleLog = useCallback(() => setFocus((current) => (current === "log" ? "none" : "log")), []);
  const setChatOpen = useCallback((open: boolean) => setFocus(open ? "chat" : "none"), []);
  const { isMapView } = useQuery();
  return (
    <aside
      aria-label="Guided rail"
      className="pointer-events-none fixed bottom-4 right-3 top-[60px] z-30 flex w-[320px] flex-col gap-2"
    >
      <NextUp />
      <EventsCard logOpen={focus === "log"} onLogToggle={toggleLog} />
      {isMapView ? <PickedMapTile /> : <PickedBuilding />}
      <div className="mt-auto">
        <HudChatWindow open={focus === "chat"} onOpenChange={setChatOpen} />
      </div>
    </aside>
  );
};

const TILE_DETAILS = "pointer-events-auto flex min-h-0 flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin";

/** The building picked in the realm view, with its actions, in one panel. */
const PickedBuilding = () => {
  const building = useSelectedTileDetails();
  if (!building) return null;
  return (
    <div aria-label="Tile details" className={TILE_DETAILS}>
      {building}
    </div>
  );
};

/** The picked map tile, as the tile panel builds it: what stands on it and its biome, one tab at a time. */
const PickedMapTile = () => (
  <SelectedWorldmapEntity hideHoldingResources layout={(parts) => <MapTileTabs parts={parts} />} />
);

type MapTileTab = "occupant" | "biome";

/** A bare tile shows its biome alone; an occupied one, its occupant and its biome under two tabs. */
const MapTileTabs = ({ parts }: { parts: MapTileParts }) => {
  const [tab, setTab] = useState<MapTileTab>("occupant");
  if (!parts.occupant)
    return (
      <div aria-label="Tile details" className={TILE_DETAILS}>
        {parts.biome}
      </div>
    );
  return (
    <>
      <div
        role="tablist"
        aria-label="Picked tile"
        className={cn(OVERLAY_SURFACE_BASE, "hud-tabs hud-tabs--words pointer-events-auto rounded-xl px-2")}
      >
        <RailTab lit={tab === "occupant"} onPress={() => setTab("occupant")} word={parts.occupantWord ?? "Tile"} />
        <RailTab lit={tab === "biome"} onPress={() => setTab("biome")} word="Biome" />
      </div>
      <div role="tabpanel" aria-label="Tile details" className={TILE_DETAILS}>
        {tab === "occupant" ? parts.occupant : parts.biome}
      </div>
    </>
  );
};

const RailTab = ({ lit, onPress, word }: { lit: boolean; onPress: () => void; word: string }) => (
  <button type="button" role="tab" aria-selected={lit} className="hud-tab" onClick={onPress}>
    {word}
  </button>
);
