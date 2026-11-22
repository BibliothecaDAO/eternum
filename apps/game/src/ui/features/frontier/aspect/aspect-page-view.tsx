import { OpeningPartGate } from "../opening/opening-context";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { HudChip, HudMeter, HudPage, HudRow } from "@/ui/design-system/kit/hud-elements";
import { ASPECT_PAGE_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { aspectName, formatExact, formatShort, type AspectId } from "@bibliothecadao/types";
import type { ReactNode } from "react";
import { AspectRaceCanvas } from "./aspect-race-canvas";

export interface AspectStanding {
  aspectId: AspectId;
  rank: number;
  height: number;
  stage: number;
  finished: boolean;
  own: boolean;
  lords: number;
}

export interface AspectTriumph {
  stage: keyof typeof WORDS.triumph;
  day: number | null;
}

export interface AspectMember {
  id: string;
  realm: string;
  mine: boolean;
  glory: number;
  guards: string | null;
}

export interface OwnAspect {
  aspectId: AspectId;
  triumphs: readonly AspectTriumph[];
  bar: { charge: number; threshold: number } | null;
  members: readonly AspectMember[];
}

export interface AspectPageProps {
  race: {
    standings: readonly AspectStanding[];
    finishHeight: number;
    stages: number;
    result: { winner: string | null } | null;
  } | null;
  own: OwnAspect | null;
  fights?: ReactNode;
  invite?: ReactNode;
  onClose: () => void;
}

export const AspectPageView = ({ race, own, fights, invite, onClose }: AspectPageProps) => (
  <HudPage label={WORDS.title} icon="hyperstructure" onClose={onClose} bodyClassName="gap-3">
    {race === null ? (
      <Muted>{WORDS.reading}</Muted>
    ) : (
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 overflow-y-auto">
        <Race race={race} />
        {own ? <YourAspect own={own} /> : <Muted>{WORDS.noAspect}</Muted>}
        {own && fights}
        {own && invite}
      </div>
    )}
  </HudPage>
);

const Race = ({ race }: { race: NonNullable<AspectPageProps["race"]> }) => (
  <section data-aspect-race className="flex flex-col gap-2">
    <Heading>{WORDS.race}</Heading>
    {race.result && <Muted>{race.result.winner === null ? WORDS.noFinisher : WORDS.won(race.result.winner)}</Muted>}
    <AspectRaceCanvas standings={race.standings} finishHeight={race.finishHeight} />
    <div className="ui-race-columns">
      {race.standings.map((standing) => (
        <StandingColumn key={standing.aspectId} standing={standing} race={race} />
      ))}
    </div>
  </section>
);

const StandingColumn = ({
  standing,
  race,
}: {
  standing: AspectStanding;
  race: NonNullable<AspectPageProps["race"]>;
}) => {
  const height = WORDS.height(standing.height, race.finishHeight);
  const stageText = standing.finished ? WORDS.finished : WORDS.stage(standing.stage, race.stages);
  return (
    <div
      data-aspect-col={standing.aspectId}
      data-aspect-id={standing.aspectId}
      data-own={standing.own || undefined}
      className="ui-race-col"
    >
      <div className="ui-race-col__head">
        <AspectMark aspect={standing.aspectId} size={22} decorative />
        <span className="ui-race-col__name">{aspectName(standing.aspectId)}</span>
      </div>
      <span className="ui-race-col__height tabular-nums">{formatExact(standing.height)}</span>
      <div className="ui-race-segments" role="progressbar" aria-label={height} aria-valuenow={standing.height}>
        {Array.from({ length: race.stages }, (_, index) => {
          const stageIndex = index + 1;
          const active = standing.finished || stageIndex <= standing.stage;
          return <span key={stageIndex} className="ui-race-segment" data-active={active || undefined} />;
        })}
      </div>
      <span className="ui-race-col__stage">
        {stageText} · {height}
      </span>
      <HudChip icons={["lords"]} label={WORDS.worth}>
        {formatShort(standing.lords)}
      </HudChip>
    </div>
  );
};

const YourAspect = ({ own }: { own: OwnAspect }) => (
  <section data-aspect-own className="flex flex-col gap-2">
    <Heading>
      <span className="inline-flex items-center gap-2">
        <AspectMark aspect={own.aspectId} size={24} decorative />
        {WORDS.yours(aspectName(own.aspectId))}
      </span>
    </Heading>
    <div data-aspect-triumphs className="flex flex-wrap items-center gap-1">
      <Muted>{WORDS.triumphs}:</Muted>
      {own.triumphs.map(({ stage, day }) => (
        <HudChip key={stage} icons={["star"]} tone={day === null ? undefined : "good"}>
          {WORDS.triumph[stage]} · {day === null ? WORDS.triumphAt(stage) : WORDS.triumphOn(day)}
        </HudChip>
      ))}
    </div>
    {own.bar && (
      <OpeningPartGate part="bane-row">
        <div data-aspect-bane className="flex flex-col gap-0.5">
          <Muted>
            {WORDS.baneBar}: {WORDS.baneCharge(own.bar.charge, own.bar.threshold)}
          </Muted>
          <HudMeter label={WORDS.baneBar} share={own.bar.charge / own.bar.threshold} />
        </div>
      </OpeningPartGate>
    )}
    <Heading>{WORDS.members}</Heading>
    <div data-aspect-members className="flex flex-col gap-1">
      {own.members.map((member) => (
        <HudRow
          key={member.id}
          lead={<Icon name="realm" size={32} />}
          title={member.realm}
          selected={member.mine}
          detail={member.guards ? WORDS.guards(member.guards) : undefined}
          trail={
            <OpeningPartGate part="glory">
              <HudChip icons={["crown"]} label={WORDS.glory}>
                {formatShort(member.glory)}
              </HudChip>
            </OpeningPartGate>
          }
        />
      ))}
    </div>
  </section>
);

const Heading = ({ children }: { children: ReactNode }) => (
  <span className="text-hud-strong text-hud-ink">{children}</span>
);
const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-hud-label text-hud-muted">{children}</span>
);
