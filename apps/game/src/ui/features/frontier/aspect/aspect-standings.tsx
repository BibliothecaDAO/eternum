import "./aspect-standings.css";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { HudMeter } from "@/ui/design-system/kit/hud-elements";
import { ASPECT_PAGE_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { aspectName, formatExact, type AspectId } from "@bibliothecadao/types";

interface AspectStandingItem {
  aspectId: AspectId;
  height: number;
  own: boolean;
  stage?: number;
  finished?: boolean;
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
  <div className={stages !== undefined ? "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3" : "flex flex-col gap-2"}>
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
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <AspectMark aspect={standing.aspectId} size={22} decorative />
            <span className="race-row__name truncate text-hud-body">{name}</span>
          </span>
          <span className="shrink-0 text-hud-strong tabular-nums text-hud-ink">{formatExact(standing.height)}</span>
        </div>
        {stageText && stages !== undefined ? (
          <StageSegments
            stages={stages}
            built={standing.finished ? stages : Math.max(0, (standing.stage ?? 1) - 1)}
            label={`${stageText} · ${heightText}`}
          />
        ) : (
          <HudMeter label={name} share={raceProgress(standing.height, finishHeight)} />
        )}
      </div>
    </div>
  );
};

const StageSegments = ({ stages, built, label }: { stages: number; built: number; label: string }) => (
  <span role="img" aria-label={label} className="race-steps">
    {Array.from({ length: stages }, (_, index) => (
      <span
        key={index}
        className="race-step"
        data-built={index < built || undefined}
        data-current={index === built || undefined}
      />
    ))}
  </span>
);
