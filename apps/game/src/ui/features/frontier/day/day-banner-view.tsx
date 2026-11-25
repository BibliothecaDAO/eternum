import "./quest-card.css";

import { Icon } from "@/ui/design-system/icon";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudIconButton, HudLoading, HudMeter, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { CLOSE, DAY_BANNER_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { formatAmount, ResourcesIds } from "@bibliothecadao/types";

export interface DayQuestFace {
  icon: IconMeaning;
  name: string;
  unit: string;
  objective: string;
}

export interface DayQuestReading {
  progress: number;
  target: number;
  reward: { labor: number; essence: number };
  state: "running" | "done" | "collected" | "again";
}

export interface DayBannerProps {
  quest: DayQuestFace | null;
  reading: DayQuestReading | null;
  collecting: boolean;
  onCollect: () => void;
  onClose?: () => void;
}

export const DayBannerView = ({ quest, reading, collecting, onCollect, onClose }: DayBannerProps) => (
  <HudPanel label={WORDS.quest} collapsible={false} className="pointer-events-auto" bodyClassName="frontier-quest-card">
    {quest ? (
      <>
        <div className="frontier-quest-card__head">
          <Icon name={quest.icon} size={44} className="shrink-0" />
          <span className="frontier-quest-card__words">
            <span className="frontier-quest-card__title">{quest.name}</span>
            <span data-quest-objective className="frontier-quest-card__objective">
              {reading ? WORDS.objectiveLine(quest.objective, reading.target) : quest.objective}
            </span>
          </span>
          {reading && (
            <span
              data-quest-count
              className="frontier-quest-card__count"
              data-done={reading.state !== "running" || undefined}
              aria-label={WORDS.count(reading.progress, reading.target, quest.unit)}
            >
              {WORDS.fraction(reading.progress, reading.target)}
            </span>
          )}
          {onClose && <HudIconButton icon="close" label={CLOSE} kind="quiet" size="sm" onClick={onClose} />}
        </div>
        {reading ? (
          <>
            <HudMeter
              share={Math.min(1, reading.progress / reading.target)}
              label={WORDS.count(reading.progress, reading.target, quest.unit)}
            />
            <div className="frontier-quest-card__foot">
              <Amount resource={ResourcesIds.Labor} amount={reading.reward.labor} />
              <Amount resource={ResourcesIds.Essence} amount={reading.reward.essence} />
              <span className="flex-1" />
              <End state={reading.state} collecting={collecting} onCollect={onCollect} />
            </div>
          </>
        ) : (
          <HudLoading line={WORDS.reading} />
        )}
      </>
    ) : (
      <HudLoading line={WORDS.reading} />
    )}
  </HudPanel>
);

const Amount = ({ resource, amount }: { resource: ResourcesIds; amount: number }) => (
  <span
    data-reward={ResourcesIds[resource]}
    role="img"
    aria-label={WORDS.rewardAmount(amount, resource)}
    className="frontier-quest-card__reward"
  >
    <Icon name={resourceMeaning(resource)} size={18} />
    {formatAmount(amount)}
  </span>
);

const End = ({
  state,
  collecting,
  onCollect,
}: {
  state: DayQuestReading["state"];
  collecting: boolean;
  onCollect: () => void;
}) => {
  if (state === "running") return null;
  if (state === "collected")
    return (
      <span role="img" aria-label={WORDS.collected} className="shrink-0 text-hud-good">
        <Icon name="check" size={24} />
      </span>
    );
  return (
    <HudButton kind="primary" icon="reward" busy={collecting ? WORDS.collecting : undefined} onClick={onCollect}>
      {state === "again" ? WORDS.collectAgain : WORDS.collect}
    </HudButton>
  );
};
