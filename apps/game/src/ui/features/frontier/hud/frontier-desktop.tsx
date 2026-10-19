import { HudBubble } from "@/ui/design-system/kit/hud-elements";
import { OpenedFromPanel } from "@/ui/design-system/kit/opened-from-panel";
import { PRODUCTION, REALM, RESEARCH, SEASON, TODAY } from "@/ui/design-system/kit/words";
import type { SeasonGoal } from "@/ui/features/world/containers/top-header/identity-chip";
import { TopHeader } from "@/ui/features/world/containers/top-header/top-header";
import { HudColumn, HudFoot } from "@/ui/features/world/hud/desktop-hud";
import { GuidedRail } from "@/ui/features/world/hud/guided-rail";
import { HudMinimap } from "@/ui/features/world/hud/minimap";
import type { ReactNode } from "react";

import type { HudSurface } from "./frontier-nav";

/**
 * Frontier on the one desktop HUD every mode shares (the owner, 19 October 2026: "A unified hud, with elements that can
 * differ a bit"; issue 5067): the shared top bar, the left column, the rail and the foot, with Frontier's own panels in
 * them. The top bar's clock is the day's, Frontier's one day timer. The left column holds one panel for the realm (its
 * stores and LORDS as rings, as Blitz's realm card reads a holding), one for its armies, and the minimap; the rail the
 * guide where Blitz has Next up, then the shared events and chat; the foot the selected army's state over the round
 * places. An order goes from the map itself, as in Blitz. Sheets and moments render beside the regions.
 */
export const FrontierDesktop = ({
  season,
  clock,
  realm,
  armies,
  guide,
  page,
  stage,
  foot,
  places,
  children,
}: {
  /** The player's place on the season's board, in the top bar's chip, which opens it. */
  season?: SeasonGoal;
  /** The day, in the top bar's clock place. */
  clock: ReactNode;
  realm?: ReactNode;
  armies?: ReactNode;
  guide?: ReactNode;
  /** A nav page (Research, the Season's board): the right panel, in the rail's place. */
  page?: ReactNode;
  /** What floats over the map itself (the last hour's bubble). */
  stage?: ReactNode;
  /** Over the places: notices, the selected army's state, a visit's Leave. */
  foot?: ReactNode;
  places: ReactNode;
  children?: ReactNode;
}) => (
  <>
    <TopHeader season={season} clock={clock} />
    <HudColumn label={REALM}>
      {realm}
      <div className="flex shrink-0 flex-col">{armies}</div>
      <HudMinimap className="mt-auto min-h-hud-minimap w-full shrink" />
    </HudColumn>
    <GuidedRail lead={guide ?? null} picked={false} />
    <HudFoot>
      <div className="pointer-events-none flex flex-col items-center gap-2">
        {foot}
        {places}
      </div>
    </HudFoot>
    {page && (
      <div
        data-page
        className="pointer-events-none fixed right-3 top-hud-header z-hud-rail flex max-h-hud-frontier-page-room w-hud-frontier-page flex-col"
      >
        <OpenedFromPanel.Provider value>{page}</OpenedFromPanel.Provider>
      </div>
    )}
    <div className="pointer-events-none fixed inset-x-hud-foot bottom-hud-frontier-stage-bottom top-hud-frontier-stage-top z-hud-foot">
      {stage}
    </div>
    {children}
  </>
);

/**
 * Frontier's places as the shared HUD's round bubbles: Research (lit while a node can be bought), Production, Today and
 * the Season. A desktop has no Menu: Map and Realm are the top bar's Realm / World, chat the rail's strip, the Realms'
 * labor the realm panel's chip, the guide's switch and lines Settings', and leaving the game Settings' Leave game.
 */
export const FrontierPlaces = ({
  surface,
  onSurface,
  research,
}: {
  surface: HudSurface | null;
  onSurface: (surface: HudSurface | null) => void;
  /** Whether a research node can be bought now; absent for a spectator, who has no Research. */
  research?: boolean;
}) => {
  const bubble = (to: HudSurface, icon: Parameters<typeof HudBubble>[0]["icon"], word: string, count?: number) => (
    <HudBubble
      key={to}
      icon={icon}
      word={word}
      count={count}
      countTone="good"
      pressed={surface === to}
      aria-label={word}
      onClick={() => onSurface(surface === to ? null : to)}
    />
  );
  return (
    <nav aria-label="Places" className="pointer-events-auto flex items-start gap-3">
      {research !== undefined && bubble("research", "research", RESEARCH, research ? 1 : undefined)}
      {research !== undefined && bubble("production", "production", PRODUCTION)}
      {bubble("today", "clock", TODAY)}
      {bubble("season", "victory", SEASON)}
    </nav>
  );
};
