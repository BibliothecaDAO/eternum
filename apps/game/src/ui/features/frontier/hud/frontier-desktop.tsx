import "./frontier-bar.css";

import { usePartShown } from "../opening/opening-context";
import { HUD_COLUMN_MARK } from "@/three/utils/labels/hud-clearance";
import { Icon } from "@/ui/design-system/icon";
import { SheetDock } from "@/ui/design-system/kit/hud-elements";
import { REALM } from "@/ui/design-system/kit/words";
import { FeedToasts, useUnreadImportantCount } from "@/ui/features/event-feed/quick-feed";
import type { SeasonGoal } from "@/ui/features/world/containers/top-header/identity-chip";
import { TopHeader } from "@/ui/features/world/containers/top-header/top-header";
import { HudFoot } from "@/ui/features/world/hud/desktop-hud";
import { type ReactNode, useState } from "react";

import type { HudSurface } from "./frontier-nav";
import { resolveHudPlaces } from "./hud-places";
import { useHudScale } from "./hud-scale";

export const FrontierDesktop = ({
  identity,
  season,
  clock,
  quest,
  stores,
  depthSwitch,
  banner,
  realm,
  armies,
  aspectChip,
  page,
  widePage = false,
  foot,
  places,
  children,
}: {
  identity?: ReactNode;
  season?: SeasonGoal;
  clock: ReactNode;
  quest?: ReactNode;
  stores?: ReactNode;
  depthSwitch?: ReactNode;
  banner?: ReactNode;
  realm?: ReactNode;
  armies?: ReactNode;
  aspectChip?: ReactNode;
  page?: ReactNode;
  widePage?: boolean;
  foot?: ReactNode;
  places: ReactNode;
  children?: ReactNode;
}) => {
  const [railPanel, setRailPanel] = useState<HTMLElement | null>(null);
  const showWide = Boolean(widePage && page);
  return (
    <div style={{ zoom: useHudScale() }}>
      <TopHeader
        identity={identity}
        season={season}
        places={places}
        quest={quest}
        stores={stores}
        depthSwitch={depthSwitch}
        clock={clock}
      />
      <div className="pointer-events-none fixed inset-x-4 bottom-hud-base top-hud-frontier-page-top z-hud-rail flex flex-col gap-2">
        {banner && <div className="pointer-events-none flex shrink-0 justify-center empty:hidden">{banner}</div>}
        {showWide ? (
          <div className="pointer-events-none flex min-h-0 flex-1 flex-col gap-2">
            <div className="pointer-events-none flex shrink-0 justify-end empty:hidden">
              <FrontierRail onPanel={setRailPanel} />
            </div>
            <div
              data-wide-page
              className="pointer-events-none flex min-h-0 flex-1 flex-col [&>[data-kit-frame]]:pointer-events-auto [&>[data-kit-frame]]:max-h-full [&>[data-kit-frame]]:w-full [&>[data-kit-frame]]:flex-1"
            >
              {page}
            </div>
          </div>
        ) : (
          <div className="pointer-events-none flex min-h-0 flex-1 items-stretch justify-between gap-4">
            <aside
              {...HUD_COLUMN_MARK}
              aria-label={REALM}
              className="pointer-events-none flex min-h-0 w-hud-frontier-rail flex-col gap-2"
            >
              {!page && realm && <div className="pointer-events-none flex min-h-0 shrink flex-col">{realm}</div>}
              {!page && armies && <div className="pointer-events-none shrink-0">{armies}</div>}
              <div data-realm-slot className="flex min-h-0 flex-1 flex-col gap-2 empty:hidden">
                {page}
              </div>
            </aside>
            <FrontierRail onPanel={setRailPanel} />
          </div>
        )}
      </div>
      {!showWide && aspectChip && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-hud-column">{aspectChip}</div>
      )}
      <HudFoot>
        <div className="pointer-events-none flex flex-col items-center gap-3">{foot}</div>
      </HudFoot>
      <SheetDock.Provider value={railPanel}>{children}</SheetDock.Provider>
    </div>
  );
};

const FrontierRail = ({ onPanel }: { onPanel: (panel: HTMLElement | null) => void }) => (
  <aside
    {...HUD_COLUMN_MARK}
    aria-label="Guided rail"
    data-hud-rail
    data-frontier-rail
    className="pointer-events-none flex min-h-0 flex-col gap-2"
  >
    <div aria-label="Notices" className="ui ui-panel pointer-events-auto shrink-0 px-3 py-2 empty:hidden">
      <FeedToasts />
    </div>
    <div ref={onPanel} data-rail-panel className="flex min-h-0 flex-1 flex-col gap-2 empty:hidden" />
  </aside>
);

export const FrontierPlaces = ({
  surface,
  onSurface,
  research,
  chatUnread = 0,
  relics = 0,
  hasRealm = true,
}: {
  surface: HudSurface | null;
  onSurface: (surface: HudSurface | null) => void;
  research?: boolean;
  chatUnread?: number;
  relics?: number;
  hasRealm?: boolean;
}) => {
  const unread = useUnreadImportantCount(surface === "feed");
  const researchOpen = usePartShown("research");
  const aspectsOpen = usePartShown("aspects");
  const relicsOpen = usePartShown("relic-slots");
  const tabs = resolveHudPlaces({
    aspectsOpen,
    researchOpen,
    relicsOpen,
    researchReady: research,
    feedUnread: unread,
    chatUnread,
    chatOpen: surface === "chat",
    relics,
    hasRealm,
  });
  return (
    <nav aria-label="Places" role="tablist" className="frontier-places pointer-events-auto">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={surface === tab.key}
          aria-label={tab.ariaLabel}
          className="ui-pick frontier-place"
          onClick={() => onSurface(surface === tab.key ? null : tab.key)}
        >
          <Icon name={tab.icon} size={18} />
          <span>{tab.label}</span>
          {tab.count !== undefined && (
            <span className="frontier-place__badge" data-tone={tab.countTone} aria-label={tab.countLabel}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
};
