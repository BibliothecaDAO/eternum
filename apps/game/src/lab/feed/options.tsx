import type { PlayerNames } from "@/hooks/use-player-profile";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudEventRow, HudIconButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { Portrait } from "@/ui/design-system/kit/portrait";
import { EVENTS_WORDS } from "@/ui/design-system/kit/words";
import { formatClockTime } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import type { FeedReading, FeedRun } from "./feed-reading";

export type FeedOption = "a" | "b" | "c";

/**
 * The Feed in every option (the owner, 26 Oct: "I should also be able to close the feed so I see nothing on the right
 * panel sometimes ? and feed height can be the same as the other panels"): it fills the rail as Research and the
 * Season do, and its × closes it; the Feed bubble at the foot opens it again.
 */
export const FeedPanel = ({ onClose, children }: { onClose: () => void; children: ReactNode }) => (
  <HudPanel
    label={EVENTS_WORDS.feed}
    title={EVENTS_WORDS.feed}
    icon="chronicles"
    collapsible={false}
    cue={
      <span className="inline-flex items-center gap-1">
        <span role="group" aria-label="Feed lens" className="inline-flex items-center gap-1">
          {(Object.keys(EVENTS_WORDS.lenses) as (keyof typeof EVENTS_WORDS.lenses)[]).map((id) => (
            <HudButton key={id} kind="quiet" size="sm" aria-pressed={id === "world"}>
              {EVENTS_WORDS.lenses[id]}
            </HudButton>
          ))}
        </span>
        <HudIconButton icon="close" label="Close the feed" kind="quiet" size="sm" onClick={onClose} />
      </span>
    }
    className="pointer-events-auto flex min-h-0 flex-1 flex-col"
    bodyClassName="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin"
  >
    {children}
  </HudPanel>
);

/** The rows of an option, over the same readings. */
export const FeedRows = ({
  option,
  readings,
  runs,
  names,
  viewer,
}: {
  option: FeedOption;
  readings: readonly FeedReading[];
  runs: readonly FeedRun[];
  names: PlayerNames;
  viewer: string;
}) => {
  const own = (address: string) => BigInt(address) === BigInt(viewer);
  if (option === "c")
    return (
      <div className="flex flex-col gap-2 py-1" data-feed-option="c">
        {runs.map((run) => (
          <RunCard key={run.readings[0]!.id} run={run} names={names} own={own(run.actor)} />
        ))}
      </div>
    );
  const Row = option === "a" ? NamedLine : StripLine;
  return (
    <div className="flex flex-col" data-feed-option={option}>
      {readings.map((reading) => (
        <Row key={reading.id} reading={reading} names={names} own={own(reading.actor)} />
      ))}
    </div>
  );
};

type RowProps = { reading: FeedReading; names: PlayerNames; own: boolean };

/** A: today's row, the player's name first, the act's painting in place of the castle, the reward at the end. */
const NamedLine = ({ reading, names, own }: RowProps) => (
  <HudEventRow
    time={formatClockTime(reading.at)}
    icon={reading.act}
    trail={reading.reward && <Reward reward={reading.reward} />}
  >
    <Name address={reading.actor} names={names} own={own} /> {reading.words ?? reading.verb}
    {reading.object && (
      <>
        {" "}
        <ObjectName object={reading.object} names={names} />
      </>
    )}
    {reading.outcome && <Outcome outcome={reading.outcome} />}
  </HudEventRow>
);

/** B: who (their face and name), the act as a painting, what it was done to as a painting, then what came of it. */
const StripLine = ({ reading, names, own }: RowProps) => (
  <div
    className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2 border-b border-hud-line py-1.5 last:border-0"
    data-feed-row
  >
    <span className="text-hud-label tabular-nums text-hud-muted">{formatClockTime(reading.at)}</span>
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <Face address={reading.actor} names={names} own={own} size={24} />
      <Icon name={reading.act} size={28} alt={reading.verb || "did"} data-tip={reading.verb} />
      {reading.words && <span className="min-w-0 text-hud-body text-hud-ink">{reading.words}</span>}
      {reading.object && <ObjectName object={reading.object} names={names} size={28} />}
      {reading.outcome && <Outcome outcome={reading.outcome} />}
      {reading.reward && (
        <span className="ml-auto">
          <Reward reward={reading.reward} />
        </span>
      )}
    </span>
  </div>
);

