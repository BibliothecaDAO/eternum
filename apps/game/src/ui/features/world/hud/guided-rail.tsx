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
 * The right rail, every mode's: what leads it on top (Blitz's Next up, Frontier's guide), the build order under it
 * where the mode has one (Blitz's and Eternum's: a row per realm whose next step can be taken), the event log, always
 * on, then what the player picked, and chat at the foot, a strip that opens its own window. On the world map
 * the picked tile shows what stands on it and its biome, stacked; in the realm view the picked building shows as one
 * compact panel. A mode whose picked tile opens its own card (Frontier's) leaves `picked` off.
 */
export const GuidedRail = ({
  lead = <NextUp />,
  buildOrder,
  picked = true,
}: {
  lead?: ReactNode;
  buildOrder?: ReactNode;
  picked?: boolean;
}) => {
  const [focus, setFocus] = useState<Focus>("none");
  const toggleLog = useCallback(() => setFocus((current) => (current === "log" ? "none" : "log")), []);
  const setChatOpen = useCallback((open: boolean) => setFocus(open ? "chat" : "none"), []);
  const { isMapView } = useQuery();
  return (
    <RailFrame>
      {lead}
      {buildOrder}
      <EventsCard logOpen={focus === "log"} onLogToggle={toggleLog} />
      {picked && (isMapView ? <PickedMapTile /> : <PickedBuilding />)}
      <HudChatWindow open={focus === "chat"} onOpenChange={setChatOpen} />
    </RailFrame>
  );
};

/**
 * The rail's frame: the right column, from under the top bar down to the base band. Its stacking rule: the panels that
 * are always on keep their height; the picked tile's details and the open chat share the room left, each giving up
 * room in proportion to its height, down to its least height (`details-least`, `chat-least`). On a screen too short
 * for those, the column scrolls as a whole inside its own box, so nothing in it reaches the base band. The scroller
 * reaches past the column's sides so the panels' shadows show; the column's own box, which the map's labels keep clear
 * of, stays the column.
 */
export const RailFrame = ({ children }: { children: ReactNode }) => (
  <aside
    {...HUD_COLUMN_MARK}
    aria-label="Guided rail"
    data-hud-rail
    className="pointer-events-none fixed bottom-hud-base right-3 top-hud-header z-hud-rail flex w-hud-column flex-col"
  >
    <div className="no-scrollbar -mx-6 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-6">
      {children}
    </div>
  </aside>
);

/**
 * The picked tile's details in the rail, sized to what they hold and scrolling inside it once the rail gives them
 * less. They keep at least `details-least` (as tall as their `height`, or what they hold when that is less: flexbox's
 * own least size for an item that does not scroll), so a header and a body always show.
 */
export const TileDetails = ({ children }: { children: ReactNode }) => (
  <div aria-label="Tile details" className="flex h-hud-details-least basis-content flex-col">
    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin">
      {children}
    </div>
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
