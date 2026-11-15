import { Icon } from "@/ui/design-system/icon";
import { HudChip, HudRow } from "@/ui/design-system/kit/hud-elements";
import { ASPECT_PAGE_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { formatDuration } from "@bibliothecadao/types";
import { type AspectFight, wipedOut } from "./aspect-feed";

/** The Aspect's fights in the Deep, newest first, each with who won, the troops it cost the loser and any wipe-out. */
export const AspectFeedView = ({ fights, now }: { fights: readonly AspectFight[]; now: number }) => (
  <section data-aspect-feed className="flex flex-col gap-1">
    <h3 className="text-hud-strong text-hud-ink">{WORDS.fights}</h3>
    {fights.length === 0 && <span className="text-hud-label text-hud-muted">{WORDS.noFights}</span>}
    {fights.map((fight) => {
      const [winner, loser] = fight.attackerWon ? [fight.attacker, fight.defender] : [fight.defender, fight.attacker];
      return (
        <HudRow
          key={fight.id}
          lead={<Icon name="attack" size={32} />}
          title={WORDS.fight(winner.aspect, loser.aspect)}
          detail={WORDS.fightLoss(loser.before - loser.after)}
          trail={
            <span className="flex items-center gap-1">
              {wipedOut(loser) && (
                <HudChip icons={["military"]} tone="bad">
                  {WORDS.wiped(loser.aspect)}
                </HudChip>
              )}
              <span className="text-hud-label tabular-nums text-hud-muted">
                {formatDuration(Math.max(0, now - fight.at))}
              </span>
            </span>
          }
        />
      );
    })}
  </section>
);
