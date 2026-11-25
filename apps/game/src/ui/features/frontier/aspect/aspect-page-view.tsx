import "./aspect-page-view.css";

import { OpeningPartGate, usePartShown } from "../opening/opening-context";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudMeter, HudPage, HudRow, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { ASPECT_PAGE_WORDS as WORDS, DAY } from "@/ui/design-system/kit/words";
import { aspectName, formatExact, type AspectId } from "@bibliothecadao/types";
import type { CSSProperties, ReactNode } from "react";
import { aspectVariables } from "@/tokens";
import { AspectRaceCanvas } from "./aspect-race-canvas";
import { AspectStandings } from "./aspect-standings";

export interface AspectStanding {
  aspectId: AspectId;
  rank: number;
  height: number;
  stage: number;
  finished: boolean;
  own: boolean;
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
  day?: number;
  onGoToDeep?: () => void;
  onClose: () => void;
}

export const AspectPageView = ({ race, own, fights, invite, day, onGoToDeep, onClose }: AspectPageProps) => (
  <HudPage
    label={WORDS.title}
    icon="victory"
    fills
    cue={day !== undefined && <HudChip icons={["calendar"]}>{`${DAY} ${formatExact(day)}`}</HudChip>}
    onClose={onClose}
    bodyClassName="gap-3"
  >
    {race === null ? (
      <Muted>{WORDS.reading}</Muted>
    ) : (
      <div data-aspect-race-page className="aspect-race-page">
        <Race race={race} />
        {own && <GloryBoard own={own} />}
        <div className="aspect-race-page__board">
          {own ? <YourAspect own={own} invite={invite} /> : <Muted>{WORDS.noAspect}</Muted>}
          {own && fights && <div className="flex min-w-0 flex-col gap-2">{fights}</div>}
        </div>
        {onGoToDeep && race.result === null && own !== null && (
          <HudWindowFoot>
            <HudButton kind="primary" icon="spire" onClick={onGoToDeep}>
              {WORDS.goToDeep}
            </HudButton>
          </HudWindowFoot>
        )}
      </div>
    )}
  </HudPage>
);

const Race = ({ race }: { race: NonNullable<AspectPageProps["race"]> }) => (
  <section data-aspect-race className="aspect-race-page__hero">
    {race.result && (
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Muted>{race.result.winner === null ? WORDS.noFinisher : WORDS.won(race.result.winner)}</Muted>
      </div>
    )}
    <AspectRaceCanvas standings={race.standings} finishHeight={race.finishHeight} />
    <AspectStandings standings={race.standings} finishHeight={race.finishHeight} stages={race.stages} />
  </section>
);

const YourAspect = ({ own, invite }: { own: OwnAspect; invite?: ReactNode }) => (
  <section data-aspect-own className="flex min-w-0 flex-col gap-2">
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
    {invite}
  </section>
);

const GloryBoard = ({ own }: { own: OwnAspect }) => {
  const ranked = usePartShown("glory");
  return (
    <section data-aspect-members className="aspect-glory-board" style={aspectVariables(own.aspectId) as CSSProperties}>
      <span className="aspect-glory-board__head">
        <span>{ranked ? WORDS.glory : WORDS.members}</span>
        <span>{aspectName(own.aspectId)}</span>
      </span>
      {own.members.map((member, index) => (
        <HudRow
          key={member.id}
          lead={ranked ? <b className="aspect-glory-board__rank">#{index + 1}</b> : <Icon name="realm" size={32} />}
          title={
            <span className="flex min-w-0 items-center gap-2">
              <i className="aspect-glory-board__dot" aria-hidden="true" />
              <span className="truncate">{member.realm}</span>
            </span>
          }
          selected={member.mine}
          trail={ranked && <GloryAmount glory={member.glory} />}
        />
      ))}
    </section>
  );
};

const GloryAmount = ({ glory }: { glory: number }) => (
  <span role="img" aria-label={`${WORDS.glory} ${formatExact(glory)}`} className="aspect-glory-board__glory">
    <Icon name="crown" size={16} />
    {formatExact(glory)}
  </span>
);

const Heading = ({ children }: { children: ReactNode }) => (
  <span className="text-hud-strong text-hud-ink">{children}</span>
);
const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-hud-label text-hud-muted">{children}</span>
);
