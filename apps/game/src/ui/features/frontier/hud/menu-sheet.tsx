import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { Button } from "@/ui/design-system/kit/button";

import { Sheet } from "@/ui/design-system/kit/sheet";
import { EXIT, GUIDE, MENU, PRODUCTION, REALMS, RESUME, SEASON, SETTINGS, TODAY } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/**
 * The Menu: the ways that are not places (Today, Season with the player's rank, Production, the guide, Settings), then
 * Exit to the app and Resume, which closes the menu. Guide opens every line the guide has said so far, with its
 * switch; a player with no realm of their own has no guide and no Production. Realms, with a dot while their labor
 * waits, opens the Realm holder's labor where its facts are served.
 */
export const MenuSheet = ({
  rank,
  onToday,
  onSeason,
  onProduction,
  realms,
  guide,
  onSettings,
  onExit,
  onClose,
}: {
  rank: string;
  onToday: () => void;
  onSeason: () => void;
  onProduction: (() => void) | null;
  realms?: { waiting: boolean; onOpen: () => void };
  /** The guide's lines, with a tick while it is on; absent for a player it does not speak to. */
  guide: { on: boolean; onOpen: () => void } | null;
  onSettings: () => void;
  onExit: () => void;
  onClose: () => void;
}) => (
  <Sheet label={MENU} onClose={onClose}>
    <h2 className="frontier-title !text-hud-display">{MENU}</h2>
    <nav className="flex flex-col">
      <MenuRow icon="clock" word={TODAY} onClick={onToday} />
      <MenuRow
        icon="victory"
        word={SEASON}
        badge={<span className="text-hud-body tabular-nums">{rank}</span>}
        onClick={onSeason}
      />
      {onProduction && <MenuRow icon="wheat" word={PRODUCTION} onClick={onProduction} />}
      {realms && (
        <MenuRow
          icon="realm"
          word={REALMS}
          badge={realms.waiting && <i aria-hidden className="size-2 rounded-full bg-hud-gold" />}
          onClick={realms.onOpen}
        />
      )}
      {guide && (
        <MenuRow
          icon="order-skill"
          word={GUIDE}
          badge={guide.on && <SemanticIcon name="check" size={20} />}
          onClick={guide.onOpen}
        />
      )}
      <MenuRow icon="menu" word={SETTINGS} onClick={onSettings} />
    </nav>
    <div className="flex gap-2">
      <Button role="secondary" icon="exit" word={EXIT} onClick={onExit} className="w-32" />
      <Button role="primary" word={RESUME} onClick={onClose} className="flex-1" />
    </div>
  </Sheet>
);

const MenuRow = ({
  icon,
  word,
  badge,
  onClick,
}: {
  icon: IconMeaning;
  word: string;
  badge?: ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-12 items-center gap-2 border-b border-hud-line px-1 text-left text-hud-body text-hud-ink"
  >
    <SemanticIcon name={icon} size={22} />
    <span className="flex-1 text-hud-strong">{word}</span>
    {badge}
    <SemanticIcon name="chevron-right" size={20} />
  </button>
);
