import "./frontier-bar.css";
import "./frontier-desktop.css";

import { HUD_COLUMN_MARK } from "@/three/utils/labels/hud-clearance";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { SheetDock } from "@/ui/design-system/kit/hud-elements";
import { REALM, SETTINGS } from "@/ui/design-system/kit/words";
import { FeedToasts, useUnreadImportantCount } from "@/ui/features/event-feed/quick-feed";
import { FollowingArmyPill } from "@/ui/features/world/containers/top-header/following-army-pill";
import { HudFoot } from "@/ui/features/world/hud/desktop-hud";
import { HudMinimap } from "@/ui/features/world/hud/minimap";
import { type ReactNode, useState } from "react";

import type { HudSurface } from "./frontier-nav";
import { useHudPlaces } from "./hud-places";
import { HudPopoverRoot } from "./hud-popover";
import { useHudScale } from "./hud-scale";

export const FrontierDesktop = ({
  placeSwitch,
  clock,
  quest,
  realm,
  armies,
  page,
  widePage = false,
  foot,
  places,
  chat,
  children,
}: {
  placeSwitch: ReactNode;
  clock: ReactNode;
  quest?: ReactNode;
  realm?: ReactNode;
  armies?: ReactNode;
  page?: ReactNode;
  widePage?: boolean;
  foot?: ReactNode;
  places: ReactNode;
  chat?: ReactNode;
  children?: ReactNode;
}) => {
  const [railPanel, setRailPanel] = useState<HTMLElement | null>(null);
  const [popoverNode, setPopoverNode] = useState<HTMLElement | null>(null);
  const scale = useHudScale();
  return (
    <HudPopoverRoot.Provider value={{ node: popoverNode, scale }}>
      <div style={{ zoom: scale }}>
        <header aria-label="Game controls" className="frontier-crown pointer-events-none">
          {placeSwitch}
          {clock}
          {quest}
        </header>
        <div
          aria-label="Notices"
          role="status"
          className="ui ui-panel frontier-notices pointer-events-auto empty:hidden"
        >
          <FeedToasts />
        </div>
        <aside
          {...HUD_COLUMN_MARK}
          aria-label={REALM}
          className="frontier-corner frontier-corner--left pointer-events-none"
        >
          {realm}
          {armies}
          <HudMinimap className="frontier-minimap" />
        </aside>
        <FrontierRail onPanel={setRailPanel} places={places} page={page} wide={widePage && Boolean(page)} />
        <HudFoot>
          <div className="pointer-events-none flex flex-col items-center gap-3">{foot}</div>
        </HudFoot>
        <FollowingArmyPill />
        {chat && <div className="frontier-chat-dock pointer-events-none">{chat}</div>}
        <SheetDock.Provider value={railPanel}>{children}</SheetDock.Provider>
        <div ref={setPopoverNode} className="frontier-popover-room" />
      </div>
    </HudPopoverRoot.Provider>
  );
};

const FrontierRail = ({
  onPanel,
  places,
  page,
  wide,
}: {
  onPanel: (panel: HTMLElement | null) => void;
  places: ReactNode;
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
    <div ref={onPanel} data-rail-panel className="flex min-h-0 flex-1 flex-col gap-2 empty:hidden" />
    {page && (
      <div
        data-right-page
        data-wide-page={wide ? "" : undefined}
        className={
          wide
            ? "pointer-events-none flex min-h-0 flex-col [&>[data-kit-frame]]:pointer-events-auto [&>[data-kit-frame]]:max-h-full [&>[data-kit-frame]]:w-full"
            : "pointer-events-none flex min-h-0 flex-col gap-2 [&>[data-kit-frame]]:pointer-events-auto [&>[data-kit-frame]]:max-h-full"
        }
      >
        {page}
      </div>
    )}
  </aside>
);

const DESKTOP_PLACE_ORDER = ["research", "feed", "season", "settings"] as const satisfies readonly HudSurface[];

const SETTINGS_PLACE = { key: "settings", label: SETTINGS, ariaLabel: SETTINGS, icon: "settings" } as const;

export const FrontierPlaces = ({
  surface,
  onSurface,
  research,
  lead,
}: {
  surface: HudSurface | null;
  onSurface: (surface: HudSurface | null) => void;
  research?: boolean;
  lead?: ReactNode;
}) => {
  const unread = useUnreadImportantCount(surface === "feed");
  const places = new Map<HudSurface, PlaceTab>(
    useHudPlaces({ researchReady: research, feedUnread: unread, chatUnread: 0 }).map((place) => [place.key, place]),
  );
  places.set("settings", SETTINGS_PLACE);
  const tabs = DESKTOP_PLACE_ORDER.flatMap((key) => places.get(key) ?? []);
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
    </div>
  );
};

type PlaceTab = {
  key: HudSurface;
  label: string;
  ariaLabel: string;
  icon: IconMeaning;
  count?: number;
  countLabel?: string;
  countTone?: "good";
};
