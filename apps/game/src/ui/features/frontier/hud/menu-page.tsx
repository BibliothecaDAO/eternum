import "./phone-hud.css";

import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudPage, HudRow } from "@/ui/design-system/kit/hud-elements";
import { EXIT, MENU, SETTINGS, SHOP_WORDS, TODAY, unreadFeedEvents } from "@/ui/design-system/kit/words";
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
  onFeed?: () => void;
  onShop?: () => void;
  onToday: () => void;
  onSettings: () => void;
  events?: number;
  guide: string;
  onExit: () => void;
  onClose: () => void;
}) => (
  <HudPage label={MENU} icon="menu" onClose={onClose}>
    <nav className="menu-nav">
      {onFeed && (
        <MenuRow
          icon={FEED.icon}
          label={FEED.label}
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
      <MenuRow icon="clock" label={TODAY} onClick={onToday} />
      {onShop && <MenuRow icon="fragment" label={SHOP_WORDS.title} onClick={onShop} />}
      <MenuRow icon="settings" label={SETTINGS} onClick={onSettings} />
      <div className="menu-nav__wide">
        <HowToPlayRow guide={guide} />
      </div>
    </nav>
    <div className="grid">
      <HudButton kind="secondary" icon="exit" onClick={onExit}>
        {EXIT}
      </HudButton>
    </div>
  </HudPage>
);

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
