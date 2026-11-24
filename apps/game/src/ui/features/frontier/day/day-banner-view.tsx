import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudChip, HudLoading, HudMeter, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { DAY_BANNER_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { formatShort, ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";
import type { DayHead, DayMembers } from "./day-bane-face";

export type DayLayout = "desktop" | "phone";

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
  layout: DayLayout;
  quest: DayQuestFace | null;
  reading: DayQuestReading | null;
  heads: readonly DayHead[];
  members: DayMembers | null;
  bar: { charge: number; threshold: number } | null;
  claim: { labor: number } | null;
  collecting: boolean;
  onCollect: () => void;
  onOpenClaim: () => void;
}

const TONE_TEXT: Record<Tone, string> = { good: "text-hud-good", bad: "text-hud-bad", warn: "text-hud-warn" };

export const DayBannerView = ({ quest, ...props }: DayBannerProps) => {
  if (!quest)
    return (
      <HudPanel label={WORDS.today} collapsible={false} className="pointer-events-auto">
        <HudLoading line={WORDS.reading} />
      </HudPanel>
    );
  return props.layout === "phone" ? <PhoneDay {...props} quest={quest} /> : <DesktopDay {...props} quest={quest} />;
};

type KnownQuestProps = Omit<DayBannerProps, "quest"> & { quest: DayQuestFace };

const DesktopDay = ({
  quest,
  reading,
  heads,
  members,
  bar,
  claim,
  collecting,
  onCollect,
  onOpenClaim,
}: KnownQuestProps) => (
  <HudPanel
    label={WORDS.today}
    collapsible={false}
    className="pointer-events-auto"
    bodyClassName="flex flex-col gap-2.5"
  >
    {heads.map((head) => (
      <HeadRow key={head.eyebrow} head={head} />
    ))}
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <Icon name={quest.icon} size={40} className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-hud-strong text-hud-ink">{quest.name}</span>
            {reading && <Count quest={quest} reading={reading} />}
          </div>
          <span data-quest-objective className="text-hud-body text-hud-muted">
            {reading ? WORDS.objectiveLine(quest.objective, reading.target) : quest.objective}
          </span>
        </div>
      </div>
      {reading ? (
        <>
          <Meter quest={quest} reading={reading} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Rewards reading={reading} />
            <End state={reading.state} collecting={collecting} onCollect={onCollect} />
          </div>
        </>
      ) : (
        <HudLoading line={WORDS.reading} />
      )}
    </div>
    {(members || claim) && (
      <div className="flex items-center justify-between gap-2 border-t border-hud-divider pt-2">
        <span className="min-w-0 flex-1">{members && <Members members={members} />}</span>
        <Claim claim={claim} onOpen={onOpenClaim} />
      </div>
    )}
    {bar && <BaneBar bar={bar} />}
  </HudPanel>
);

const PhoneDay = ({
  quest,
  reading,
  heads,
  members,
  bar,
  claim,
  collecting,
  onCollect,
  onOpenClaim,
}: KnownQuestProps) => {
  const [open, setOpen] = useState<string | null>(null);
  const opened = heads.find((head) => head.eyebrow === open);
  return (
    <HudPanel
      label={WORDS.today}
      collapsible={false}
      className="pointer-events-auto"
      bodyClassName="flex flex-col gap-2"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2.5">
          <Icon name={quest.icon} size={32} className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-hud-strong text-hud-ink">{quest.name}</span>
              {reading && <Count quest={quest} reading={reading} />}
            </div>
            <span data-quest-objective className="text-hud-label text-hud-muted">
              {reading ? WORDS.objectiveLine(quest.objective, reading.target) : quest.objective}
            </span>
          </div>
        </div>
        {reading ? (
          <>
            <Meter quest={quest} reading={reading} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Rewards reading={reading} />
              <End state={reading.state} collecting={collecting} onCollect={onCollect} />
            </div>
          </>
        ) : (
          <HudLoading line={WORDS.reading} />
        )}
      </div>
      {(members || claim) && (
        <div className="flex items-center justify-between gap-2 border-t border-hud-divider pt-1.5 text-hud-label tabular-nums text-hud-ink">
          {members ? <MembersShort members={members} /> : <span />}
          <Claim claim={claim} onOpen={onOpenClaim} />
        </div>
      )}
      {bar && <BaneBar bar={bar} />}
      {heads.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
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
        </div>
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
        {head.aspectId && <AspectMark aspect={head.aspectId} size={20} decorative />}
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
  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-hud-label tabular-nums text-hud-ink">
    <span className="text-hud-muted">{WORDS.reward}</span>
    <Amount resource={ResourcesIds.Labor} amount={reading.reward.labor} />
    <Amount resource={ResourcesIds.Essence} amount={reading.reward.essence} />
  </span>
);

const Amount = ({ resource, amount }: { resource: ResourcesIds; amount: number }) => (
  <span data-reward={ResourcesIds[resource]} className="inline-flex items-center gap-1">
    <Icon name={resourceMeaning(resource)} size={18} />
    {WORDS.rewardAmount(amount, resource)}
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

const BaneBar = ({ bar }: { bar: NonNullable<DayBannerProps["bar"]> }) => {
  const charge = WORDS.barCharge(bar.charge, bar.threshold);
  const line = `${WORDS.baneBar}: ${charge}`;
  return (
    <div
      data-day-bane-bar
      className="flex flex-col gap-1 border-t border-hud-divider pt-2 text-hud-label tabular-nums text-hud-ink"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-hud-ink">
          <Icon name="flame" size={16} className="shrink-0" />
          <span className="truncate">{WORDS.baneBar}</span>
        </span>
        <span className="shrink-0 text-hud-muted">{charge}</span>
      </div>
      <HudMeter share={Math.min(1, bar.charge / bar.threshold)} label={line} />
      <span className="text-hud-label text-hud-muted">{WORDS.baneBarHint}</span>
    </div>
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
      {formatShort(claim.labor)}
    </HudChip>
  );
