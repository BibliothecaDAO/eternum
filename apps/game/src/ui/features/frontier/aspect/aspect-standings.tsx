import "./aspect-standings.css";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { HudChip, HudMeter } from "@/ui/design-system/kit/hud-elements";
import { ASPECT_PAGE_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { aspectName, formatExact, formatShort, type AspectId } from "@bibliothecadao/types";

interface AspectStandingItem {
  aspectId: AspectId;
  height: number;
  own: boolean;
  stage?: number;
  finished?: boolean;
  lords?: number;
}

const raceProgress = (height: number, finishHeight: number): number =>
  finishHeight > 0 ? Math.max(0, Math.min(1, height / finishHeight)) : 0;

export const AspectStandings = ({
  standings,
  finishHeight,
  stages,
}: {
  standings: readonly AspectStandingItem[];
  finishHeight: number;
  stages?: number;
}) => (
  <div
    className={stages !== undefined ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" : "flex flex-col gap-2"}
  >
    {standings.map((standing) => (
      <AspectStandingRow key={standing.aspectId} standing={standing} finishHeight={finishHeight} stages={stages} />
    ))}
  </div>
);

const AspectStandingRow = ({
  standing,
  finishHeight,
  stages,
}: {
  standing: AspectStandingItem;
  finishHeight: number;
  stages?: number;
}) => {
  const name = aspectName(standing.aspectId);
  const heightText = WORDS.height(standing.height, finishHeight);
  const stageText =
    stages !== undefined && standing.stage !== undefined
      ? standing.finished
        ? WORDS.finished
        : WORDS.stage(standing.stage, stages)
      : undefined;
  return (
    <div
      data-aspect-col={standing.aspectId}
      data-aspect-id={standing.aspectId}
      data-own={standing.own || undefined}
      className="race-row"
    >
      <AspectMark aspect={standing.aspectId} size={24} decorative />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className={standing.own ? "text-hud-strong text-hud-ink" : "text-hud-body text-hud-ink"}>{name}</span>
          <div className="flex items-center gap-2">
            <span className="text-hud-strong tabular-nums text-hud-ink">{formatExact(standing.height)}</span>
            {standing.lords !== undefined && (
              <HudChip icons={["lords"]} label={WORDS.worth}>
                {formatShort(standing.lords)}
              </HudChip>
            )}
          </div>
        </div>
        <HudMeter label={stageText ? heightText : name} share={raceProgress(standing.height, finishHeight)} />
        {stageText && (
          <span className="text-hud-label text-hud-muted">
            {stageText} · {heightText}
          </span>
        )}
      </div>
    </div>
  );
};
