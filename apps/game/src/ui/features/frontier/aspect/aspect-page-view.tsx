import { Icon } from "@/ui/design-system/icon";
import { HudChip, HudMeter, HudPage, HudRow } from "@/ui/design-system/kit/hud-elements";
import { ASPECT_PAGE_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { formatExact, formatShort } from "@bibliothecadao/types";
import type { ReactNode } from "react";

/** One Aspect's hyperstructure in the race: its place, name, height and the stage being built. */
export interface AspectStanding {
  aspect: string;
  rank: number;
  height: number;
  stage: number;
  finished: boolean;
  own: boolean;
}

/** A Triumph of the player's Aspect: its stage (1 to 4), and the game day it fell on, or null while its stage is unbuilt. */
export interface AspectTriumph {
  stage: keyof typeof WORDS.triumph;
  day: number | null;
}

/** A member of the player's Aspect: its realm, its Glory and the Deep site its army guards today, if any. */
export interface AspectMember {
  id: string;
  realm: string;
  mine: boolean;
  glory: number;
  guards: string | null;
}

export interface OwnAspect {
  aspect: string;
  triumphs: readonly AspectTriumph[];
  bar: { charge: number; threshold: number } | null;
  /** Ranked by Glory, the highest first. */
  members: readonly AspectMember[];
}

export interface AspectPageProps {
  /** Null while the race's facts are not settled. */
  race: {
    standings: readonly AspectStanding[];
    finishHeight: number;
    stages: number;
    /** The Aspect that finished first and ended the age. */
    winner: string | null;
  } | null;
  /** The player's own Aspect; null for a player with none. */
  own: OwnAspect | null;
  /** The Aspect's fights, under its members. */
  fights?: ReactNode;
  onClose: () => void;
}

/**
 * The Aspect page (one job: how the Aspects stand in the race, and what the player's own is doing): the hyperstructures
 * ranked, each with its height and stage; then the player's Aspect, its Triumphs, its bane bar and its members by Glory
 * with the site each guards today.
 */
export const AspectPageView = ({ race, own, fights, onClose }: AspectPageProps) => (
  <HudPage label={WORDS.title} icon="hyperstructure" onClose={onClose} bodyClassName="gap-3">
    {race === null ? (
      <Muted>{WORDS.reading}</Muted>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <Race race={race} />
        {own ? <YourAspect own={own} /> : <Muted>{WORDS.noAspect}</Muted>}
        {own && fights}
      </div>
    )}
  </HudPage>
);

const Race = ({ race }: { race: NonNullable<AspectPageProps["race"]> }) => (
  <section data-aspect-race className="flex flex-col gap-1">
    <Heading>{WORDS.race}</Heading>
    {race.winner !== null && <Muted>{WORDS.won(race.winner)}</Muted>}
    {race.standings.map((standing) => (
      <StandingRow key={standing.aspect} standing={standing} race={race} />
    ))}
  </section>
);

const StandingRow = ({
  standing,
  race,
}: {
  standing: AspectStanding;
  race: NonNullable<AspectPageProps["race"]>;
}) => {
  const height = WORDS.height(standing.height, race.finishHeight);
  return (
    <HudRow
      lead={<span className="w-6 text-center text-hud-strong text-hud-ink">{formatExact(standing.rank)}</span>}
      title={standing.aspect}
      selected={standing.own}
      detail={
        <span className="flex flex-col gap-0.5">
          <span>
            {standing.finished ? WORDS.finished : WORDS.stage(standing.stage, race.stages)} · {height}
          </span>
          <HudMeter label={height} share={standing.height / race.finishHeight} />
        </span>
      }
    />
  );
};

const YourAspect = ({ own }: { own: OwnAspect }) => (
  <section data-aspect-own className="flex flex-col gap-2">
    <Heading>{WORDS.yours(own.aspect)}</Heading>
    <div data-aspect-triumphs className="flex flex-wrap items-center gap-1">
      <Muted>{WORDS.triumphs}:</Muted>
      {own.triumphs.map(({ stage, day }) => (
        <HudChip key={stage} icons={["star"]} tone={day === null ? undefined : "good"}>
          {WORDS.triumph[stage]} · {day === null ? WORDS.triumphAt(stage) : WORDS.triumphOn(day)}
        </HudChip>
      ))}
    </div>
    {own.bar && (
      <div data-aspect-bane className="flex flex-col gap-0.5">
        <Muted>
          {WORDS.baneBar}: {WORDS.baneCharge(own.bar.charge, own.bar.threshold)}
        </Muted>
        <HudMeter label={WORDS.baneBar} share={own.bar.charge / own.bar.threshold} />
      </div>
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
            <HudChip icons={["crown"]} label={WORDS.glory}>
              {formatShort(member.glory)}
            </HudChip>
          }
        />
      ))}
    </div>
  </section>
);

const Heading = ({ children }: { children: ReactNode }) => <span className="text-hud-strong text-hud-ink">{children}</span>;
const Muted = ({ children }: { children: ReactNode }) => <span className="text-hud-label text-hud-muted">{children}</span>;
