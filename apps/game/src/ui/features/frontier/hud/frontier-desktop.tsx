import "./frontier-bar.css";

import { usePartShown } from "../opening/opening-context";
import { HUD_COLUMN_MARK } from "@/three/utils/labels/hud-clearance";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { SheetDock } from "@/ui/design-system/kit/hud-elements";
import { CHAT, EVENTS_WORDS, REALM, RELIC_WORDS, RESEARCH, SEASON } from "@/ui/design-system/kit/words";
import { FeedToasts, useUnreadImportantCount } from "@/ui/features/event-feed/quick-feed";
import type { SeasonGoal } from "@/ui/features/world/containers/top-header/identity-chip";
import { TopHeader } from "@/ui/features/world/containers/top-header/top-header";
import { HudFoot } from "@/ui/features/world/hud/desktop-hud";
import { type ReactNode, useState } from "react";

import type { HudSurface } from "./frontier-nav";
import { useHudScale } from "./hud-scale";

export const FrontierDesktop = ({
  identity,
  season,
  clock,
  quest,
  stores,
  depthSwitch,
  realm,
  replaceRealmWithSheet = false,
  armies,
  aspectChip,
  page,
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
  realm?: ReactNode;
  replaceRealmWithSheet?: boolean;
  armies?: ReactNode;
  aspectChip?: ReactNode;
  page?: ReactNode;
  foot?: ReactNode;
  places: ReactNode;
  children?: ReactNode;
}) => {
  const [railPanel, setRailPanel] = useState<HTMLElement | null>(null);
  const [leftPanel, setLeftPanel] = useState<HTMLElement | null>(null);
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
      <aside
        {...HUD_COLUMN_MARK}
        aria-label={REALM}
        className="pointer-events-none fixed bottom-hud-base left-4 top-hud-frontier-page-top z-hud-column flex w-hud-column flex-col gap-2"
      >
        {!replaceRealmWithSheet && realm}
        <div ref={setLeftPanel} data-realm-slot className="flex min-h-0 flex-1 flex-col gap-2 empty:hidden" />
      </aside>
      {armies && <div className="pointer-events-none fixed bottom-4 left-4 z-hud-column">{armies}</div>}
      {aspectChip && <div className="pointer-events-none fixed bottom-4 right-4 z-hud-column">{aspectChip}</div>}
      <FrontierRail page={page} onPanel={setRailPanel} />
      <HudFoot>
        <div className="pointer-events-none flex flex-col items-center gap-3">{foot}</div>
      </HudFoot>
      <SheetDock.Provider value={replaceRealmWithSheet ? leftPanel : railPanel}>{children}</SheetDock.Provider>
    </div>
  );
};

const FrontierRail = ({ page, onPanel }: { page?: ReactNode; onPanel: (panel: HTMLElement | null) => void }) => (
  <aside
    {...HUD_COLUMN_MARK}
    aria-label="Guided rail"
    data-hud-rail
    data-frontier-rail
    className="pointer-events-none fixed bottom-hud-base right-4 top-hud-frontier-page-top z-hud-rail flex flex-col gap-2"
  >
    <div aria-label="Notices" className="ui ui-panel pointer-events-auto shrink-0 px-3 py-2 empty:hidden">
      <FeedToasts />
    </div>
    <div ref={onPanel} data-rail-panel className="flex min-h-0 flex-1 flex-col gap-2 empty:hidden">
      {page}
    </div>
  </aside>
);

type PlaceTab = {
  key: HudSurface;
  label: string;
  icon: IconMeaning;
  ariaLabel: string;
  count?: number;
  countLabel?: string;
  countTone?: "good";
};

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
  const tabs: PlaceTab[] = [
    ...(aspectsOpen ? [{ key: "season" as const, label: SEASON, icon: "victory" as const, ariaLabel: SEASON }] : []),
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
      key: "feed",
      label: EVENTS_WORDS.feed,
      icon: "chronicles",
      ariaLabel: EVENTS_WORDS.feed,
      count: unread > 0 ? unread : undefined,
    },
    {
      key: "chat",
      label: CHAT,
      icon: "chat",
      ariaLabel: CHAT,
      count: surface !== "chat" && chatUnread > 0 ? chatUnread : undefined,
      countLabel: chatUnread > 0 ? `Unread chat messages: ${chatUnread}` : undefined,
    },
    ...(hasRealm
      ? [
          {
            key: "relics" as const,
            label: RELIC_WORDS.title,
            icon: "relics" as const,
            ariaLabel: RELIC_WORDS.title,
            count: relics > 0 ? relics : undefined,
          },
        ]
      : []),
  ];
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
