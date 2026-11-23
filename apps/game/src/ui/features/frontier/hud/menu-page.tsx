import "./phone-hud.css";

import { usePartShown } from "../opening/opening-context";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudPage, HudRow } from "@/ui/design-system/kit/hud-elements";
import { EXIT, MENU, SETTINGS, SHOP_WORDS, TODAY } from "@/ui/design-system/kit/words";
import { HowToPlayRow } from "@/ui/modules/how-to-play";
import { formatAmount } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { resolveHudPlaces, resolveMenuPlaces, type HudPlaceKey } from "./hud-places";

export const MenuPage = ({
  rank,
  onResearch,
  onFeed,
  onChat,
  onRelics,
  onShop,
  onToday,
  onSeason,
  onSettings,
  researchReady,
  events = 0,
  chatUnread = 0,
  fragments,
  guide,
  onExit,
  onClose,
}: {
  rank: string | null;
  onResearch?: () => void;
  onFeed?: () => void;
  onChat?: () => void;
  onRelics?: () => void;
  onShop?: () => void;
  onToday: () => void;
  onSeason: () => void;
  onSettings: () => void;
  researchReady?: boolean;
  events?: number;
  chatUnread?: number;
  fragments?: number | null;
  guide: string;
  onExit: () => void;
  onClose: () => void;
}) => {
  const aspectsOpen = usePartShown("aspects");
  const researchOpen = usePartShown("research");
  const relicsOpen = usePartShown("relic-slots");
  const placesState = {
    aspectsOpen,
    researchOpen,
    relicsOpen,
    researchReady: onResearch ? Boolean(researchReady) : undefined,
    feedUnread: events,
    chatUnread,
    hasRealm: Boolean(onRelics),
  };
  const seasonPlace = resolveHudPlaces(placesState).find((place) => place.key === "season");
  const places = resolveMenuPlaces(placesState);
  const handlers: Record<Exclude<HudPlaceKey, "season">, (() => void) | undefined> = {
    research: onResearch,
    feed: onFeed,
    chat: onChat,
    relics: onRelics,
  };
  const tiles = places.flatMap((place) => {
    const onClick = place.key === "season" ? undefined : handlers[place.key];
    return onClick ? [{ place, onClick }] : [];
  });
  return (
    <HudPage label={MENU} icon="menu" onClose={onClose}>
      {tiles.length > 0 && (
        <div className="menu-place-tiles">
          {tiles.map(({ place, onClick }) => (
            <button
              key={place.key}
              type="button"
              className="ui-pick menu-place-tile"
              aria-label={place.ariaLabel}
              onClick={onClick}
            >
              <SemanticIcon name={place.icon} size={28} />
              <span className="menu-place-tile__label">{place.label}</span>
              {place.count !== undefined && (
                <span
                  className={place.countTone === "good" ? "menu-place-tile__dot" : "menu-place-tile__badge"}
                  aria-label={place.countLabel}
                >
                  {place.countTone === "good" ? null : formatAmount(place.count)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <nav className="flex flex-col">
        {onShop && fragments !== null && fragments !== undefined && (
          <MenuRow
            icon="fragment"
            label={SHOP_WORDS.title}
            badge={<span className="text-hud-body tabular-nums">{formatAmount(fragments)}</span>}
            onClick={onShop}
          />
        )}
        <MenuRow icon="clock" label={TODAY} onClick={onToday} />
        {seasonPlace && (
          <MenuRow
            icon={seasonPlace.icon}
            label={seasonPlace.label}
            badge={<span className="text-hud-body tabular-nums">{rank ?? "—"}</span>}
            onClick={onSeason}
          />
        )}
        <MenuRow icon="settings" label={SETTINGS} onClick={onSettings} />
        <HowToPlayRow guide={guide} />
      </nav>
      <div className="grid">
        <HudButton kind="secondary" icon="exit" onClick={onExit}>
          {EXIT}
        </HudButton>
      </div>
    </HudPage>
  );
};

const MenuRow = ({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: IconMeaning;
  label: string;
  badge?: ReactNode;
  onClick: () => void;
}) => (
  <HudRow lead={<SemanticIcon name={icon} size={22} />} label={label} title={label} trail={badge} onClick={onClick} />
);
