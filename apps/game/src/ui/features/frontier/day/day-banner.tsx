import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { questMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudLoading, HudMeter, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { QUEST_WORDS } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { readDailyQuest } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatAmount, ResourcesIds } from "@bibliothecadao/types";

const QUEST_MODELS = [
  "QuestRules",
  "QuestProgress",
  "LaborGrant",
  "Structure",
  "CampaignHome",
  "SettledRealm",
  "GameRegistry",
  "SliceRules",
] as const;

/** Today's quest as the banner shows it: what it asks, and its reading (how far, what it pays, whether it was paid). */
type DayQuest = NonNullable<ReturnType<typeof readDailyQuest>>;
type QuestReading = NonNullable<DayQuest["reading"]["known"]>;

/** The home's quest today, from the native facts; none in a game without quests or outside its days. */
const useDayQuest = (realm: NativeRows["Structure"]): DayQuest | undefined => {
  const { setup } = useGame();
  useNativeRevision(QUEST_MODELS);
  return readDailyQuest(setup.store, realm.game_id, safeInteger(realm.entity_id), useNowSeconds());
};

/**
 * The day's banner (U1) over the player's own realm: today's quest with its painting and name, its count ("1 of 2
 * camps") over a meter, and its reward. Collect sends the reward once the quest is done; the banner then says it was
 * collected. While the snapshot has not settled the home's progress, receipt or bonus, the banner says it is reading
 * them and offers nothing to press. Nothing in a game without quests.
 */
export const FrontierDayBanner = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup, account } = useGame();
  const quest = useDayQuest(realm);
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
  return <DayQuestBanner quest={quest} collecting={collecting} onCollect={collect} />;
};

/** The banner's drawing, from its reading. */
const DayQuestBanner = ({
  quest,
  collecting,
  onCollect,
}: {
  quest: DayQuest;
  collecting: boolean;
  onCollect: () => unknown;
}) => {
  const reading = quest.reading.known;
  return (
    <HudPanel
      label={QUEST_WORDS.today}
      collapsible={false}
      className="pointer-events-auto"
      bodyClassName="flex items-center gap-3"
    >
      <Icon name={questMeaning(quest.id)} size={44} />
      {reading ? (
        <>
          <QuestProgress quest={quest} reading={reading} />
          <QuestEnd reading={reading} collecting={collecting} onCollect={onCollect} />
        </>
      ) : (
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-hud-strong text-hud-ink">{quest.name}</span>
          <HudLoading line={QUEST_WORDS.reading} />
        </span>
      )}
    </HudPanel>
  );
};

/** The quest's name, its count over a meter, and its reward. */
const QuestProgress = ({ quest, reading }: { quest: DayQuest; reading: QuestReading }) => {
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

/** The banner's end: Collect once the quest is done, its check once collected, nothing while it runs. */
const QuestEnd = ({
  reading,
  collecting,
  onCollect,
}: {
  reading: QuestReading;
  collecting: boolean;
  onCollect: () => unknown;
}) => {
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
