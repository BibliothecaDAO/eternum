import { HUD_COLUMN_MARK } from "@/three/utils/labels/hud-clearance";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudBubble, SheetDock } from "@/ui/design-system/kit/hud-elements";
import { OpenedFromPanel } from "@/ui/design-system/kit/opened-from-panel";
import { EVENTS_WORDS, REALM, RESEARCH, SEASON } from "@/ui/design-system/kit/words";
import { FeedToasts, useUnreadImportantCount } from "@/ui/features/event-feed/quick-feed";
import { HudChatWindow } from "@/ui/features/world/containers/hud-chat-window";
import type { SeasonGoal } from "@/ui/features/world/containers/top-header/identity-chip";
import { TopHeader } from "@/ui/features/world/containers/top-header/top-header";
import { HudColumn, HudFoot } from "@/ui/features/world/hud/desktop-hud";
import { HudMinimap } from "@/ui/features/world/hud/minimap";
import { type ReactNode, useState } from "react";

import type { HudSurface } from "./frontier-nav";
import { useHudScale } from "./hud-scale";

/**
 * Frontier on the one desktop HUD every mode shares (the owner, 19 October 2026: "A unified hud, with elements that can
 * differ a bit"; issue 5067): the shared top bar, the left column, the rail and the foot, with Frontier's own panels in
 * them. The top bar's clock is the day's, Frontier's one day timer. The left column holds one panel for the realm (its
 * stores and LORDS as rings, as Blitz's realm card reads a holding), one for its armies, and the minimap; the rail is the
 * one home for everything (FrontierRail); the foot the selected army's state over the round places. An order goes from
 * the map itself, as in Blitz. The whole HUD draws bigger on a bigger screen (useHudScale).
 */
export const FrontierDesktop = ({
  season,
  clock,
  realm,
  armies,
  nextUp,
  page,
  foot,
  places,
  children,
}: {
  /** The player's place on the season's board, in the top bar's chip, which opens it. */
  season?: SeasonGoal;
  /** The day, in the top bar's clock place. */
  clock: ReactNode;
  realm?: ReactNode;
  armies?: ReactNode;
  nextUp?: ReactNode;
  /** A nav page (the Feed, Research, the Season's board): it stands in the rail's panel. */
  page?: ReactNode;
  /** Over the places: notices, the selected army's state, a visit's Leave. */
  foot?: ReactNode;
  places: ReactNode;
  /** The HUD's sheets: each stands in the rail's panel. */
  children?: ReactNode;
}) => {
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  return (
    <div style={{ zoom: useHudScale() }}>
      <TopHeader season={season} clock={clock} />
      <HudColumn label={REALM}>
        {realm}
        <div className="flex shrink-0 flex-col">{armies}</div>
        <HudMinimap className="mt-auto min-h-hud-minimap w-full shrink" />
      </HudColumn>
      <FrontierRail nextUp={nextUp} page={page} onPanel={setPanel} />
      <HudFoot>
        <div className="pointer-events-none flex flex-col items-center gap-2">
          {foot}
          {places}
        </div>
      </HudFoot>
      <SheetDock.Provider value={panel}>{children}</SheetDock.Provider>
    </div>
  );
};

/**
 * Frontier's right rail on a desktop, the one home for everything (the owner, 22 October: "The right rail being home
 * for everything is perfect"): Next up on top, then the open panel (a nav page such as the Feed, or any sheet the HUD
 * opens: Build, an army, a site, Today), which stands in the rail; with none open, nothing. The client's own notices (a refused order, a warning, the game clock's milestones) stand under
 * Next up whatever is open, as they stood atop Events. Chat stands at its foot.
 */
const FrontierRail = ({
  nextUp,
  page,
  onPanel,
}: {
  nextUp?: ReactNode;
  page?: ReactNode;
  /** The panel's place, where the HUD's sheets stand. */
  onPanel: (panel: HTMLElement | null) => void;
}) => {
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <aside
      {...HUD_COLUMN_MARK}
      aria-label="Guided rail"
      data-hud-rail
      data-frontier-rail
      className="pointer-events-none fixed bottom-hud-base right-3 top-hud-header z-hud-rail flex flex-col gap-2"
    >
      {nextUp && <div className="shrink-0">{nextUp}</div>}
      <div aria-label="Notices" className="ui ui-panel pointer-events-auto shrink-0 px-3 py-2 empty:hidden">
        <FeedToasts />
      </div>
      <div ref={onPanel} data-rail-panel className="flex min-h-0 flex-1 flex-col gap-2 empty:hidden">
        {page && <OpenedFromPanel.Provider value>{page}</OpenedFromPanel.Provider>}
      </div>
      <div className={cn("mt-auto flex shrink-0 flex-col justify-end", chatOpen && "min-h-hud-chat-least")}>
        <HudChatWindow open={chatOpen} onOpenChange={setChatOpen} />
      </div>
    </aside>
  );
};

/**
 * Frontier's places as the shared HUD's round bubbles, each a surface pressed while it stands and closed by a second
 * press: Research (lit while a node can be bought), the Feed (counting what is unread and important, as a phone's place
 * bar does), and the Season. Today opens from the top bar's day. A desktop has no Menu: Map and Realm are the top bar's
 * Realm / World, chat the rail's strip, the Realms' labor the realm panel's chip, and leaving the game Settings' Leave
 * game.
 */
export const FrontierPlaces = ({
  surface,
  onSurface,
  research,
}: {
  surface: HudSurface | null;
  onSurface: (surface: HudSurface | null) => void;
  /** Whether a research node can be bought now; absent for a spectator, who has no Research. */
  research?: boolean;
}) => {
  const unread = useUnreadImportantCount(surface === "feed");
  const bubble = (to: HudSurface, icon: Parameters<typeof HudBubble>[0]["icon"], word: string, count?: number) => (
    <HudBubble
      key={to}
      icon={icon}
      word={word}
      count={count}
      countTone="good"
      pressed={surface === to}
      aria-label={word}
      onClick={() => onSurface(surface === to ? null : to)}
    />
  );
  return (
    <nav aria-label="Places" className="pointer-events-auto flex items-start gap-3">
      {research !== undefined && bubble("research", "research", RESEARCH, research ? 1 : undefined)}
      {bubble("feed", "chronicles", EVENTS_WORDS.feed, unread > 0 ? unread : undefined)}
      {bubble("season", "victory", SEASON)}
    </nav>
  );
};