/** C: one card per run of a player's play, newest first. */
const RunCard = ({ run, names, own }: { run: FeedRun; names: PlayerNames; own: boolean }) => {
  const newest = formatClockTime(run.readings[0]!.at);
  const oldest = formatClockTime(run.readings.at(-1)!.at);
  return (
    <article className="rounded-md border border-hud-line bg-hud-well px-2.5 py-2" data-feed-run>
      <header className="flex items-center gap-2">
        <Face address={run.actor} names={names} own={own} size={28} />
        <span className="ml-auto text-hud-label tabular-nums text-hud-muted">
          {oldest === newest ? newest : `${oldest}–${newest}`}
        </span>
      </header>
      <ul className="mt-1.5 flex flex-col gap-1 pl-9">
        {run.explored.count > 0 && (
          <li className="flex flex-wrap items-center gap-2 text-hud-body text-hud-ink">
            <Icon name="explore" size={20} />
            explored {run.explored.count === 1 ? "a tile" : `${run.explored.count} tiles`}
            {run.explored.rewards.map((reward) => (
              <Reward key={reward.name} reward={reward} />
            ))}
          </li>
        )}
        {run.acts.map((act) => (
          <li key={act.id} className="flex flex-wrap items-center gap-2 text-hud-body text-hud-ink">
            <Icon name={act.act} size={20} />
            {act.words ?? act.verb}
            {act.object && <ObjectName object={act.object} names={names} size={20} />}
            {act.outcome && <Outcome outcome={act.outcome} />}
            {act.reward && <Reward reward={act.reward} />}
          </li>
        ))}
      </ul>
    </article>
  );
};

/** A player's name, read the one way (usePlayerNames); the viewer's own in gold. */
const Name = ({ address, names, own }: { address: string; names: PlayerNames; own: boolean }) => (
  <strong className={own ? "text-hud-gold" : "text-hud-ink"}>{names.text(address)}</strong>
);

/** A player's face and name. */
const Face = ({ address, names, own, size }: { address: string; names: PlayerNames; own: boolean; size: number }) => {
  const profile = names.profile(address);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Portrait
        account={address}
        portrait={profile.portrait}
        pending={!profile.known}
        size={size}
        weight={1.5}
        ring={own ? "lit" : "line"}
      />
      <Name address={address} names={names} own={own} />
    </span>
  );
};

/** What an act was done to: a site with its guard's painting, an army, an attribute, or another player. */
const ObjectName = ({
  object,
  names,
  size = 16,
}: {
  object: NonNullable<FeedReading["object"]>;
  names: PlayerNames;
  size?: number;
}) => (
  <span className="inline-flex items-center gap-1 align-middle">
    {object.icon && <Icon name={object.icon} size={size} />}
    <span className="text-hud-ink">{"player" in object ? names.text(object.player) : object.name}</span>
  </span>
);

const OUTCOME_TONES = { good: "text-hud-good", bad: "text-hud-bad", neutral: "text-hud-muted" } as const;

const Outcome = ({ outcome }: { outcome: NonNullable<FeedReading["outcome"]> }) => (
  <span className={OUTCOME_TONES[outcome.tone]}> · {outcome.word}</span>
);

/** A reward, whole: its resource's painting and amount. */
const Reward = ({ reward }: { reward: NonNullable<FeedReading["reward"]> }) => (
  <span className="inline-flex items-center gap-1 text-hud-body tabular-nums text-hud-ink" data-tip={reward.name}>
    <Icon name={reward.icon} size={16} alt={reward.name} />
    {reward.amount}
  </span>
);
