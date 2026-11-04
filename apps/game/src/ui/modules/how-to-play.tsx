import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { HOW_TO_PLAY_BY_MODE } from "@/shell/community";
import { Icon } from "@/ui/design-system/icon";
import { HudRow } from "@/ui/design-system/kit/hud-elements";
import { PROFILE_WORDS } from "@/ui/design-system/kit/words";

/** The guide of the game being played, on the docs site: Frontier's for Frontier, Blitz's for Blitz. */
export const useHowToPlay = (): string => HOW_TO_PLAY_BY_MODE[useGameModeConfig().id];

/**
 * How to play, the game's guide on the docs site, opened in a new tab: a row of the Menu and of Settings, named by the
 * site it opens so a player knows it leaves the game.
 */
export const HowToPlayRow = ({ guide }: { guide: string }) => (
  <HudRow
    lead={<Icon name="guide" size={22} />}
    title={PROFILE_WORDS.howToPlay}
    detail={new URL(guide).host}
    href={guide}
  />
);
