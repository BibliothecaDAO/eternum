import "./phone-hud.css";

import { useTablet } from "@/shell/frame/layout";

import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { HudPage } from "@/ui/design-system/kit/hud-elements";
import { EXIT, MENU, SETTINGS, SHOP_WORDS, TODAY, unreadFeedEvents } from "@/ui/design-system/kit/words";
import { HowToPlayTile } from "@/ui/modules/how-to-play";
import { formatAmount } from "@bibliothecadao/types";

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
      <nav className="menu-tiles">
        {!tablet && (
          <MenuTile
            icon={FEED.icon}
            label={FEED.label}
            badge={events > 0 ? { count: formatAmount(events), label: unreadFeedEvents(events) } : undefined}
            onClick={onFeed}
          />
        )}
        <MenuTile icon="calendar" label={TODAY} onClick={onToday} />
        {onShop && <MenuTile icon="fragment" label={SHOP_WORDS.title} onClick={onShop} />}
        <MenuTile icon="settings" label={SETTINGS} onClick={onSettings} />
        <HowToPlayTile guide={guide} className="menu-tile" />
        <MenuTile icon="exit" label={EXIT} onClick={onExit} />
      </nav>
    </HudPage>
  );
};

const MenuTile = ({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: IconMeaning;
  label: string;
  badge?: { count: string; label: string };
  onClick: () => void;
}) => (
  <button type="button" className="menu-tile" aria-label={label} onClick={onClick}>
    <SemanticIcon name={icon} size={40} />
    <span className="menu-tile__label">{label}</span>
    {badge && (
      <span className="menu-tile__badge" aria-label={badge.label}>
        {badge.count}
      </span>
    )}
  </button>
);
