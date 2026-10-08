import { Button } from "@/ui/design-system/kit/button";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { EXIT, GUIDE, MENU, PRODUCTION, RESUME, SEASON, SETTINGS, TODAY } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/**
 * The Menu: the ways that are not places (Today, Season with the player's rank, Production, the guide, Settings), then
 * Exit to the app and Resume, which closes the menu. Guide turns the guide off, or on again from its first line; a
 * player with no realm of their own has no guide and no Production.
 */
export const MenuSheet = ({
  rank,
  onToday,
  onSeason,
  onProduction,
  guide,
  onSettings,
  onExit,
  onClose,
}: {
  rank: string;
  onToday: () => void;
  onSeason: () => void;
  onProduction: (() => void) | null;
  guide: { on: boolean; onToggle: () => void } | null;
  onSettings: () => void;
  onExit: () => void;
  onClose: () => void;
}) => (
  <Sheet label={MENU} onClose={onClose}>
    <h2 className="frontier-title !text-[20px]">{MENU}</h2>
    <nav className="flex flex-col">
      <MenuRow icon="Cl" word={TODAY} onClick={onToday} />
      <MenuRow
        icon="Tp"
        word={SEASON}
        badge={<span className="text-[15px] tabular-nums">{rank}</span>}
        onClick={onSeason}
      />
      {onProduction && <MenuRow icon="Wh" word={PRODUCTION} onClick={onProduction} />}
      {guide && (
        <MenuRow
          icon="Gd"
          word={GUIDE}
          badge={guide.on && <KitIcon code="Ok" size={20} />}
          pressed={guide.on}
          onClick={guide.onToggle}
        />
      )}
      <MenuRow icon="Mn" word={SETTINGS} onClick={onSettings} />
    </nav>
    <div className="flex gap-2">
      <Button role="secondary" icon="Hm" word={EXIT} onClick={onExit} className="w-[130px]" />
      <Button role="primary" word={RESUME} onClick={onClose} className="flex-1" />
    </div>
  </Sheet>
);

const MenuRow = ({
  icon,
  word,
  badge,
  pressed,
  onClick,
}: {
  icon: IconCode;
  word: string;
  badge?: ReactNode;
  /** A row that switches something on and off. */
  pressed?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-pressed={pressed}
    onClick={onClick}
    className="flex h-12 items-center gap-2 border-b border-kit-line px-1 text-left text-[15px] text-kit-cream"
  >
    <KitIcon code={icon} size={22} />
    <span className="flex-1 font-semibold">{word}</span>
    {badge}
    <KitIcon code="Cv" size={20} />
  </button>
);
