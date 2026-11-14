import { Icon } from "@/ui/design-system/icon";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudChip, HudLoading, HudMeter, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { DAY_BANNER_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { formatAmount, ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";

type Tone = "good" | "bad" | "warn";
export type DayLayout = "desktop" | "phone";

/** What heads the panel: the day's bane or Triumph, in its tone, with its eyebrow, name and what it does. */
export interface DayHead {
  tone: Tone;
  icon: IconMeaning;
  eyebrow: string;
  name: string;
  rule: string;
  /** A rival Aspect's crests, for a team bane. */
  crests?: readonly IconMeaning[];
}

/** Today's quest, resolved by its caller: its painting, its name and the unit its count is in. */
export interface DayQuestFace {
  icon: IconMeaning;
  name: string;
  unit: string;
}

/** How far the quest is, what it pays, and what the player can do about it. */
export interface DayQuestReading {
  progress: number;
  target: number;
  reward: { labor: number; essence: number };
  /** running: nothing to press; done: Collect; collected: a check; again: a world bane ended, a second reward waits. */
  state: "running" | "done" | "collected" | "again";
}

/** The Aspect's members at ending the bane: how many finished, or what ending it brought. */
export type DayMembers = { completed: number; required: number } | { ended: string; endedShort: string };

export interface DayBannerProps {
  layout: DayLayout;
  quest: DayQuestFace | null;
  /** Null while the facts the day rests on are not settled: the banner says it is reading and offers nothing. */
  reading: DayQuestReading | null;
  heads: readonly DayHead[];
  members: DayMembers | null;
  /** The home's daily claim waiting today (its Labor), which opens Realms; null once claimed. */
  claim: { labor: number } | null;
  collecting: boolean;
  onCollect: () => void;
  onOpenClaim: () => void;
}

const TONE_TEXT: Record<Tone, string> = { good: "text-hud-good", bad: "text-hud-bad", warn: "text-hud-warn" };

/**
 * The day's banner (the owner's pick A): the day's news heads the panel, then the quest with its count over a meter and
 * its reward, the Aspect's members and the claim waiting. No LORDS anywhere. A phone gets the lighter panel: the quest on
 * one row, one foot row, and the news as chips that open their line on a press.
 */
export const DayBannerView = ({ quest, ...props }: DayBannerProps) => {
  if (!quest) return (
    <HudPanel label={WORDS.today} collapsible={false} className="pointer-events-auto">
      <HudLoading line={WORDS.reading} />
    </HudPanel>
  );
  return props.layout === "phone" ? <PhoneDay {...props} quest={quest} /> : <DesktopDay {...props} quest={quest} />;
};

type KnownQuestProps = Omit<DayBannerProps, "quest"> & { quest: DayQuestFace };

const DesktopDay = ({ quest, reading, heads, members, claim, collecting, onCollect, onOpenClaim }: KnownQuestProps) => (
  <HudPanel label={WORDS.today} collapsible={false} className="pointer-events-auto" bodyClassName="flex flex-col gap-2">
    {heads.map((head) => (
      <HeadRow key={head.eyebrow} head={head} />
    ))}
    <span className="flex items-center gap-3">
      <Icon name={quest.icon} size={44} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-hud-strong text-hud-ink">{quest.name}</span>
          {reading && <Count quest={quest} reading={reading} />}
        </span>
        {reading ? (
          <>
            <Meter quest={quest} reading={reading} />
            <Rewards reading={reading} />
          </>
        ) : (
          <HudLoading line={WORDS.reading} />
        )}
      </span>
      {reading && <End state={reading.state} collecting={collecting} onCollect={onCollect} />}
    </span>
    <span className="flex items-center justify-between gap-2">
      <span className="min-w-0 flex-1">{members && <Members members={members} />}</span>
      <Claim claim={claim} onOpen={onOpenClaim} />
    </span>
  </HudPanel>
);

const PhoneDay = ({ quest, reading, heads, members, claim, collecting, onCollect, onOpenClaim }: KnownQuestProps) => {
  const [open, setOpen] = useState<string | null>(null);
  const opened = heads.find((head) => head.eyebrow === open);
  return (
    <HudPanel
      label={WORDS.today}
      collapsible={false}
      className="pointer-events-auto"
      bodyClassName="flex flex-col gap-1.5"
    >
      <span className="flex items-center gap-2">
        <Icon name={quest.icon} size={32} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-hud-strong text-hud-ink">{quest.name}</span>
            {reading && <Count quest={quest} reading={reading} />}
          </span>
          {reading ? <Meter quest={quest} reading={reading} /> : <HudLoading line={WORDS.reading} />}
        </span>
        {reading && <End state={reading.state} collecting={collecting} onCollect={onCollect} />}
      </span>
      <span className="flex items-center justify-between gap-2 text-hud-label tabular-nums text-hud-ink">
        {reading ? <Rewards reading={reading} /> : <span />}
        {members && <MembersShort members={members} />}
        <Claim claim={claim} onOpen={onOpenClaim} />
      </span>
      {heads.length > 0 && (
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
        </span>
      )}
      {opened && <span className="text-hud-label text-hud-muted">{opened.rule}</span>}
    </HudPanel>
  );
};

const HeadRow = ({ head }: { head: DayHead }) => (
  <span className={`flex items-center gap-2 border-b border-hud-divider pb-2 ${TONE_TEXT[head.tone]}`}>
    <Icon name={head.icon} size={32} />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-hud-label">{head.eyebrow}</span>
      <span className="flex items-center gap-2">
        <span className="text-hud-strong">{head.name}</span>
        {head.crests?.map((crest) => (
          <Icon key={crest} name={crest} size={18} />
        ))}
      </span>
      <span className="text-hud-label text-hud-muted">{head.rule}</span>
    </span>
  </span>
);

const share = (reading: DayQuestReading) => Math.min(1, reading.progress / reading.target);
const countOf = (quest: DayQuestFace, reading: DayQuestReading) =>
  WORDS.count(reading.progress, reading.target, quest.unit);

const Count = ({ quest, reading }: { quest: DayQuestFace; reading: DayQuestReading }) => (
  <span className="shrink-0 text-hud-label tabular-nums text-hud-muted">{countOf(quest, reading)}</span>
);

const Meter = ({ quest, reading }: { quest: DayQuestFace; reading: DayQuestReading }) => (
  <HudMeter share={share(reading)} label={countOf(quest, reading)} />
);

const Rewards = ({ reading }: { reading: DayQuestReading }) => (
  <span className="flex items-center gap-3 text-hud-label tabular-nums text-hud-ink">
    <Amount resource={ResourcesIds.Labor} amount={reading.reward.labor} />
    <Amount resource={ResourcesIds.Essence} amount={reading.reward.essence} />
  </span>
);

const Amount = ({ resource, amount }: { resource: ResourcesIds; amount: number }) => (
  <span data-reward={ResourcesIds[resource]} className="flex items-center gap-1">
    <Icon name={resourceMeaning(resource)} size={20} />
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
    <HudButton kind="primary" size="sm" busy={collecting ? WORDS.collecting : undefined} onClick={onCollect}>
      {state === "again" ? WORDS.collectAgain : WORDS.collect}
    </HudButton>
  );
};

const Members = ({ members }: { members: DayMembers }) => {
  if ("ended" in members)
    return (
      <span className="flex items-center gap-2 text-hud-label text-hud-good">
        <Icon name="people" size={20} />
        {members.ended}
      </span>
    );
  const count = WORDS.members(members.completed, members.required);
  return (
    <span className="flex items-center gap-2 text-hud-label tabular-nums text-hud-ink">
      <Icon name="people" size={20} />
      <span className="shrink-0">{count}</span>
      <span className="min-w-0 flex-1">
        <HudMeter share={Math.min(1, members.completed / members.required)} label={count} />
      </span>
    </span>
  );
};

const MembersShort = ({ members }: { members: DayMembers }) => (
  <span className={`flex items-center gap-1 ${"ended" in members ? "text-hud-good" : ""}`}>
    <Icon name="people" size={20} />
    {"ended" in members ? members.endedShort : WORDS.membersShort(members.completed, members.required)}
  </span>
);

const Claim = ({ claim, onOpen }: { claim: DayBannerProps["claim"]; onOpen: () => void }) =>
  claim && (
    <HudChip icons={["labor"]} onPress={onOpen}>
      {formatAmount(claim.labor)}
    </HudChip>
  );
