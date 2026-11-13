import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { BANE_MEANING, questMeaning, triumphMeaning } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon";
import { Icon } from "@/ui/design-system/icon";
import { orderMeaning, resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudChip, HudLoading, HudMeter, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { useLayout } from "@/shell/frame/layout";
import { useState } from "react";
import { RealmsChip } from "../value/lords-purse";
import type { DailyClaimWaiting } from "../value/realm-labor";
import { BANE_WORDS, QUEST_WORDS, TRIUMPH_WORDS } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { useOpens } from "../opening/use-opening";
import { readDailyQuest, readTodaysTriumph, type TriumphStage } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { aspectName, formatAmount, formatExact, orders, ResourcesIds, worldBanes } from "@bibliothecadao/types";

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

/** Whether the day's banner stands for the realm (a game with quests, inside its days): it then holds the daily claim. */
export const useDayBannerStands = (realm: NativeRows["Structure"] | null): boolean => {
  const { setup } = useGame();
  useNativeRevision(QUEST_MODELS);
  const now = useNowSeconds();
  return realm !== null && readDailyQuest(setup.store, realm.game_id, safeInteger(realm.entity_id), now) !== undefined;
};

/** The home's daily claim as the banner holds it: what waits today, and the press that opens Realms. */
interface DayClaim {
  waiting: DailyClaimWaiting | null;
  onOpen: () => void;
}

/**
 * The day's banner (U1) over the player's own realm: today's quest with its painting and name, its count ("1 of 2
 * camps") over a meter, and its reward. On a bane day the quest is the bane quest, the bane heads the panel and how far
 * the Aspect is at ending it ("4 of 6 members") closes it. Collect sends the reward once the quest is done; once the
 * Aspect ended a world bane it is offered again, for the second reward. While the snapshot has not settled a row the
 * day rests on, the banner says it is reading and offers nothing to press. On a day the home's Aspect has a Triumph,
 * it heads the panel with its name and what it does today. The home's daily claim (the Labor and Essence waiting
 * today, which opens Realms) sits in the panel's foot. A phone gets the lighter panel (PhoneDay). Nothing in a game
 * without quests.
 */
export const FrontierDayBanner = ({ realm, claim }: { realm: NativeRows["Structure"]; claim: DayClaim }) => {
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
  return (
    <DayQuestBanner
      gameId={realm.game_id}
      quest={quest}
      triumph={triumph}
      collecting={collecting}
      onCollect={collect}
      claim={claim}
    />
  );
};

type TriumphReading = NonNullable<ReturnType<typeof readTodaysTriumph>>;

/** The banner's drawing (the owner's pick A): the day's news heads the panel, the quest and its members follow. */
const DayQuestBanner = ({
  gameId,
  quest,
  triumph,
  collecting,
  onCollect,
  claim,
}: {
  gameId: number;
  quest: DayQuest;
  triumph: TriumphReading | undefined;
  collecting: boolean;
  onCollect: () => unknown;
  claim: DayClaim;
}) => {
  const { setup } = useGame();
  const phone = useLayout() === "phone";
  const reading = quest.reading.known;
  const showsBane = useOpens("bane-row");
  const heads = [
    ...(reading?.bane && showsBane ? [baneHead(reading.bane, setup.store.get("BaneRules", { game_id: gameId }))] : []),
    ...(triumph?.known ? [triumphHead(triumph.known)] : []),
  ];
  if (phone)
    return (
      <PhoneDay
        quest={quest}
        heads={heads}
        reading={reading}
        triumphReading={triumph?.unknown !== undefined}
        showsBane={showsBane}
        collecting={collecting}
        onCollect={onCollect}
        claim={claim}
      />
    );
  return (
    <HudPanel
      label={QUEST_WORDS.today}
      collapsible={false}
      className="pointer-events-auto"
      bodyClassName="flex flex-col gap-2"
    >
      {heads.map((head) => (
        <DayHead key={head.eyebrow} head={head} />
      ))}
      {triumph?.unknown !== undefined && <HudLoading line={TRIUMPH_WORDS.reading} />}
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
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1">{reading?.bane && showsBane && <Members bane={reading.bane} />}</span>
        <RealmsChip waiting={claim.waiting} onOpen={claim.onOpen} />
      </span>
    </HudPanel>
  );
};

/**
 * A phone's panel, lighter than the desktop's (the owner: it overloads the screen): the quest on one row with its meter,
 * one foot row (the rewards, how many members, the claim waiting), and the day's news as chips: the bane and the
 * Triumph by name, each opening its line on a press. Nothing in the head blocks the desktop panel draws.
 */
const PhoneDay = ({
  quest,
  heads,
  reading,
  triumphReading,
  showsBane,
  collecting,
  onCollect,
  claim,
}: {
  quest: DayQuest;
  heads: Head[];
  reading: QuestReading | undefined;
  triumphReading: boolean;
  showsBane: boolean;
  collecting: boolean;
  onCollect: () => unknown;
  claim: DayClaim;
}) => {
  const [open, setOpen] = useState<string | null>(null);
  const opened = heads.find((head) => head.eyebrow === open);
  const count = quest.quest && reading ? QUEST_WORDS.count(quest.quest.id, reading.progress, reading.target) : null;
  return (
    <HudPanel
      label={QUEST_WORDS.today}
      collapsible={false}
      className="pointer-events-auto"
      bodyClassName="flex flex-col gap-1.5"
    >
      <span className="flex items-center gap-2">
        {quest.quest && <Icon name={questMeaning(quest.quest.id)} size={32} />}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-hud-strong text-hud-ink">{quest.quest?.name ?? QUEST_WORDS.reading}</span>
            {count && <span className="shrink-0 text-hud-label tabular-nums text-hud-muted">{count}</span>}
          </span>
          {reading ? (
            <HudMeter share={Math.min(1, Number(reading.progress) / Number(reading.target))} label={count ?? ""} />
          ) : (
            <HudLoading line={QUEST_WORDS.reading} />
          )}
        </span>
        {reading && <QuestEnd reading={reading} collecting={collecting} onCollect={onCollect} />}
      </span>
      <span className="flex items-center justify-between gap-2 text-hud-label tabular-nums text-hud-ink">
        {reading ? <Rewards reading={reading} /> : <span />}
        {reading?.bane && showsBane && <MembersCount bane={reading.bane} />}
        <RealmsChip waiting={claim.waiting} narrow onOpen={claim.onOpen} />
      </span>
      {(heads.length > 0 || triumphReading) && (
        <span className="flex flex-wrap items-center gap-1.5">
          {heads.map((head) => (
            <HudChip
              key={head.eyebrow}
              icons={[head.icon]}
              tone={head.tone}
              onPress={() => setOpen(open === head.eyebrow ? null : head.eyebrow)}
            >
              {head.name}
            </HudChip>
          ))}
          {triumphReading && <HudLoading line={TRIUMPH_WORDS.reading} />}
        </span>
      )}
      {opened && <span className="text-hud-label text-hud-muted">{opened.rule}</span>}
    </HudPanel>
  );
};

/** What heads the panel: the bane or the Triumph in its tone, its eyebrow, name and what it does. */
interface Head {
  tone: "good" | "bad" | "warn";
  icon: IconMeaning;
  eyebrow: string;
  name: string;
  /** The sender's four Order crests, for a team bane. */
  crests?: readonly IconMeaning[];
  rule: string;
  tip?: string;
}

const TONE_TEXT = { good: "text-hud-good", bad: "text-hud-bad", warn: "text-hud-warn" } as const;

const triumphHead = ({ stage, percent }: { stage: TriumphStage; percent: number }): Head => ({
  tone: "good",
  icon: triumphMeaning(stage),
  eyebrow: TRIUMPH_WORDS.eyebrow,
  name: TRIUMPH_WORDS.names[stage],
  rule: TRIUMPH_WORDS.effects[stage](percent),
  tip: TRIUMPH_WORDS.where,
});

/** The mist's bane by its kind and what it does (BaneRules' rates), or a rival's by its sender and its crests. */
const baneHead = (bane: BaneReading, rules: NativeRows["BaneRules"] | undefined): Head => {
  if (bane.source === "team") {
    const sender = bane.sender!;
    return {
      tone: "bad",
      icon: BANE_MEANING.team,
      eyebrow: BANE_WORDS.teamFrom(aspectName(sender)),
      name: BANE_WORDS.teamName(aspectName(sender)),
      crests: orders.filter(({ aspect }) => aspect === sender).map(({ orderId }) => orderMeaning(orderId)),
      rule: BANE_WORDS.teamRule,
    };
  }
  const world = worldBanes.find(({ id }) => id === bane.kind);
  if (!world || !rules) throw new Error(`World bane ${bane.kind} has no rules`);
  return {
    tone: "warn",
    icon: BANE_MEANING.world[world.id],
    eyebrow: BANE_WORDS.worldEyebrow,
    name: world.name,
    rule: BANE_WORDS.worldRules[world.id](rules),
  };
};

const DayHead = ({ head }: { head: Head }) => (
  <span
    className={`flex items-center gap-2 border-b border-hud-divider pb-2 ${TONE_TEXT[head.tone]}`}
    data-tip={head.tip}
  >
    <Icon name={head.icon} size={32} />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-hud-label">{head.eyebrow}</span>
      <span className="flex items-center gap-2">
        <span className="text-hud-strong">{head.name}</span>
        {head.crests && (
          <span className="flex items-center gap-0.5">
            {head.crests.map((crest) => (
              <Icon key={crest} name={crest} size={18} />
            ))}
          </span>
        )}
      </span>
      <span className="text-hud-label text-hud-muted">{head.rule}</span>
    </span>
  </span>
);

/** How far the Aspect is at ending the bane ("4 of 6 members" over a meter), or what ending it brought. */
const Members = ({ bane }: { bane: BaneReading }) => {
  if (bane.won)
    return (
      <span className="flex items-center gap-2 text-hud-label text-hud-good">
        <Icon name="people" size={20} />
        {bane.source === "world" ? BANE_WORDS.worldEnded : BANE_WORDS.teamEnded}
      </span>
    );
  const count = BANE_WORDS.members(bane.completed, bane.required);
  return (
    <span className="flex items-center gap-2 text-hud-label tabular-nums text-hud-ink">
      <Icon name="people" size={20} />
      <span className="shrink-0">{count}</span>
      <span className="min-w-0 flex-1">
        <HudMeter share={Math.min(1, bane.completed / bane.required)} label={count} />
      </span>
    </span>
  );
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
      <Rewards reading={reading} />
    </span>
  );
};

/** What the quest pays: the Labor and the Essence. */
const Rewards = ({ reading }: { reading: QuestReading }) => (
  <span className="flex items-center gap-3 text-hud-label tabular-nums text-hud-ink">
    <Reward resource={ResourcesIds.Labor} amount={reading.reward.labor} />
    <Reward resource={ResourcesIds.Essence} amount={reading.reward.essence} />
  </span>
);

/** A phone's count of the members who finished the bane ("4 of 6"), or "Ended" with what that brought. */
const MembersCount = ({ bane }: { bane: BaneReading }) => (
  <span
    className={`flex items-center gap-1 ${bane.won ? "text-hud-good" : ""}`}
    data-tip={BANE_WORDS.members(bane.completed, bane.required)}
  >
    <Icon name="people" size={20} />
    {bane.won
      ? bane.source === "world"
        ? BANE_WORDS.worldEndedShort
        : BANE_WORDS.teamEndedShort
      : `${formatExact(bane.completed)} of ${formatExact(bane.required)}`}
  </span>
);

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
