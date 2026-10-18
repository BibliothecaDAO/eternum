import { useQuery } from "@/hooks/helpers/use-query";
import { HUD_COLUMN_MARK } from "@/three/utils/labels/hud-clearance";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { useSelectedTileDetails } from "@/ui/features/world/components/bottom-right-panel";
import { HudChatWindow } from "@/ui/features/world/containers/hud-chat-window";
import { type ReactNode, useCallback, useState } from "react";
import { EventsCard } from "./events-card";
import { NextUp } from "./next-up";

type Focus = "none" | "chat" | "log";

/**
 * The right rail: Next up on top (the one suggestion), the event log under it, always on, then what the player
 * picked, and chat at the foot, a strip that opens its own window. On the world map the picked tile shows what
 * stands on it and its biome, stacked; in the realm view the picked building shows as one compact panel.
 */
export const GuidedRail = () => {
  const [focus, setFocus] = useState<Focus>("none");
  const toggleLog = useCallback(() => setFocus((current) => (current === "log" ? "none" : "log")), []);
  const setChatOpen = useCallback((open: boolean) => setFocus(open ? "chat" : "none"), []);
  const { isMapView } = useQuery();
  return (
    <RailFrame>
      <NextUp />
      <EventsCard logOpen={focus === "log"} onLogToggle={toggleLog} />
      {isMapView ? <PickedMapTile /> : <PickedBuilding />}
      <HudChatWindow open={focus === "chat"} onOpenChange={setChatOpen} />
    </RailFrame>
  );
};

/**
 * The rail's frame: the right column, from under the top bar down to the base band. Its stacking rule: the panels that
 * are always on keep their height; the picked tile's details and the open chat share the room left, each giving up
 * room in proportion to its height, the details scrolling inside theirs and chat keeping at least its least height
 * (`chat-least`), so neither covers the other.
 */
export const RailFrame = ({ children }: { children: ReactNode }) => (
  <aside
    {...HUD_COLUMN_MARK}
    aria-label="Guided rail"
    className="pointer-events-none fixed bottom-hud-base right-3 top-hud-header z-hud-rail flex w-hud-column flex-col gap-2"
  >
    {children}
  </aside>
);

/** The picked tile's details in the rail: they shrink with the room the rail leaves them and scroll inside it. */
export const TileDetails = ({ children }: { children: ReactNode }) => (
  <div
    aria-label="Tile details"
    className="pointer-events-auto flex min-h-0 flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin"
  >
    {children}
  </div>
);

/** The building picked in the realm view, with its actions, in one panel. */
const PickedBuilding = () => {
  const building = useSelectedTileDetails();
  return building ? <TileDetails>{building}</TileDetails> : null;
};

/** The picked map tile as the tile panel draws it: what stands on it, then its biome. */
const PickedMapTile = () => (
  <TileDetails>
    <SelectedWorldmapEntity />
  </TileDetails>
);
