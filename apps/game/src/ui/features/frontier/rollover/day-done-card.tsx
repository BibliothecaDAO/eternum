import { aspectName, formatExact, formatShort, type AspectId } from "@bibliothecadao/types";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudMeter, HudNotice, HudPanel } from "@/ui/design-system/kit/hud-elements";
import {
  ARMIES_ENDED,
  ASPECT_PAGE_WORDS,
  CONTINUE,
  DAY,
  DAY_DONE,
  DAY_SHARE_WORDS,
  DAY_TOTALS_UNKNOWN,
  DAY_OPEN,
  REALM_KEPT,
  TROOPS,
  tomorrowLasts,
} from "@/ui/design-system/kit/words";

import { DayEnds } from "../day-ends";
import type { DayClock } from "../hud/day-clock";
import { type DayTotals, DayTotalsGrid } from "../log/day-totals";
import type { DayHistory } from "../log/player-day";

export type DayDoneRace = {
  finishHeight: number;
  standings: readonly { aspectId: AspectId; height: number; own: boolean }[];
};

export const DayDoneCard = ({
  endedDay,
  clock,
  totals,
  history,
  onRetry,
  rank,
  aspect,
  race,
  armies,
  troopsLost,
  onShare,
  onContinue,
}: {
  endedDay: number;
  clock: Pick<DayClock, "day" | "endsAt" | "secondsLeft" | "tomorrowSeconds" | "tone">;
  totals: DayTotals;
  history: Exclude<DayHistory, "waiting">;
  onRetry: () => void;
  rank?: { from: number; to: number } | null;
  aspect?: AspectId;
  race?: DayDoneRace;
  armies: number;
  troopsLost: number;
  onShare?: () => void;
  onContinue: () => void;
}) => (
  <HudPanel
    label={`${DAY} ${endedDay} ${DAY_DONE}`}
    collapsible={false}
    className="ui-day-done"
    bodyClassName="flex flex-col gap-3 overflow-y-auto p-4 lg:p-5"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-hud-display text-hud-ink">
          {DAY} {endedDay} {DAY_DONE}
        </h2>
        <p className="text-hud-strong text-hud-muted">
          {REALM_KEPT} · {DAY} {clock.day} {DAY_OPEN}
        </p>
      </div>
      {aspect && <AspectMark aspect={aspect} size={44} decorative />}
    </div>
    <div className={race ? "ui-day-done__grid" : "flex flex-col gap-3"}>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-hud-label text-hud-muted">
          <DayEnds endsAt={clock.endsAt} secondsLeft={clock.secondsLeft} tone={clock.tone} />
          <p className="flex items-center gap-1 text-hud-label">
            <SemanticIcon name="hourglass" size={14} />
            <span>{tomorrowLasts(clock.tomorrowSeconds).words}</span>
            <b className="tabular-nums text-hud-ink">{tomorrowLasts(clock.tomorrowSeconds).reading}</b>
          </p>
        </div>
        <div className="w-full">
          <DayTotalsGrid totals={totals} />
        </div>
        {history === "short" && <HudNotice line={DAY_TOTALS_UNKNOWN} />}
        {history === "failed" && <HudNotice tone="bad" line={DAY_TOTALS_UNKNOWN} retry={onRetry} />}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {rank && (
            <p className="flex items-center gap-1.5 text-hud-title tabular-nums">
              <SemanticIcon name="victory" size={22} />#{rank.from} → #{rank.to}
            </p>
          )}
          {armies > 0 && <ArmiesLine armies={armies} troopsLost={troopsLost} />}
        </div>
      </div>
      {race && <RaceStandings race={race} />}
    </div>
    <div className="flex w-full items-center justify-end gap-2 border-t border-hud-divider pt-3">
      {onShare && (
        <HudButton kind="secondary" icon="share" onClick={onShare}>
          {DAY_SHARE_WORDS.share}
        </HudButton>
      )}
      <HudButton kind="primary" onClick={onContinue}>
        {CONTINUE}
      </HudButton>
    </div>
  </HudPanel>
);

const RaceStandings = ({ race }: { race: DayDoneRace }) => (
  <div data-day-race className="ui-day-race">
    <span className="text-hud-label uppercase tracking-wider text-hud-muted">{ASPECT_PAGE_WORDS.race}</span>
    <div className="flex flex-col gap-2">
      {race.standings.map((row) => {
        const label = aspectName(row.aspectId);
        return (
          <div key={row.aspectId} data-own={row.own || undefined} className="ui-day-race__row">
            <AspectMark aspect={row.aspectId} size={22} decorative />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2 text-hud-label">
                <span className={row.own ? "text-hud-strong text-hud-gold" : "text-hud-ink"}>{label}</span>
                <span className="tabular-nums text-hud-muted">{formatExact(row.height)}</span>
              </div>
              <HudMeter label={label} share={race.finishHeight > 0 ? row.height / race.finishHeight : 0} />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

/**
 * How many armies ended with the day, counted ("×3"), and the troops they took.
 */
const ArmiesLine = ({ armies, troopsLost }: { armies: number; troopsLost: number }) => (
  <div className="flex items-center justify-center gap-1.5" aria-label={TROOPS}>
    <HudChip icons={["army"]} label={ARMIES_ENDED}>{`×${formatShort(armies)}`}</HudChip>
    <HudChip icons={["troops"]} label={TROOPS}>{`−${formatShort(troopsLost)}`}</HudChip>
  </div>
);
