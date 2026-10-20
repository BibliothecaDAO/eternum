import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudRow, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { EXIT, MENU, PRODUCTION, REALMS, RESUME, SEASON, SETTINGS, TODAY } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

const MENU_WORDS = {
  clock: TODAY,
  victory: SEASON,
  production: PRODUCTION,
  realm: REALMS,
  settings: SETTINGS,
} as const;

/**
 * The Menu: the ways that are not places (Today, Season with the player's rank, Production, Settings), then Exit to the
 * app and Resume, which closes the menu; a player with no realm of their own has no Production. Realms, with a dot
 * while their labor waits, opens the Realm holder's labor where its facts are served.
 */
export const MenuSheet = ({
  rank,
  onToday,
  onSeason,
  onProduction,
  realms,
  onSettings,
  onExit,
  onClose,
}: {
  rank: string;
  onToday: () => void;
  onSeason: () => void;
  onProduction: (() => void) | null;
  realms?: { waiting: boolean; onOpen: () => void };
  onSettings: () => void;
  onExit: () => void;
  onClose: () => void;
}) => (
  <HudSheet label={MENU} onClose={onClose}>
    <nav className="flex flex-col">
      <MenuRow icon="clock" onClick={onToday} />
      <MenuRow icon="victory" badge={<span className="text-hud-body tabular-nums">{rank}</span>} onClick={onSeason} />
      {onProduction && <MenuRow icon="production" onClick={onProduction} />}
      {realms && (
        <MenuRow
          icon="realm"
          badge={realms.waiting && <i aria-hidden className="size-2 rounded-full bg-hud-gold" />}
          onClick={realms.onOpen}
        />
      )}
      <MenuRow icon="settings" onClick={onSettings} />
    </nav>
    <div className="grid grid-cols-3 gap-2">
      <HudButton kind="secondary" icon="exit" onClick={onExit}>
        {EXIT}
      </HudButton>
      <span className="col-span-2 grid">
        <HudButton kind="primary" onClick={onClose}>
          {RESUME}
        </HudButton>
      </span>
    </div>
  </HudSheet>
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
    title={MENU_WORDS[icon]}
    trail={
      <>
        {badge}
        <SemanticIcon name="chevron-right" size={20} />
      </>
    }
    onClick={onClick}
  />
);
