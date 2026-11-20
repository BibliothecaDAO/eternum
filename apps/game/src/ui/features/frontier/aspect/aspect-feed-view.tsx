import { Icon } from "@/ui/design-system/icon";
import { HudChip, HudLoading, HudNotice, HudRow } from "@/ui/design-system/kit/hud-elements";
import { ASPECT_PAGE_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { formatDuration } from "@bibliothecadao/types";
import { type AspectFight, type FightSide, wipedOut } from "./aspect-feed";
import type { AspectFeedReading } from "./use-aspect-fights";

/** The Aspect's fights in the Deep, newest first, each with how it ended, the troops it cost and any wipe-out. */
export const AspectFeedView = ({ reading, now }: { reading: AspectFeedReading; now: number }) => (
  <section data-aspect-feed className="flex flex-col gap-1">
    <h3 className="text-hud-strong text-hud-ink">{WORDS.fights}</h3>
    {reading.status === "loading" && <HudLoading line={WORDS.readingFights} />}
    {reading.status === "failed" && <HudNotice tone="bad" line={WORDS.fightsFailed} retry={reading.retry} />}
    {reading.status === "ready" && reading.fights.length === 0 && (
      <span className="text-hud-label text-hud-muted">{WORDS.noFights}</span>
    )}
    {reading.status === "ready" && reading.fights.map((fight) => <FightRow key={fight.id} fight={fight} now={now} />)}
  </section>
);

const lost = (side: FightSide) => side.before - side.after;

const FightRow = ({ fight, now }: { fight: AspectFight; now: number }) => {
  const { attacker, defender, outcome } = fight;
  const title =
    outcome === "attacker"
      ? WORDS.fight(attacker.aspect, defender.aspect)
      : outcome === "defender"
        ? WORDS.fight(defender.aspect, attacker.aspect)
        : outcome === "standoff"
          ? WORDS.standoff(attacker.aspect, defender.aspect)
          : WORDS.mutual(attacker.aspect, defender.aspect);
  return (
    <HudRow
      lead={<Icon name="attack" size={32} />}
      title={title}
      detail={
        <span className="flex flex-col gap-1">
          <span>{WORDS.fightLosses(attacker.aspect, lost(attacker), defender.aspect, lost(defender))}</span>
          <span className="flex flex-wrap items-center gap-1">
            {[attacker, defender].filter(wipedOut).map((side) => (
              <HudChip key={side.aspect} icons={["military"]} tone="bad">
                {WORDS.wiped(side.aspect)}
              </HudChip>
            ))}
          </span>
        </span>
      }
      trail={
        <span className="text-hud-label tabular-nums text-hud-muted">
          {formatDuration(Math.max(0, now - fight.at))}
        </span>
      }
    />
  );
};
