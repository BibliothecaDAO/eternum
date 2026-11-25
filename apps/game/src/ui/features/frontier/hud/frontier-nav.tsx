import "./phone-hud.css";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { MENU } from "@/ui/design-system/kit/words";

import { useHudPlaces } from "./hud-places";

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
};

const MENU_SURFACES: readonly HudSurface[] = ["menu", "feed", "today", "settings", "shop"];

const usePlaces = ({ surface, researchReady, feedUnread, chatUnread }: PlacesState) =>
  useHudPlaces({
    researchReady,
    feedUnread,
    chatUnread,
    chatOpen: surface === "chat",
  });

export const PhoneTabBar = (state: PlacesState) => {
  const { surface, onSurface } = state;
  const places = usePlaces(state);
  const feed = places.find((place) => place.key === "feed");
  const tabs = places.filter((place) => place.key !== "feed");
  const onMenu = surface !== null && MENU_SURFACES.includes(surface);
  const toggle = (target: HudSurface) => onSurface(surface === target ? null : target);
  return (
    <nav aria-label="Places" className="ui-popover frontier-tab-bar pointer-events-auto">
      {tabs.map((place) => (
        <PlaceTab
          key={place.key}
          {...placeTab(place)}
          current={surface === place.key}
          onPress={() => toggle(place.key)}
        />
      ))}
      <PlaceTab
        label={MENU}
        icon="menu"
        current={onMenu}
        dot={feed?.count ? feed.countLabel : undefined}
        onPress={() => toggle("menu")}
      />
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
  dot?: string;
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
  dot,
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
      <Icon name={icon} size={26} loading="eager" decoding="sync" />
      {count !== undefined && (
        <span className="frontier-tab__badge" data-tone={countTone} aria-label={countLabel}>
          {count}
        </span>
      )}
      {dot && <span className="frontier-tab__dot" data-dot="" aria-label={dot} />}
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
