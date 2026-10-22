import { useEffect, type ReactNode } from "react";

import { DAY_END_TIMING, useDayEndStore, type DayEndPhase } from "@/hooks/store/use-day-end-store";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { SKIP } from "@/ui/design-system/kit/words";

/** How dark the screen is in each phase: the black falls with the nightfall, holds, and lifts with the dawn. */
const BLACK: Record<DayEndPhase, { opacity: number; seconds: number }> = {
  day: { opacity: 0, seconds: 0 },
  veil: { opacity: 0, seconds: 0 },
  summary: { opacity: 0, seconds: 0 },
  nightfall: { opacity: 1, seconds: DAY_END_TIMING.nightfall },
  black: { opacity: 1, seconds: 0 },
  dawn: { opacity: 0, seconds: DAY_END_TIMING.dawn },
};

/** A later arrival's summary waits over the new land in the dark, which lifts with the dawn. */
const LATER_DARK = 0.6;

/** The summary stays clear of a phone's home bar. */
const CLEAR_OF_THE_HOME_BAR = { paddingBottom: "env(safe-area-inset-bottom)" };

/**
 * A Frontier day's end over the live map (use-day-end-store): the summary rising over the rolling mist, the black the
 * screen drops into and lifts from, and the way past them. While the moment plays the map takes no orders: the day
 * they would go to has ended. On a desktop the summary stands low in the middle; on a phone it is a sheet over the lower
 * half, Continue under the thumb.
 */
export const DayEndScreen = ({ summary }: { summary: ReactNode | null }) => {
  const { phase, arrival, skip } = useDayEndStore();
  useSkipKeys(phase === "veil", skip);
  if (phase === "day") return null;
  const black = BLACK[phase];
  const dark = arrival === "later" && phase === "summary" ? LATER_DARK : 0;
  return (
    <div className="ui pointer-events-auto fixed inset-0 z-50" data-day-end={phase}>
      <div
        className="absolute inset-0 bg-hud-night transition-opacity ease-out"
        style={{ opacity: dark, transitionDuration: `${DAY_END_TIMING.dawn}s` }}
      />
      {phase === "summary" && summary && (
        <div
          className="absolute inset-x-2 bottom-2 lg:inset-x-auto lg:bottom-8 lg:left-1/2 lg:w-hud-summary lg:-translate-x-1/2"
          style={CLEAR_OF_THE_HOME_BAR}
        >
          {summary}
        </div>
      )}
      {phase === "veil" && (
        <div className="absolute right-4 top-4 lg:bottom-4 lg:top-auto">
          <HudButton kind="secondary" onClick={skip}>
            {SKIP}
          </HudButton>
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-hud-night transition-opacity"
        style={{ opacity: black.opacity, transitionDuration: `${black.seconds}s` }}
      />
    </div>
  );
};

/** Space and Escape skip the rolling mist. */
function useSkipKeys(active: boolean, skip: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Escape") return;
      event.preventDefault();
      skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, skip]);
}
