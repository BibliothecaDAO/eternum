import "./hyperstructure-stage.css";

import type { TriumphStage } from "@bibliothecadao/eternum/game-client";
import { aspectName, aspects, formatExact, type AspectId } from "@bibliothecadao/types";
import { useState, type CSSProperties } from "react";

import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { ASPECT_PAGE_WORDS, OF, SEASON_WORDS } from "@/ui/design-system/kit/words";
import { AspectRaceCanvas } from "@/ui/features/frontier/aspect/aspect-race-canvas";

import { type AspectRaceStanding, RACE_STAGE_COUNT, raceStageOf, type stageTriumphsOf } from "../season";

type StageTriumph = ReturnType<typeof stageTriumphsOf>[number];

const TRIUMPH_ICONS = {
  1: "eye",
  2: "stamina",
  3: "moon",
  4: "reward",
} as const satisfies Record<TriumphStage, IconMeaning>;

const completedTiersOf = (height: number, finishHeight: number): number =>
  finishHeight > 0 && height >= finishHeight ? RACE_STAGE_COUNT : raceStageOf(height, finishHeight) - 1;

const StageSegment = ({
  index,
  filled,
  triumph,
  finishHeight,
  compact,
  open,
  onToggle,
  onClose,
}: {
  index: number;
  filled: boolean;
  triumph: StageTriumph | undefined;
  finishHeight: number;
  compact: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) => {
  const icon: IconMeaning = triumph ? TRIUMPH_ICONS[triumph.stage] : "crown";
  const title = triumph ? triumph.name : ASPECT_PAGE_WORDS.race;
  const height = triumph ? triumph.height : finishHeight;
  const heightLabel = SEASON_WORDS.stageAtHeight(height);
  const summary = triumph?.rule ? `${title} · ${heightLabel} · ${triumph.rule}` : `${title} · ${heightLabel}`;
  const edge = index === 0 ? "start" : index === RACE_STAGE_COUNT - 1 ? "end" : "center";
  return (
    <div className="hyper-tile__stage" data-open={open || undefined}>
      <button
        type="button"
        className="hyper-tile__marker"
        data-reached={filled || undefined}
        data-triumph-stage={triumph?.stage}
        aria-label={summary}
        aria-expanded={open}
        onClick={onToggle}
        onBlur={onClose}
      >
        <Icon name={icon} size={compact ? 12 : 15} />
      </button>
      <div className="hyper-tile__tip" role="tooltip" data-edge={edge}>
        <div className="hyper-tile__tip-head">
          <span className="hyper-tile__tip-name">{title}</span>
          <span className="hyper-tile__tip-height">{heightLabel}</span>
        </div>
        {triumph?.rule && <span className="hyper-tile__tip-rule">{triumph.rule}</span>}
      </div>
      <span className="hyper-tile__pip" data-filled={filled || undefined} aria-hidden="true" />
    </div>
  );
};

const AspectStatTile = ({
  row,
  finishHeight,
  own,
  compact,
  triumphs,
}: {
  row: AspectRaceStanding;
  finishHeight: number;
  own: boolean;
  compact: boolean;
  triumphs: readonly StageTriumph[];
}) => {
  const [openStage, setOpenStage] = useState<number | null>(null);
  const stage = completedTiersOf(row.height, finishHeight);
  const name = aspectName(row.id);
  return (
    <article
      data-aspect-id={row.id}
      data-stage={stage}
      data-own={own || undefined}
      style={aspectVariables(row.id) as CSSProperties}
      className={compact ? "hyper-tile hyper-tile--compact" : "hyper-tile"}
      aria-label={ASPECT_PAGE_WORDS.height(row.height, finishHeight)}
    >
      <div className="hyper-tile__head">
        <span className="hyper-tile__title">
          <AspectMark aspect={row.id} size={compact ? 20 : 24} decorative />
          <span className="hyper-tile__name">{name}</span>
        </span>
      </div>
      <div className="hyper-tile__pips hyper-tile__pips--triumphs" data-stage-triumphs>
        {Array.from({ length: RACE_STAGE_COUNT }, (_, index) => (
          <StageSegment
            key={index}
            index={index}
            filled={index < stage}
            triumph={triumphs[index]}
            finishHeight={finishHeight}
            compact={compact}
            open={openStage === index}
            onToggle={() => setOpenStage((current) => (current === index ? null : index))}
            onClose={() => setOpenStage((current) => (current === index ? null : current))}
          />
        ))}
      </div>
      <div className="hyper-tile__foot">
        <span className="hyper-tile__height">
          <b className="hyper-tile__count">{formatExact(row.height)}</b>
          <span className="hyper-tile__goal">{`${OF} ${formatExact(finishHeight)}`}</span>
        </span>
        {row.members !== null && (
          <span className="hyper-tile__members">
            <Icon name="person" size={14} />
            {formatExact(row.members)}
          </span>
        )}
      </div>
    </article>
  );
};

export const HyperstructureRaceStage = ({
  byAspect,
  finishHeight,
  ownAspect,
  triumphs,
  compact = false,
}: {
  byAspect: Readonly<Record<AspectId, AspectRaceStanding>>;
  finishHeight: number;
  ownAspect: AspectId | null;
  triumphs: readonly StageTriumph[];
  compact?: boolean;
}) => {
  const standings = aspects.map(({ id }) => ({
    aspectId: id,
    height: byAspect[id].height,
    finished: byAspect[id].finished,
  }));
  return (
    <div className={compact ? "hyper-stage hyper-stage--compact" : "hyper-stage"} data-hyperstructure-stage>
      <AspectRaceCanvas
        standings={standings}
        finishHeight={finishHeight}
        surface={compact ? "shell-compact" : "shell"}
      />
      <div className={compact ? "hyper-stage__grid hyper-stage__grid--compact" : "hyper-stage__grid"}>
        {aspects.map(({ id }) => (
          <AspectStatTile
            key={id}
            row={byAspect[id]}
            finishHeight={finishHeight}
            own={ownAspect === id}
            triumphs={triumphs}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
};
