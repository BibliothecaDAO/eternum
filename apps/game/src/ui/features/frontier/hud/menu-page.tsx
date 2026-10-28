import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudPanel, HudRow } from "@/ui/design-system/kit/hud-elements";
import { EXIT, MENU, REALM_LABOR, RESUME, SEASON, SETTINGS, TODAY } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

const MENU_WORDS = {
  clock: TODAY,
  victory: SEASON,
  realm: REALM_LABOR,
  settings: SETTINGS,
} as const;

/**
 * The Menu, a page on the place bar as Research, the Log and Chat are: its title and no close of its own, since the
 * place bar's Menu closes it as theirs do (player, 25 October: the one window with an X and a tall header). The ways
 * that are not places (Today, Season with the player's rank, Settings), then Exit to the app and Resume, which closes
 * it. Realms, with a dot while their labor waits, opens the Realm holder's labor where its facts are served.
 */
export const MenuPage = ({
  rank,
  onToday,
  onSeason,
  realms,
  onSettings,
  onExit,
  onClose,
}: {
  rank: string;
  onToday: () => void;
  onSeason: () => void;
  realms?: { waiting: boolean; onOpen: () => void };
  onSettings: () => void;
  onExit: () => void;
  onClose: () => void;
}) => (
  <HudPanel label={MENU} title={MENU} icon="menu" collapsible={false} bodyClassName="flex flex-col gap-2">
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
  </HudPanel>
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
