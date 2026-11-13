import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { BANE_MEANING, questMeaning, triumphMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudLoading, HudMeter, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { BANE_WORDS, QUEST_WORDS, TRIUMPH_WORDS } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { useOpens } from "../opening/use-opening";
import { readDailyQuest, readTodaysTriumph } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { aspectName, formatAmount, ResourcesIds, worldBanes } from "@bibliothecadao/types";

export const QUEST_MODELS = [
  "QuestRules",
  "QuestProgress",
  "LaborGrant",
  "Structure",
  "CampaignHome",
  "SettledRealm",
  "GameRegistry",
  "SliceRules",
  "HomeAspect",
  "BaneRules",
  "FirstTeamBane",
  "TeamBane",
  "AspectActivity",
  "BaneProgress",
  "BaneGrant",
] as const;

/** Today's quest as the banner shows it: what it asks, and its reading (how far, what it pays, whether it was paid). */
type DayQuest = NonNullable<ReturnType<typeof readDailyQuest>>;
type QuestReading = NonNullable<DayQuest["reading"]["known"]>;
type BaneReading = NonNullable<QuestReading["bane"]>;

/** The models the Triumph's reading stands on: the race's rules and days, the home's Aspect and the season's calendar. */
const TRIUMPH_MODELS = [
  "RaceRules",
  "TriumphDay",
  "HomeAspect",
  "GameRegistry",
  "SliceRules",
  "SettlementRules",
] as const;

/** The home's Aspect's Triumph today; none in a game without the race. */
const useTodaysTriumph = (realm: NativeRows["Structure"]) => {
  const { setup } = useGame();
  useNativeRevision(TRIUMPH_MODELS);
  return readTodaysTriumph(setup.store, realm.game_id, safeInteger(realm.entity_id), useNowSeconds());
};

/** The home's quest today, from the native facts; none in a game without quests or outside its days. */
const useDayQuest = (realm: NativeRows["Structure"]): DayQuest | undefined => {
  const { setup } = useGame();
  useNativeRevision(QUEST_MODELS);
  return readDailyQuest(setup.store, realm.game_id, safeInteger(realm.entity_id), useNowSeconds());
};

/**
 * The day's banner (U1) over the player's own realm: today's quest with its painting and name, its count ("1 of 2
 * camps") over a meter, and its reward. On a bane day the quest is the bane quest, and the bane stands under it with
 * how far the Aspect is at ending it ("4 of 6 finished"). Collect sends the reward once the quest is done; once the
 * Aspect ended a world bane it is offered again, for the second reward. While the snapshot has not settled a row the
 * day rests on, the banner says it is reading and offers nothing to press. On a day the home's Aspect has a Triumph,
 * its painting, name and what it does today stand under the quest. Nothing in a game without quests.
 */
export const FrontierDayBanner = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup, account } = useGame();
  const quest = useDayQuest(realm);
  const triumph = useTodaysTriumph(realm);
  const home = safeInteger(realm.entity_id);
  const collecting = useInFlight("quest", home) !== undefined;
  if (!quest) return null;
  const collect = async () => {
    const signer = account.account;
    if (!signer) return;
    try {
      await sendOnce("quest", home, true, () => setup.systemCalls.claim_daily_quest({ signer, home, day: quest.day }));
    } catch (error) {
      toast.failed(error, QUEST_WORDS.notCollected);
    }
  };
  return <DayQuestBanner quest={quest} triumph={triumph} collecting={collecting} onCollect={collect} />;
};

/** The banner's drawing, from its reading. */
const DayQuestBanner = ({
  quest,
  triumph,
  collecting,
  onCollect,
}: {
  quest: DayQuest;
  triumph: TriumphReading | undefined;
  collecting: boolean;
  onCollect: () => unknown;
}) => {
  const reading = quest.reading.known;
  const showsBane = useOpens("bane-row");
  return (
    <HudPanel
      label={QUEST_WORDS.today}
      collapsible={false}
      className="pointer-events-auto"
      bodyClassName="flex flex-col gap-2"
    >
      {quest.quest ? (
        <span className="flex items-center gap-3">
          <Icon name={questMeaning(quest.quest.id)} size={44} />
          {reading ? (
            <>
              <QuestProgress quest={quest.quest} reading={reading} />
              <QuestEnd reading={reading} collecting={collecting} onCollect={onCollect} />
            </>
          ) : (
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-hud-strong text-hud-ink">{quest.quest.name}</span>
              <HudLoading line={QUEST_WORDS.reading} />
            </span>
          )}
        </span>
      ) : (
        <HudLoading line={QUEST_WORDS.reading} />
      )}
      {reading?.bane && showsBane && <BaneRow bane={reading.bane} />}
      {triumph && <TriumphRow triumph={triumph} />}
    </HudPanel>
  );
};

