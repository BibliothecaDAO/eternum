import "./phone-hud.css";

import type { ReactNode } from "react";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";

import { feedPlaceDot, useHudPlaces } from "./hud-places";

export type HudSurface =
  | "realm"
  | "research"
  | "feed"
  | "chat"
  | "menu"
  | "today"
  | "settings"
  | "season"
  | "army"
  | "army-lost"
  | "shop";

type PlacesState = {
  surface: HudSurface | null;
  onSurface: (surface: HudSurface | null) => void;
  researchReady?: boolean;
  feedUnread: number;
  chatUnread: number;
  placeTabs?: ReactNode;
};

const MENU_SURFACES: readonly HudSurface[] = ["menu", "feed", "today", "settings", "shop"];

const isMenuSurface = (surface: HudSurface | null): boolean => surface !== null && MENU_SURFACES.includes(surface);

export const phoneMenuProps = ({
  surface,
  onSurface,
  feedUnread,
}: Pick<PlacesState, "surface" | "onSurface" | "feedUnread">) => ({
  open: isMenuSurface(surface),
  dot: feedPlaceDot(feedUnread),
  onOpen: () => onSurface(surface === "menu" ? null : "menu"),
});

const usePlaces = ({ surface, researchReady, feedUnread, chatUnread }: PlacesState) =>
  useHudPlaces({
    researchReady,
    feedUnread,
    chatUnread,
    chatOpen: surface === "chat",
  });

export const PhoneTabBar = (state: PlacesState) => {
  const { surface, onSurface, placeTabs } = state;
  const places = usePlaces(state);
  const tabs = places.filter((place) => place.key !== "feed");
  const toggle = (target: HudSurface) => onSurface(surface === target ? null : target);
  return (
    <nav aria-label="Places" className="ui-popover frontier-tab-bar pointer-events-auto">
      {placeTabs}
      {tabs.map((place) => (
        <PlaceTab
          key={place.key}
          {...placeTab(place)}
          current={surface === place.key}
          onPress={() => toggle(place.key)}
        />
      ))}
    </nav>
  );
};

type PlaceTabProps = {
  label: string;
  ariaLabel?: string;
  icon: IconMeaning;
  count?: number;
  countTone?: "good";
  countLabel?: string;
  current: boolean;
  onPress: () => void;
};

const PlaceTab = ({
  label,
  ariaLabel = label,
  icon,
  count,
  countTone,
  countLabel,
  current,
  onPress,
}: PlaceTabProps) => (
  <button
    type="button"
    aria-label={ariaLabel}
    aria-current={current ? "page" : undefined}
    className="frontier-tab"
    onClick={onPress}
  >
    <span className="frontier-tab__icon">
      <Icon name={icon} size={24} loading="eager" decoding="sync" />
      {count !== undefined && (
        <span className="frontier-tab__badge" data-tone={countTone} aria-label={countLabel}>
          {count}
        </span>
      )}
    </span>
    <span className="frontier-tab__label">{label}</span>
  </button>
);

const placeTab = (place: ReturnType<typeof usePlaces>[number]) => ({
  label: place.label,
  ariaLabel: place.ariaLabel,
  icon: place.icon,
  count: place.count,
  countTone: place.countTone,
  countLabel: place.countLabel,
});
