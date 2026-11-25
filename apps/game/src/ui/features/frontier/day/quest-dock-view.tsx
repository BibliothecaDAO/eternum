import "./quest-dock.css";

import { Icon } from "@/ui/design-system/icon";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudLoading, HudMeter } from "@/ui/design-system/kit/hud-elements";
import { DAY_BANNER_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { type AspectId, formatAmount, ResourcesIds } from "@bibliothecadao/types";

import { EmissaryCard, EmissaryOk } from "../tutorial/aspect-emissary-dock";
import type { BaneFace } from "./bane-face";

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

export interface BaneStanding extends BaneFace {
  breaking: string;
  clears: string;
}

export interface QuestDockProps {
  layout: "desktop" | "phone";
  speaker: AspectId;
  quest: DayQuestFace | null;
  reading: DayQuestReading | null;
  bane: BaneStanding | null;
  collecting: boolean;
  onCollect: () => void;
  onClose: () => void;
}

export const QuestDockView = ({
  layout,
  speaker,
  quest,
  reading,
  bane,
  collecting,
  onCollect,
  onClose,
}: QuestDockProps) => {
  const title = bane ? bane.title : quest ? questTitle(quest, layout) : WORDS.quest;
  const count = reading && !bane && (
    <span
      data-quest-count
      className="quest-dock__count"
      data-done={reading.state !== "running" || undefined}
      aria-label={quest ? WORDS.count(reading.progress, reading.target, quest.unit) : undefined}
    >
      {WORDS.fraction(reading.progress, reading.target)}
    </span>
  );
  return (
    <EmissaryCard
      aspectId={speaker}
      layout={layout}
      label={title}
      title={title}
      tone={bane ? "bane" : undefined}
      picture={bane?.painting}
      className="quest-dock"
      attributes={{ "data-daily-quest": "", "data-quest-layout": layout }}
      controls={
        <>
          {count}
          <EmissaryOk onClose={onClose} />
        </>
      }
    >
      {bane && <BaneLine bane={bane} />}
      {quest && reading ? (
        <>
          <QuestLine quest={quest} reading={reading} named={bane !== null} />
          <HudMeter
            share={Math.min(1, reading.progress / reading.target)}
            label={WORDS.count(reading.progress, reading.target, quest.unit)}
          />
          <span className="quest-dock__foot">
            <Amount resource={ResourcesIds.Labor} amount={reading.reward.labor} />
            <Amount resource={ResourcesIds.Essence} amount={reading.reward.essence} />
            <span className="flex-1" />
            <End
              state={reading.state}
              size={layout === "phone" ? "sm" : "md"}
              collecting={collecting}
              onCollect={onCollect}
            />
          </span>
        </>
      ) : (
        <HudLoading line={WORDS.reading} />
      )}
    </EmissaryCard>
  );
};

const questTitle = (quest: DayQuestFace, layout: QuestDockProps["layout"]) =>
  layout === "phone" ? quest.name : WORDS.questTitle(quest.name);

const BaneLine = ({ bane }: { bane: BaneStanding }) => (
  <span className="quest-dock__bane" data-bane-row>
    <span className="quest-dock__effect" data-tip={bane.effect} aria-label={bane.effect} role="img">
      <Icon name="flame" size={14} />
      {bane.chip}
    </span>
    {bane.doubles && <span className="quest-dock__twice">{WORDS.twiceIfBroken}</span>}
    <span className="quest-dock__break">
      {bane.breaking} · {bane.clears}
    </span>
  </span>
);

const QuestLine = ({ quest, reading, named }: { quest: DayQuestFace; reading: DayQuestReading; named: boolean }) => {
  const objective = WORDS.objectiveLine(quest.objective, reading.target);
  return (
    <span data-quest-objective className="quest-dock__objective">
      {named ? (
        <>
          <Icon name={quest.icon} size={20} className="quest-dock__quest-icon" />
          <span>
            <strong>{quest.name}</strong> · {objective} ({WORDS.fraction(reading.progress, reading.target)})
          </span>
        </>
      ) : (
        <span>{objective}</span>
      )}
    </span>
  );
};

const Amount = ({ resource, amount }: { resource: ResourcesIds; amount: number }) => (
  <span
    data-reward={ResourcesIds[resource]}
    role="img"
    aria-label={WORDS.rewardAmount(amount, resource)}
    className="quest-dock__reward"
  >
    <Icon name={resourceMeaning(resource)} size={18} />
    {formatAmount(amount)}
  </span>
);

const End = ({
  state,
  size,
  collecting,
  onCollect,
}: {
  state: DayQuestReading["state"];
  size: "sm" | "md";
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
    <HudButton
      kind="primary"
      size={size}
      icon="reward"
      busy={collecting ? WORDS.collecting : undefined}
      onClick={onCollect}
    >
      {state === "again" ? WORDS.collectAgain : WORDS.collect}
    </HudButton>
  );
};
