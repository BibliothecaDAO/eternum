import { formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { DayEnds } from "@/ui/design-system/kit/clock-line";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { StoreBar } from "@/ui/design-system/kit/store-bar";
import { formatDuration } from "@/ui/design-system/kit/time";
import { CONTINUE, DAY, DAY_DONE, DAY_OPEN, REALM_KEPT, TOMORROW_LASTS, TROOPS } from "@/ui/design-system/kit/words";

import type { DayClock } from "../hud/day-clock";
import { type DayTotals, DayTotalsGrid } from "../log/day-totals";

/**
 * The day-done card (wireframe 11), once, at the first open after the day ends: the day done and the realm kept, the
 * realm as it stands, when the new day ends and how long tomorrow lasts, the ended day's totals, the rank it moved
 * to, and the troops the ended armies took with them against those that came home. Continue goes on.
 */
export const DayDoneCard = ({
  endedDay,
  realmArt,
  clock,
  totals,
  rank,
  armies,
  troopsLost,
  returned,
  onContinue,
}: {
  endedDay: number;
  realmArt: string;
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
  <section
    aria-label={`${DAY} ${endedDay} ${DAY_DONE}`}
    className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center gap-2 overflow-y-auto bg-kit-ground px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] font-sans text-kit-cream"
  >
    <h2 className="frontier-title !text-[26px]">
      {DAY} {endedDay} {DAY_DONE}
    </h2>
    <p className="text-[14px] font-semibold">
      {REALM_KEPT} · {DAY} {endedDay + 1} {DAY_OPEN}
    </p>
    <img src={realmArt} alt="" className="h-[110px] w-full max-w-[310px] rounded-xl object-cover" />
    <DayEnds endsAt={clock.endsAt} secondsLeft={clock.secondsLeft} tone={clock.tone} />
    <p className="flex items-center justify-center gap-1 text-[13px] font-semibold">
      <KitIcon code="Hg" size={18} />
      <span>{TOMORROW_LASTS}</span>
      <b className="text-[15px] tabular-nums">{formatDuration(clock.tomorrowSeconds)}</b>
    </p>
    <div className="w-full max-w-[360px]">
      <DayTotalsGrid totals={totals} />
    </div>
    {rank && (
      <p className="flex items-center gap-1.5 text-[20px] tabular-nums">
        <KitIcon code="Tp" size={24} />#{rank.from} → #{rank.to}
      </p>
    )}
    {armies > 0 && <ArmiesLine armies={armies} troopsLost={troopsLost} returned={returned} />}
    <div className="min-h-2 flex-1" />
    <Button role="primary" word={CONTINUE} onClick={onContinue} className="w-full max-w-[360px]" />
  </section>
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
      <span key={index} className="size-[30px] rounded-full border border-kit-line2 opacity-40" />
    ))}
    <span className="text-[15px] tabular-nums">−{formatExact(troopsLost)}</span>
    {returned && (
      <span className="flex items-center gap-1.5 pl-2.5">
        <span className="frontier-chip h-7 !py-0">
          <span className="contents">
            <span className="flex -space-x-1">
              <KitIcon code="Su" size={18} />
              <KitIcon code="Tr" size={18} />
            </span>
            <span className="frontier-chip-number tabular-nums !text-[15px]">+{formatExact(returned.fitted)}</span>
          </span>
        </span>
        {returned.fitted < returned.sent && (
          <>
            <span className="text-[14px] tabular-nums text-kit-muted">{formatExact(returned.sent)}</span>
            <span className="w-[60px]">
              <StoreBar amount={1} limit={1} tone="ember" />
            </span>
          </>
        )}
      </span>
    )}
  </div>
);
