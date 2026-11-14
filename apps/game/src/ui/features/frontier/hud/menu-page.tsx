import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudPage, HudRow } from "@/ui/design-system/kit/hud-elements";
import { EXIT, MENU, REALM_LABOR, SEASON, SETTINGS, TODAY } from "@/ui/design-system/kit/words";
import { HowToPlayRow } from "@/ui/modules/how-to-play";
import type { ReactNode } from "react";

const MENU_WORDS = {
  clock: TODAY,
  victory: SEASON,
  realm: REALM_LABOR,
  settings: SETTINGS,
} as const;

/**
 * The Menu, a page on the place bar as Research, the Feed and Chat are, in their one frame: its × closes it, as the
 * place bar's Menu does (owner, 30 October: "Ok to cut resume"). The ways that are not places (Today, Season with the
 * player's rank, Settings), How to play (the game's guide on the docs site, in a new tab), then Exit to the app. Realms,
 * with a dot while their labor waits, opens the Realm holder's labor where its facts are served.
 */
export const MenuPage = ({
  rank,
  onToday,
  onSeason,
  realms,
  onSettings,
  guide,
  onExit,
  onClose,
}: {
  rank: string;
  onToday: () => void;
  onSeason: () => void;
  realms?: { waiting: boolean; onOpen: () => void };
  onSettings: () => void;
  /** The game's guide on the docs site (useHowToPlay). */
  guide: string;
  onExit: () => void;
  onClose: () => void;
}) => (
  <HudPage label={MENU} icon="menu" onClose={onClose}>
    <nav className="flex flex-col">
      <MenuRow icon="clock" onClick={onToday} />
      <MenuRow icon="victory" badge={<span className="text-hud-body tabular-nums">{rank}</span>} onClick={onSeason} />
      {realms && (
        <MenuRow
          icon="realm"
          badge={realms.waiting && <i aria-hidden className="size-2 rounded-full bg-hud-gold" />}
          onClick={realms.onOpen}
        />
      )}
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
