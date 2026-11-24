import "./hyperstructure-stage.css";

import { aspectName, aspects, formatExact, type AspectId } from "@bibliothecadao/types";
import type { CSSProperties } from "react";

import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { ASPECT_PAGE_WORDS, OF } from "@/ui/design-system/kit/words";
import { AspectRaceCanvas } from "@/ui/features/frontier/aspect/aspect-race-canvas";

import { type AspectRaceStanding, RACE_STAGE_COUNT, raceStageOf } from "../season";

const completedTiersOf = (height: number, finishHeight: number): number =>
  finishHeight > 0 && height >= finishHeight ? RACE_STAGE_COUNT : raceStageOf(height, finishHeight) - 1;

const AspectStatTile = ({
  row,
  finishHeight,
  own,
  compact,
}: {
  row: AspectRaceStanding;
  finishHeight: number;
  own: boolean;
  compact: boolean;
}) => {
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
      <div className="hyper-tile__pips" aria-hidden="true">
        {Array.from({ length: RACE_STAGE_COUNT }, (_, index) => (
          <span key={index} className="hyper-tile__pip" data-filled={index < stage || undefined} />
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
  compact = false,
}: {
  byAspect: Readonly<Record<AspectId, AspectRaceStanding>>;
  finishHeight: number;
  ownAspect: AspectId | null;
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
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
};
