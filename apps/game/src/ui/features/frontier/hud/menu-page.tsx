import { OpeningPartGate } from "../opening/opening-context";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudPage, HudRow } from "@/ui/design-system/kit/hud-elements";
import { EXIT, MENU, SEASON, SETTINGS, TODAY } from "@/ui/design-system/kit/words";
import { HowToPlayRow } from "@/ui/modules/how-to-play";
import type { ReactNode } from "react";

const MENU_WORDS = {
  clock: TODAY,
  victory: SEASON,
  settings: SETTINGS,
} as const;

export const MenuPage = ({
  rank,
  onToday,
  onSeason,
  onSettings,
  guide,
  onExit,
  onClose,
}: {
  rank: string | null;
  onToday: () => void;
  onSeason: () => void;
  onSettings: () => void;
  /** The game's guide on the docs site (useHowToPlay). */
  guide: string;
  onExit: () => void;
  onClose: () => void;
}) => (
  <HudPage label={MENU} icon="menu" onClose={onClose}>
    <nav className="flex flex-col">
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
