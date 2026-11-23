import "./day-done.css";

import { formatShort, type AspectId } from "@bibliothecadao/types";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudNotice, HudPanel } from "@/ui/design-system/kit/hud-elements";
import {
  ARMIES_ENDED,
  ASPECT_PAGE_WORDS,
  CONTINUE,
  DAY,
  DAY_DONE,
  DAY_DONE_WORDS,
  DAY_OPEN,
  DAY_SHARE_WORDS,
  DAY_TOTALS_UNKNOWN,
  REALM_KEPT,
  TROOPS,
  tomorrowLasts,
} from "@/ui/design-system/kit/words";

import { AspectStandings } from "../aspect/aspect-standings";

import { DayEnds } from "../day-ends";
import type { DayClock } from "../hud/day-clock";
import { type DayTotals, DayTotalsGrid } from "../log/day-totals";
import type { DayHistory } from "../log/player-day";
import { dayBestMoment, type DayBest } from "./day-share";

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
  best,
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
  best?: DayBest;
  race?: DayDoneRace;
  armies: number;
  troopsLost: number;
  onShare?: () => void;
  onContinue: () => void;
}) => {
  const moment = best ? dayBestMoment(best) : null;
  const continueLabel = clock.day !== undefined ? DAY_DONE_WORDS.beginDay(clock.day) : CONTINUE;
  return (
    <HudPanel
      label={`${DAY} ${endedDay} ${DAY_DONE}`}
      collapsible={false}
      className="day-done"
      bodyClassName="flex flex-col gap-4 overflow-y-auto p-5 lg:p-7"
    >
      <div className="day-done__layout" data-has-moment={moment ? "true" : undefined}>
        {moment && (
          <div className="day-done__moment" data-day-moment>
            <span className="day-done__moment-tag">{DAY_DONE_WORDS.bestMoment(endedDay)}</span>
            <SemanticIcon name={moment.icon} size={128} />
            <h3 className="day-done__moment-title">{moment.title}</h3>
            {(moment.detail || moment.paid) && (
              <div className="day-done__moment-chips">
                {moment.detail && <HudChip icons={["attack"]}>{moment.detail}</HudChip>}
                {moment.paid && (
                  <HudChip icons={[moment.paid.icon]}>{`${moment.paid.value} ${moment.paid.name}`}</HudChip>
                )}
              </div>
            )}
          </div>
        )}
        <div className="day-done__main">
          <header className="day-done__header">
            {clock.day !== undefined && <span className="day-done__kicker">{DAY_DONE_WORDS.dawnOf(clock.day)}</span>}
            {aspect && (
              <span className="day-done__aspect">
                <AspectMark aspect={aspect} size={44} decorative />
              </span>
            )}
            <div className="day-done__head">
              <h2 className="day-done__title">
                {DAY} {endedDay} {DAY_DONE}
              </h2>
              <p className="day-done__sub">
                {REALM_KEPT} · {DAY} {clock.day} {DAY_OPEN}
              </p>
            </div>
          </header>
          <div className="day-done__meta">
            <DayEnds endsAt={clock.endsAt} secondsLeft={clock.secondsLeft} tone={clock.tone} />
            <p className="flex items-center gap-1">
              <SemanticIcon name="hourglass" size={14} />
              <span>{tomorrowLasts(clock.tomorrowSeconds).words}</span>
              <b className="tabular-nums text-hud-ink">{tomorrowLasts(clock.tomorrowSeconds).reading}</b>
            </p>
            {rank && (
              <p className="flex items-center gap-1 text-hud-strong tabular-nums text-hud-ink">
                <SemanticIcon name="victory" size={16} />#{rank.from} → #{rank.to}
              </p>
            )}
            {armies > 0 && <ArmiesLine armies={armies} troopsLost={troopsLost} />}
          </div>
          <DayTotalsGrid totals={totals} />
          {history === "short" && <HudNotice line={DAY_TOTALS_UNKNOWN} />}
          {history === "failed" && <HudNotice tone="bad" line={DAY_TOTALS_UNKNOWN} retry={onRetry} />}
          {race && <RaceStandings race={race} />}
          <div className="day-done__actions">
            {onShare && (
              <HudButton kind="secondary" icon="share" onClick={onShare}>
                {DAY_SHARE_WORDS.share}
              </HudButton>
            )}
            <HudButton kind="primary" icon="play" data-day-continue="" onClick={onContinue}>
              {continueLabel}
            </HudButton>
          </div>
        </div>
      </div>
    </HudPanel>
  );
};

const RaceStandings = ({ race }: { race: DayDoneRace }) => (
  <div data-day-race className="day-race">
    <span className="text-hud-label uppercase tracking-wider text-hud-muted">{ASPECT_PAGE_WORDS.race}</span>
    <AspectStandings standings={race.standings} finishHeight={race.finishHeight} />
  </div>
);

const ArmiesLine = ({ armies, troopsLost }: { armies: number; troopsLost: number }) => (
  <div className="flex items-center justify-center gap-1.5" aria-label={TROOPS}>
    <HudChip icons={["army"]} label={ARMIES_ENDED}>{`×${formatShort(armies)}`}</HudChip>
    <HudChip icons={["troops"]} label={TROOPS}>{`−${formatShort(troopsLost)}`}</HudChip>
  </div>
);
