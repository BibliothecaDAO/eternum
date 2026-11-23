import "./phone-hud.css";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { MENU, SEASON, unreadChatMessages, unreadFeedEvents } from "@/ui/design-system/kit/words";
import type { AspectId } from "@bibliothecadao/types";

import { usePartShown } from "../opening/opening-context";

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
  events,
  unread,
}: {
  aspect?: AspectId;
  surface: HudSurface | null;
  onSurface: (surface: HudSurface | null) => void;
  events: number;
  unread: number;
}) => {
  const aspectsOpen = usePartShown("aspects");
  const toggle = (target: "season" | "menu") => onSurface(surface === target ? null : target);
  const badge = unread > 0 ? unread : events > 0 ? events : undefined;

  return (
    <nav aria-label="Places" className="frontier-phone-actions pointer-events-auto">
      {aspectsOpen && (
        <button
          type="button"
          aria-label={SEASON}
          aria-current={surface === "season" ? "page" : undefined}
          className="frontier-phone-action"
          onClick={() => toggle("season")}
        >
          <Icon name="victory" size={24} />
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
        {badge !== undefined && (
          <span
            className="frontier-phone-action__badge"
            aria-label={unread > 0 ? unreadChatMessages(unread) : unreadFeedEvents(events)}
          >
            {badge}
          </span>
        )}
      </button>
    </nav>
  );
};
