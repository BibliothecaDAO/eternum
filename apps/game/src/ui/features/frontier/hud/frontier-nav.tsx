import "./phone-hud.css";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { MENU } from "@/ui/design-system/kit/words";
import type { AspectId } from "@bibliothecadao/types";

import { usePartShown } from "../opening/opening-context";
import { resolveHudPlaces } from "./hud-places";

export type HudSurface =
  | "research"
  | "feed"
  | "chat"
  | "relics"
  | "menu"
  | "today"
  | "settings"
  | "season"
  | "army"
  | "army-lost"
  | "shop";

export const PhoneWorldActions = ({
  aspect,
  surface,
  onSurface,
  researchReady = false,
  events,
  unread,
}: {
  aspect?: AspectId;
  surface: HudSurface | null;
  onSurface: (surface: HudSurface | null) => void;
  researchReady?: boolean;
  events: number;
  unread: number;
}) => {
  const aspectsOpen = usePartShown("aspects");
  const researchOpen = usePartShown("research");
  const relicsOpen = usePartShown("relic-slots");
  const places = resolveHudPlaces({
    aspectsOpen,
    researchOpen,
    relicsOpen,
    researchReady,
    feedUnread: events,
    chatUnread: unread,
  });
  const season = places.find((place) => place.key === "season");
  const menuPlaces = places.filter((place) => place.key !== "season");
  const newPlace =
    menuPlaces.find((place) => place.key === "chat" && place.count && place.count > 0) ??
    menuPlaces.find((place) => place.key === "feed" && place.count && place.count > 0) ??
    menuPlaces.find((place) => place.count && place.count > 0);
  const toggle = (target: "season" | "menu") => onSurface(surface === target ? null : target);

  return (
    <nav aria-label="Places" className="frontier-phone-actions pointer-events-auto">
      {season && (
        <button
          type="button"
          aria-label={season.ariaLabel}
          aria-current={surface === "season" ? "page" : undefined}
          className="frontier-phone-action"
          onClick={() => toggle("season")}
        >
          <Icon name={season.icon} size={24} />
          {aspect && (
            <span className="frontier-phone-action__facet">
              <AspectMark aspect={aspect} size={14} decorative />
            </span>
          )}
        </button>
      )}
      <button
        type="button"
        aria-label={MENU}
        aria-current={surface === "menu" ? "page" : undefined}
        className="frontier-phone-action"
        onClick={() => toggle("menu")}
      >
        <Icon name="menu" size={24} />
        {newPlace && (
          <span
            className="frontier-phone-action__dot"
            data-dot=""
            aria-label={newPlace.countLabel ?? newPlace.ariaLabel}
          />
        )}
      </button>
    </nav>
  );
};
