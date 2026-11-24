import "./phone-hud.css";

import { useTablet } from "@/shell/frame/layout";

import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { HudPage, HudRow } from "@/ui/design-system/kit/hud-elements";
import { EXIT, MENU, MENU_LINES, SETTINGS, SHOP_WORDS, TODAY, unreadFeedEvents } from "@/ui/design-system/kit/words";
import { HowToPlayRow } from "@/ui/modules/how-to-play";
import { formatAmount } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { HUD_PLACES } from "./hud-places";

const FEED = HUD_PLACES.find((place) => place.key === "feed")!;

export const MenuPage = ({
  onFeed,
  onShop,
  onToday,
  onSettings,
  events = 0,
  guide,
  onExit,
  onClose,
}: {
  onFeed: () => void;
  onShop?: () => void;
  onToday: () => void;
  onSettings: () => void;
  events?: number;
  guide: string;
  onExit: () => void;
  onClose: () => void;
}) => {
  const tablet = useTablet();
  return (
    <HudPage label={MENU} icon="menu" onClose={onClose}>
      <nav className="menu-nav">
        {!tablet && (
          <MenuRow
            icon={FEED.icon}
            label={FEED.label}
            detail={MENU_LINES.feed}
            badge={
              events > 0 ? (
                <span className="text-hud-body tabular-nums" aria-label={unreadFeedEvents(events)}>
                  {formatAmount(events)}
                </span>
              ) : undefined
            }
            onClick={onFeed}
          />
        )}
        <MenuRow icon="clock" label={TODAY} detail={MENU_LINES.today} onClick={onToday} />
        {onShop && <MenuRow icon="fragment" label={SHOP_WORDS.title} detail={MENU_LINES.shop} onClick={onShop} />}
        <MenuRow icon="settings" label={SETTINGS} detail={MENU_LINES.settings} onClick={onSettings} />
        <HowToPlayRow guide={guide} />
        <MenuRow icon="exit" label={EXIT} detail={MENU_LINES.exit} onClick={onExit} />
      </nav>
    </HudPage>
  );
};

const MenuRow = ({
  icon,
  label,
  detail,
  badge,
  onClick,
}: {
  icon: IconMeaning;
  label: string;
  detail: string;
  badge?: ReactNode;
  onClick: () => void;
}) => (
  <HudRow
    lead={<SemanticIcon name={icon} size={22} />}
    label={label}
    title={label}
    detail={detail}
    trail={badge}
    onClick={onClick}
  />
);