type TriumphReading = NonNullable<ReturnType<typeof readTodaysTriumph>>;

/** Today's Triumph, by name, with what it does; nothing on a day without one, a reading line while it is not known. */
const TriumphRow = ({ triumph }: { triumph: TriumphReading }) => {
  if (triumph.unknown !== undefined) return <HudLoading line={TRIUMPH_WORDS.reading} />;
  if (triumph.known === null) return null;
  const { stage, percent } = triumph.known;
  return (
    <span className="flex items-center gap-3 border-t border-hud-line pt-2" data-tip={TRIUMPH_WORDS.where}>
      <Icon name={triumphMeaning(stage)} size={32} />
      <span className="flex min-w-0 flex-col">
        <span className="text-hud-strong text-hud-gold">{TRIUMPH_WORDS.names[stage]}</span>
        <span className="text-hud-label text-hud-ink">{TRIUMPH_WORDS.effects[stage](percent)}</span>
      </span>
    </span>
  );
};

/**
 * The bane over the Aspect's day: the mist's by name or a rival's by its sender, and how far the Aspect is at ending it
 * ("4 of 6 finished") or what ending it brought. Its look waits on the owner's pick (eternum/s1-banner).
 */
const BaneRow = ({ bane }: { bane: BaneReading }) => (
  <span className="flex items-center gap-3 border-t border-hud-line pt-2">
    <Icon name={BANE_MEANING} size={32} />
    <span className="flex min-w-0 flex-col">
      <span className="text-hud-strong text-hud-ink">{baneName(bane)}</span>
      <span className="text-hud-label text-hud-muted">
        {bane.won
          ? bane.source === "world"
            ? BANE_WORDS.worldEnded
            : BANE_WORDS.teamEnded
          : BANE_WORDS.finished(bane.completed, bane.required)}
      </span>
    </span>
  </span>
);

const baneName = (bane: BaneReading): string => {
  if (bane.source === "team") return BANE_WORDS.team(aspectName(bane.sender!));
  const world = worldBanes.find(({ id }) => id === bane.kind);
  if (!world) throw new Error(`Unknown world bane ${bane.kind}`);
  return world.name;
};

/** The quest's name, its count over a meter, and its reward. */
const QuestProgress = ({ quest, reading }: { quest: NonNullable<DayQuest["quest"]>; reading: QuestReading }) => {
  const count = QUEST_WORDS.count(quest.id, reading.progress, reading.target);
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-hud-strong text-hud-ink">{quest.name}</span>
        <span className="shrink-0 text-hud-label tabular-nums text-hud-muted">{count}</span>
      </span>
      <HudMeter share={Math.min(1, Number(reading.progress) / Number(reading.target))} label={count} />
      <span className="flex items-center gap-3 text-hud-label tabular-nums text-hud-ink">
        <Reward resource={ResourcesIds.Labor} amount={reading.reward.labor} />
        <Reward resource={ResourcesIds.Essence} amount={reading.reward.essence} />
      </span>
    </span>
  );
};

const Reward = ({ resource, amount }: { resource: ResourcesIds; amount: bigint }) => (
  <span className="flex items-center gap-1">
    <Icon name={resourceMeaning(resource)} size={20} />
    {formatAmount(Number(amount))}
  </span>
);

/**
 * The banner's end: Collect once the quest is done, its check once collected, nothing while it runs; Collect again
 * once the Aspect ended a world bane whose second reward is still to collect.
 */
const QuestEnd = ({
  reading,
  collecting,
  onCollect,
}: {
  reading: QuestReading;
  collecting: boolean;
  onCollect: () => unknown;
}) => {
  if (reading.claimed && secondRewardDue(reading.bane))
    return (
      <HudButton kind="primary" size="sm" busy={collecting ? QUEST_WORDS.collecting : undefined} onClick={onCollect}>
        {QUEST_WORDS.collectAgain}
      </HudButton>
    );
  if (reading.claimed)
    return (
      <span role="img" aria-label={QUEST_WORDS.collected} className="shrink-0 text-hud-good">
        <Icon name="check" size={24} />
      </span>
    );
  if (!reading.completed) return null;
  return (
    <HudButton kind="primary" size="sm" busy={collecting ? QUEST_WORDS.collecting : undefined} onClick={onCollect}>
      {QUEST_WORDS.collect}
    </HudButton>
  );
};

/** A world bane the Aspect ended pays the quest's reward again; due until its second grant (BaneGrant) is recorded. */
const secondRewardDue = (bane: BaneReading | null): boolean =>
  bane?.source === "world" && bane.won && bane.secondClaimed === false;
