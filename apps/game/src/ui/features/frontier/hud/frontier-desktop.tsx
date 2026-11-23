import { usePartShown } from "../opening/opening-context";
import { HUD_COLUMN_MARK } from "@/three/utils/labels/hud-clearance";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudPill, HudTabs, SheetDock } from "@/ui/design-system/kit/hud-elements";
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

export const FrontierDesktop = ({
  season,
  clock,
  depthSwitch,
  realm,
  armies,
  page,
  foot,
  places,
  children,
}: {
  /** The player's place on the season's board, in the top bar's chip, which opens it. */
  season?: SeasonGoal;
  /** The day, in the top bar's clock place. */
  clock: ReactNode;
  depthSwitch?: ReactNode;
  realm?: ReactNode;
  armies?: ReactNode;
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
      <TopHeader season={season} places={places} depthSwitch={depthSwitch} clock={clock} />
      <HudColumn label={REALM}>
        {realm}
        <div className="flex shrink-0 flex-col">{armies}</div>
        <HudMinimap className="mt-auto min-h-hud-minimap w-full shrink" />
      </HudColumn>
      <FrontierRail page={page} onPanel={setPanel} />
      <HudFoot>
        <div className="pointer-events-none flex flex-col items-center gap-3">{foot}</div>
      </HudFoot>
      <SheetDock.Provider value={panel}>{children}</SheetDock.Provider>
    </div>
  );
};

/**
 * Frontier's right rail on a desktop, the one home for everything (the owner, 22 October: "The right rail being home
 * for everything is perfect"): the client's own notices (a refused order, a warning, the game clock's milestones) on top
 * whatever is open, as they stood atop Events, then the open panel (a nav page such as the Feed, or any sheet the HUD
 * opens: Build, an army, a site, Today), which stands in the rail; with none open, nothing. Chat stands at its foot.
 */
const FrontierRail = ({
  page,
  onPanel,
}: {
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
      <div aria-label="Notices" className="ui ui-panel pointer-events-auto shrink-0 px-3 py-2 empty:hidden">
        <FeedToasts />
      </div>
      <div ref={onPanel} data-rail-panel className="flex min-h-0 flex-1 flex-col gap-2 empty:hidden">
        {page}
      </div>
      <div className={cn("mt-auto flex shrink-0 flex-col justify-end", chatOpen && "min-h-hud-chat-least")}>
        <HudChatWindow open={chatOpen} onOpenChange={setChatOpen} />
      </div>
    </aside>
  );
};

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
  const researchOpen = usePartShown("research");
  const aspectsOpen = usePartShown("aspects");
  const tabs = [
    ...(research !== undefined && researchOpen
      ? [
          {
            key: "research" as const,
            label: RESEARCH,
            icon: "research" as const,
            ariaLabel: RESEARCH,
            count: research ? 1 : undefined,
            countTone: "good" as const,
          },
        ]
      : []),
    {
      key: "feed" as const,
      label: EVENTS_WORDS.feed,
      icon: "chronicles" as const,
      ariaLabel: EVENTS_WORDS.feed,
      count: unread > 0 ? unread : undefined,
    },
    ...(aspectsOpen ? [{ key: "season" as const, label: SEASON, icon: "victory" as const, ariaLabel: SEASON }] : []),
  ];
  return (
    <HudPill label="Places" className="pointer-events-auto px-2">
      {[
        <nav key="places" aria-label="Places">
          <HudTabs<HudSurface>
            size="sm"
            tabs={tabs}
            value={surface}
            onChange={(to) => onSurface(surface === to ? null : to)}
          />
        </nav>,
      ]}
    </HudPill>
  );
};
