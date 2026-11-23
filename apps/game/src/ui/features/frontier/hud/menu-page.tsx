import { OpeningPartGate } from "../opening/opening-context";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudPage, HudRow } from "@/ui/design-system/kit/hud-elements";
import {
  CHAT,
  EVENTS_WORDS,
  EXIT,
  MENU,
  RELIC_WORDS,
  RESEARCH,
  SEASON,
  SETTINGS,
  SHOP_WORDS,
  TODAY,
} from "@/ui/design-system/kit/words";
import { HowToPlayRow } from "@/ui/modules/how-to-play";
import { formatAmount } from "@bibliothecadao/types";
import type { ReactNode } from "react";

const MENU_WORDS = {
  research: RESEARCH,
  chronicles: EVENTS_WORDS.feed,
  chat: CHAT,
  relics: RELIC_WORDS.title,
  fragment: SHOP_WORDS.title,
  clock: TODAY,
  victory: SEASON,
  settings: SETTINGS,
} as const;

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
}) => (
  <HudPage label={MENU} icon="menu" onClose={onClose}>
    <nav className="flex flex-col">
      {onResearch && (
        <OpeningPartGate part="research">
          <MenuRow
            icon="research"
            badge={researchReady ? <span className="size-2 rounded-full bg-hud-gold" /> : undefined}
            onClick={onResearch}
          />
        </OpeningPartGate>
      )}
      {onFeed && (
        <MenuRow
          icon="chronicles"
          badge={events > 0 ? <span className="text-hud-body tabular-nums">{formatAmount(events)}</span> : undefined}
          onClick={onFeed}
        />
      )}
      {onChat && (
        <MenuRow
          icon="chat"
          badge={
            chatUnread > 0 ? <span className="text-hud-body tabular-nums">{formatAmount(chatUnread)}</span> : undefined
          }
          onClick={onChat}
        />
      )}
      {onRelics && <MenuRow icon="relics" onClick={onRelics} />}
      {onShop && fragments !== null && fragments !== undefined && (
        <MenuRow
          icon="fragment"
          badge={<span className="text-hud-body tabular-nums">{formatAmount(fragments)}</span>}
          onClick={onShop}
        />
      )}
      <MenuRow icon="clock" onClick={onToday} />
      <OpeningPartGate part="aspects">
        <MenuRow
          icon="victory"
          badge={<span className="text-hud-body tabular-nums">{rank ?? "—"}</span>}
          onClick={onSeason}
        />
      </OpeningPartGate>
      <MenuRow icon="settings" onClick={onSettings} />
      <HowToPlayRow guide={guide} />
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
  badge,
  onClick,
}: {
  icon: keyof typeof MENU_WORDS;
  badge?: ReactNode;
  onClick: () => void;
}) => (
  <HudRow
    lead={<SemanticIcon name={icon} size={22} />}
    label={MENU_WORDS[icon]}
    title={MENU_WORDS[icon]}
    trail={badge}
    onClick={onClick}
  />
);
