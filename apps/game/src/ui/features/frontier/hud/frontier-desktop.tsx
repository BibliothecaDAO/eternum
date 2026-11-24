import "./frontier-bar.css";
import "./frontier-desktop.css";

import { usePartShown } from "../opening/opening-context";
import { HUD_COLUMN_MARK } from "@/three/utils/labels/hud-clearance";
import { Icon } from "@/ui/design-system/icon";
import { SheetDock } from "@/ui/design-system/kit/hud-elements";
import { REALM, SETTINGS } from "@/ui/design-system/kit/words";
import { FeedToasts, useUnreadImportantCount } from "@/ui/features/event-feed/quick-feed";
import { FollowingArmyPill } from "@/ui/features/world/containers/top-header/following-army-pill";
import { HudFoot } from "@/ui/features/world/hud/desktop-hud";
import { type ReactNode, useState } from "react";

import type { HudSurface } from "./frontier-nav";
import { resolveHudPlaces } from "./hud-places";
import { useHudScale } from "./hud-scale";

export const FrontierDesktop = ({
  placeSwitch,
  clock,
  quest,
  banner,
  realm,
  armies,
  page,
  widePage = false,
  foot,
  places,
  children,
}: {
  placeSwitch: ReactNode;
  clock: ReactNode;
  quest?: ReactNode;
  banner?: ReactNode;
  realm?: ReactNode;
  armies?: ReactNode;
  page?: ReactNode;
  widePage?: boolean;
  foot?: ReactNode;
  places: ReactNode;
  children?: ReactNode;
}) => {
  const [railPanel, setRailPanel] = useState<HTMLElement | null>(null);
  return (
    <div style={{ zoom: useHudScale() }}>
      <header aria-label="Game controls" className="frontier-crown pointer-events-auto">
        {placeSwitch}
        {clock}
        {quest}
      </header>
      <aside
        {...HUD_COLUMN_MARK}
        aria-label={REALM}
        className="frontier-corner frontier-corner--left pointer-events-none"
      >
        {realm}
        {armies}
      </aside>
      <FrontierRail
        onPanel={setRailPanel}
        places={places}
        banner={banner}
        page={page}
        wide={widePage && Boolean(page)}
      />
      <HudFoot>
        <div className="pointer-events-none flex flex-col items-center gap-3">{foot}</div>
      </HudFoot>
      <FollowingArmyPill />
      <SheetDock.Provider value={railPanel}>{children}</SheetDock.Provider>
    </div>
  );
};

const FrontierRail = ({
  onPanel,
  places,
  banner,
  page,
  wide,
}: {
  onPanel: (panel: HTMLElement | null) => void;
  places: ReactNode;
  banner?: ReactNode;
  page?: ReactNode;
  wide: boolean;
}) => (
  <aside
    {...HUD_COLUMN_MARK}
    aria-label="Guided rail"
    data-hud-rail
    data-frontier-rail
    data-wide={wide || undefined}
    className="frontier-corner frontier-corner--right pointer-events-none"
  >
    {places}
    {banner && <div className="pointer-events-none flex shrink-0 justify-center empty:hidden">{banner}</div>}
    <div aria-label="Notices" className="ui ui-panel pointer-events-auto shrink-0 px-3 py-2 empty:hidden">
      <FeedToasts />
    </div>
    <div ref={onPanel} data-rail-panel className="flex min-h-0 flex-1 flex-col gap-2 empty:hidden" />
    {page && (
      <div
        data-right-page
        data-wide-page={wide ? "" : undefined}
        className={
          wide
            ? "pointer-events-none flex min-h-0 flex-1 flex-col [&>[data-kit-frame]]:pointer-events-auto [&>[data-kit-frame]]:max-h-full [&>[data-kit-frame]]:w-full [&>[data-kit-frame]]:flex-1"
            : "pointer-events-none flex min-h-0 flex-1 flex-col gap-2 [&>[data-kit-frame]]:pointer-events-auto"
        }
      >
        {page}
      </div>
    )}
  </aside>
);

export const FrontierPlaces = ({
  surface,
  onSurface,
  research,
  chatUnread = 0,
  lead,
}: {
  surface: HudSurface | null;
  onSurface: (surface: HudSurface | null) => void;
  research?: boolean;
  chatUnread?: number;
  lead?: ReactNode;
}) => {
  const unread = useUnreadImportantCount(surface === "feed");
  const researchOpen = usePartShown("research");
  const aspectsOpen = usePartShown("aspects");
  const tabs = resolveHudPlaces({
    aspectsOpen,
    researchOpen,
    researchReady: research,
    feedUnread: unread,
    chatUnread,
    chatOpen: surface === "chat",
  });
  const toggle = (key: HudSurface) => onSurface(surface === key ? null : key);
  return (
    <div className="frontier-commands pointer-events-auto">
      {lead}
      <nav aria-label="Places" role="tablist" className="frontier-places">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={surface === tab.key}
            aria-label={tab.ariaLabel}
            className="ui-pick frontier-place"
            onClick={() => toggle(tab.key)}
          >
            <Icon name={tab.icon} size={16} />
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className="frontier-place__badge"
                data-tone={tab.countTone}
                data-shape={tab.countTone === "good" ? "diamond" : undefined}
                aria-label={tab.countLabel}
              >
                <span className="frontier-place__badge-value">{tab.count}</span>
              </span>
            )}
          </button>
        ))}
      </nav>
      <button
        type="button"
        aria-label={SETTINGS}
        aria-pressed={surface === "settings"}
        className="ui-pick frontier-place frontier-place--icon"
        onClick={() => toggle("settings")}
      >
        <Icon name="settings" size={18} />
      </button>
    </div>
  );
};
