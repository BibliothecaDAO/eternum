import "./aspect-page-view.css";

import { OpeningPartGate } from "../opening/opening-context";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudMeter, HudPage, HudRow, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { ASPECT_PAGE_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { ASPECT_REWARD, aspectName, formatShort, type AspectId } from "@bibliothecadao/types";
import type { ReactNode } from "react";
import { AspectRaceCanvas } from "./aspect-race-canvas";
import { AspectStandings } from "./aspect-standings";

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
  onGoToDeep?: () => void;
  onClose: () => void;
}

export const AspectPageView = ({ race, own, fights, invite, onGoToDeep, onClose }: AspectPageProps) => {
  const rewardChip = (
    <HudChip icons={["lords"]}>
      {WORDS.rateChip(ASPECT_REWARD.lordsPerHeight, formatShort(ASPECT_REWARD.finishBonus))}
    </HudChip>
  );
  return (
    <HudPage label={WORDS.title} icon="victory" cue={rewardChip} fills onClose={onClose} bodyClassName="gap-3">
      {race === null ? (
        <Muted>{WORDS.reading}</Muted>
      ) : (
        <div data-aspect-race-page className="aspect-race-page">
          <Race race={race} />
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
};

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
    {invite}
  </section>
);

const Heading = ({ children }: { children: ReactNode }) => (
  <span className="text-hud-strong text-hud-ink">{children}</span>
);
const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-hud-label text-hud-muted">{children}</span>
);
