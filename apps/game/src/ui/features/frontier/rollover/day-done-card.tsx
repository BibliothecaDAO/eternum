import { formatExact } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudMeter, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { CONTINUE, DAY, DAY_DONE, DAY_OPEN, REALM_KEPT, TROOPS, tomorrowLasts } from "@/ui/design-system/kit/words";

import { DayEnds } from "../day-ends";
import type { DayClock } from "../hud/day-clock";
import { type DayTotals, DayTotalsGrid } from "../log/day-totals";

/**
 * The day-done card (wireframe 11), over the map at the day's end (DayEndScreen places it): the day done and the realm
 * kept, when the new day ends and how long tomorrow lasts, the ended day's totals, the rank it moved to, and the troops
 * the ended armies took with them against those that came home. Continue goes on into the new day.
 */
export const DayDoneCard = ({
  endedDay,
  clock,
  totals,
  rank,
  armies,
  troopsLost,
  returned,
  onContinue,
}: {
  endedDay: number;
  /** The new day: when it ends, the time left, and how long the day after lasts. */
  clock: Pick<DayClock, "endsAt" | "secondsLeft" | "tomorrowSeconds" | "tone">;
  totals: DayTotals;
  /** The closing rank change, from Herald's record of the ended day. */
  rank?: { from: number; to: number };
  /** How many armies ended with the day. */
  armies: number;
  troopsLost: number;
  /** What Homecoming sent home, and what fitted the troop store. */
  returned?: { sent: number; fitted: number };
  onContinue: () => void;
}) => (
  <HudPanel
    label={`${DAY} ${endedDay} ${DAY_DONE}`}
    collapsible={false}
    bodyClassName="flex flex-col items-center gap-2 overflow-y-auto"
  >
    <h2 className="text-hud-display">
      {DAY} {endedDay} {DAY_DONE}
    </h2>
    <p className="text-hud-strong">
      {REALM_KEPT} · {DAY} {endedDay + 1} {DAY_OPEN}
    </p>
    <DayEnds endsAt={clock.endsAt} secondsLeft={clock.secondsLeft} tone={clock.tone} />
    <p className="flex items-center justify-center gap-1 text-hud-strong">
      <SemanticIcon name="hourglass" size={18} />
      <span>{tomorrowLasts(clock.tomorrowSeconds).words}</span>
      <b className="tabular-nums">{tomorrowLasts(clock.tomorrowSeconds).reading}</b>
    </p>
    <div className="w-full">
      <DayTotalsGrid totals={totals} />
    </div>
    {rank && (
      <p className="flex items-center gap-1.5 text-hud-title tabular-nums">
        <SemanticIcon name="victory" size={24} />#{rank.from} → #{rank.to}
      </p>
    )}
    {armies > 0 && <ArmiesLine armies={armies} troopsLost={troopsLost} returned={returned} />}
    <div className="grid w-full">
      <HudButton kind="primary" onClick={onContinue}>
        {CONTINUE}
      </HudButton>
    </div>
  </HudPanel>
);

/** The ended armies, gone, the troops they took, and the troops returned beside it: what fitted, by a full bar. */
const ArmiesLine = ({
  armies,
  troopsLost,
  returned,
}: {
  armies: number;
  troopsLost: number;
  returned: { sent: number; fitted: number } | undefined;
}) => (
  <div className="flex items-center justify-center gap-1.5" aria-label={TROOPS}>
    {Array.from({ length: armies }, (_, index) => (
      <span key={index} className="size-8 rounded-full border border-hud-line" />
    ))}
    <span className="tabular-nums">−{formatExact(troopsLost)}</span>
    {returned && (
      <span className="flex items-center gap-1.5 pl-2.5">
        <HudChip icons={["order-enlightenment", "troops"]}>{`+${formatExact(returned.fitted)}`}</HudChip>
        {returned.fitted < returned.sent && (
          <>
            <span className="text-hud-label tabular-nums text-hud-muted">{formatExact(returned.sent)}</span>
            <span className="w-16">
              <HudMeter share={1} tone="bad" label={TROOPS} />
            </span>
          </>
        )}
      </span>
    )}
  </div>
);
