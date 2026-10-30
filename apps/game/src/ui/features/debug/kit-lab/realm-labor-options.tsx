import "./realm-labor-options.css";

import { homeSourceClaim } from "@bibliothecadao/eternum";
import { formatExact } from "@bibliothecadao/types";
import { DEVCON_LABOR_RULES } from "@/shell/join/devcon";
import { Icon } from "@/ui/design-system/icon";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudIconButton, HudSheet, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import {
  CLAIMING_LABOR,
  NO_REALM_LABOR,
  REALM_LABOR,
  claimRealmLaborLabel,
  dayLeft,
} from "@/ui/design-system/kit/words";
import { planRealmLabor, type RealmLaborPlan } from "@/ui/features/frontier/value/realm-labor";

/** Layout study for the Realm Labor sheet: three options drawn from the same facts, for the owner's pick. */

type RealmLaborOption = "a" | "b" | "c";

export interface LabHome {
  kind: "golden" | "devcon" | "realm" | "plain";
  name: string;
  realmId?: number;
  map?: string | null;
}

export interface RealmLaborFacts {
  plan: RealmLaborPlan;
  dailyAmount: number;
  dailyEssence: number;
  home: LabHome;
  secondsLeft: number | undefined;
  /** Today's game day, and the next one's number, or null on the season's last day. */
  day: number;
  nextDay: number | null;
  /** The season's days, for the calendar. */
  days: number;
  /** Past days claimed, for the calendar. */
  claimedDays: readonly number[];
  reminder: "ask" | "install" | "on" | null;
  sending: boolean;
}

const WORDS = {
  claimed: "Claimed",
  dayOpensIn: (day: number, secondsLeft: number | undefined) => `Day ${day} opens in ${dayLeft(secondsLeft).reading}`,
  seasonEndsIn: (secondsLeft: number | undefined) => `Season ends in ${dayLeft(secondsLeft).reading}`,
  remindMe: "Remind me",
  reminderOn: "Reminder on",
  addToHomeScreen: "Add to Home Screen",
  fits: (fits: number, total: number, name = "") => `${formatExact(fits)} of ${formatExact(total)}${name} fit`,
  claimAnyway: "Claim anyway",
  makeRoom: "Make room",
  perDay: "each day",
  today: "Today",
  day: (day: number) => `Day ${day}`,
  realmNumber: (realmId: number) => `Realm ${realmId}`,
};

const ART_ICON: Record<LabHome["kind"], IconMeaning> = {
  golden: "devcon-golden-realm",
  devcon: "devcon-realm",
  realm: "realm",
  plain: "realm",
};

/** The home's own art, as the Realm step draws it: a ticket's pavilion on its colour, a held Realm's map. */
const HomeArt = ({ home, size }: { home: LabHome; size: number }) => (
  <span className="rl-art" data-home={home.kind} data-map={home.map ? "drawn" : "none"}>
    {home.map ? <img src={home.map} alt="" /> : <Icon name={ART_ICON[home.kind]} size={size} />}
  </span>
);

const HomeName = ({ home }: { home: LabHome }) => (
  <span className="rl-name">
    <strong>{home.name}</strong>
    {home.realmId !== undefined && <span>{WORDS.realmNumber(home.realmId)}</span>}
  </span>
);

const isPartial = (plan: RealmLaborPlan) => !plan.claimed && plan.fits < plan.total;

/** What the next day holds once today's claim is in: its countdown, or the season's end on its last day. */
const nextLine = (facts: RealmLaborFacts) =>
  facts.nextDay === null ? WORDS.seasonEndsIn(facts.secondsLeft) : WORDS.dayOpensIn(facts.nextDay, facts.secondsLeft);

/** The reminder beside the countdown: an ask (secondary, never the primary), or its state once on. */
const Reminder = ({ facts, compact = false }: { facts: RealmLaborFacts; compact?: boolean }) => {
  if (facts.nextDay === null || facts.reminder === null) return null;
  if (facts.reminder === "on")
    return (
      <span className="rl-reminder-on">
        <Icon name="notifications" size={18} />
        {WORDS.reminderOn}
      </span>
    );
  const install = facts.reminder === "install";
  const label = install ? WORDS.addToHomeScreen : WORDS.remindMe;
  if (compact)
    return <HudIconButton icon={install ? "download" : "notifications"} label={label} kind="secondary" size="sm" />;
  return (
    <HudButton kind="secondary" size="sm" icon={install ? "download" : "notifications"}>
      {label}
    </HudButton>
  );
};

/** The claim's foot: one primary. A short store makes Realm the primary (spend first), the claim secondary. */
const ClaimFoot = ({ facts }: { facts: RealmLaborFacts }) => {
  const { plan, sending } = facts;
  if (plan.claimed || !plan.claimable) return null;
  const partial = isPartial(plan);
  return (
    <HudWindowFoot>
      {partial && (
        <HudButton kind="secondary" icon="claim" busy={sending ? CLAIMING_LABOR : undefined}>
          {WORDS.claimAnyway}
        </HudButton>
      )}
      <HudButton
        kind="primary"
        icon={partial ? "realm" : "claim"}
        busy={!partial && sending ? CLAIMING_LABOR : undefined}
      >
        {partial ? WORDS.makeRoom : claimRealmLaborLabel(plan.fits, plan.essence)}
      </HudButton>
    </HudWindowFoot>
  );
};

const Sheet = ({
  facts,
  option,
  children,
}: {
  facts: RealmLaborFacts;
  option: RealmLaborOption;
  children: React.ReactNode;
}) => (
  <HudSheet label={REALM_LABOR} onClose={() => undefined}>
    <div className="rl" data-option={option}>
      {facts.plan.eligible ? children : <NoClaim home={facts.home} />}
    </div>
    {facts.plan.eligible && <ClaimFoot facts={facts} />}
  </HudSheet>
);

const NoClaim = ({ home }: { home: LabHome }) => (
  <div className="rl-none">
    <HomeArt home={home} size={40} />
    <span>{NO_REALM_LABOR}</span>
  </div>
);

/* ── A · Home card: the Realm step's card, its claim lines ticked once claimed ─────────────────────────── */

const ClaimLine = ({
  icon,
  amount,
  name,
  claimed,
  warn,
}: {
  icon: IconMeaning;
  amount: string;
  name: string;
  claimed: boolean;
  warn?: string;
}) => (
  <li data-claimed={claimed || undefined} data-warn={warn ? "" : undefined}>
    <Icon name={icon} size={28} />
    <span>{warn ?? `${amount} ${name}`}</span>
    {claimed && <Icon name="check" size={20} />}
  </li>
);

const OptionA = ({ facts }: { facts: RealmLaborFacts }) => {
  const { plan, home } = facts;
  return (
    <Sheet facts={facts} option="a">
      <div className="rl-a__card">
        <HomeArt home={home} size={88} />
        <div className="rl-a__about">
          <HomeName home={home} />
          <ul className="rl-a__lines">
            <ClaimLine
              icon="labor"
              amount={formatExact(facts.dailyAmount)}
              name={`Labor ${WORDS.perDay}`}
              claimed={plan.claimed}
              warn={isPartial(plan) ? WORDS.fits(plan.fits, plan.total, " Labor") : undefined}
            />
            {facts.dailyEssence > 0 && (
              <ClaimLine
                icon="essence"
                amount={formatExact(facts.dailyEssence)}
                name={`Essence ${WORDS.perDay}`}
                claimed={plan.claimed}
              />
            )}
          </ul>
        </div>
      </div>
      {plan.claimed && (
        <div className="rl-next">
          <Icon name="hourglass" size={22} />
          <span>{nextLine(facts)}</span>
          <Reminder facts={facts} />
        </div>
      )}
    </Sheet>
  );
};

/* ── B · Reward tiles: today's gifts as big tiles, stamped once claimed ───────────────────────────────── */

const RewardTile = ({
  icon,
  amount,
  name,
  claimed,
  short,
}: {
  icon: IconMeaning;
  amount: number;
  name: string;
  claimed: boolean;
  short?: { fits: number; total: number };
}) => (
  <div className="rl-b__tile" data-claimed={claimed || undefined} data-warn={short ? "" : undefined}>
    <Icon name={icon} size={56} />
    <strong>{short ? `+${formatExact(short.fits)}` : `+${formatExact(amount)}`}</strong>
    <span>{short ? WORDS.fits(short.fits, short.total) : name}</span>
    {claimed && (
      <span className="rl-b__stamp">
        <Icon name="check" size={22} />
      </span>
    )}
  </div>
);

const OptionB = ({ facts }: { facts: RealmLaborFacts }) => {
  const { plan, home } = facts;
  return (
    <Sheet facts={facts} option="b">
      <div className="rl-b__head">
        <HomeArt home={home} size={36} />
        <HomeName home={home} />
        <span className="rl-b__day">{WORDS.day(facts.day)}</span>
      </div>
      <div className="rl-b__tiles">
        <RewardTile
          icon="labor"
          amount={facts.dailyAmount}
          name={`Labor ${WORDS.perDay}`}
          claimed={plan.claimed}
          short={isPartial(plan) ? { fits: plan.fits, total: plan.total } : undefined}
        />
        {facts.dailyEssence > 0 && (
          <RewardTile
            icon="essence"
            amount={facts.dailyEssence}
            name={`Essence ${WORDS.perDay}`}
            claimed={plan.claimed}
          />
        )}
      </div>
      {plan.claimed && (
        <div className="rl-next">
          <Icon name="hourglass" size={22} />
          <span>{nextLine(facts)}</span>
          <Reminder facts={facts} compact />
        </div>
      )}
    </Sheet>
  );
};

/* ── C · Banner and season calendar: the home's art wide, each day of the season a pip ───────────────── */

const dayState = (facts: RealmLaborFacts, day: number) => {
  if (day === facts.day) return facts.plan.claimed ? "claimed today" : "today";
  if (day > facts.day) return "ahead";
  return facts.claimedDays.includes(day) ? "claimed" : "missed";
};

const OptionC = ({ facts }: { facts: RealmLaborFacts }) => {
  const { plan, home } = facts;
  return (
    <Sheet facts={facts} option="c">
      <div className="rl-c__banner" data-home={home.kind}>
        <HomeArt home={home} size={124} />
        <div className="rl-c__over">
          <HomeName home={home} />
          <span className="rl-c__amounts">
            <span className="rl-c__amount">
              <Icon name="labor" size={24} />
              {isPartial(plan) ? WORDS.fits(plan.fits, plan.total) : formatExact(facts.dailyAmount)}
            </span>
            {facts.dailyEssence > 0 && (
              <span className="rl-c__amount">
                <Icon name="essence" size={24} />
                {formatExact(facts.dailyEssence)}
              </span>
            )}
            <span className="rl-c__per">{WORDS.perDay}</span>
          </span>
        </div>
      </div>
      <ol className="rl-c__days" aria-label="Season">
        {Array.from({ length: facts.days }, (_, index) => index + 1).map((day) => {
          const state = dayState(facts, day);
          return (
            <li key={day} data-state={state}>
              <span>{day}</span>
              {(state === "claimed" || state === "claimed today") && <Icon name="check" size={14} />}
            </li>
          );
        })}
      </ol>
      {plan.claimed && (
        <div className="rl-next">
          <Icon name="hourglass" size={22} />
          <span>{nextLine(facts)}</span>
          <Reminder facts={facts} />
        </div>
      )}
    </Sheet>
  );
};

export const RealmLaborOptionSheet = ({ option, facts }: { option: RealmLaborOption; facts: RealmLaborFacts }) =>
  option === "a" ? <OptionA facts={facts} /> : option === "b" ? <OptionB facts={facts} /> : <OptionC facts={facts} />;

/* ── The states each option is shot in ─────────────────────────────────────────────────────────────────── */

const HOUR = 3600;
const LEFT = 9 * HOUR + 48 * 60;
const REALM_3_MAP =
  "https://web-production-2a4cb.up.railway.app/api/marketplace/v1/chains/SN_MAIN/assets/ecbc308f79704c8c36cb0c9eba19545ded12c2409b406f4dcc1bc3f802625cc9.svg";

const HOMES = {
  golden: { kind: "golden", name: "Golden Devcon" },
  devcon: { kind: "devcon", name: "Devcon" },
  realm: { kind: "realm", name: "Hetokamohuti", realmId: 3, map: REALM_3_MAP },
  plain: { kind: "plain", name: "Settlement" },
} satisfies Record<string, LabHome>;

const claimOf = (home: LabHome) =>
  homeSourceClaim(
    DEVCON_LABOR_RULES,
    home.kind === "golden" || home.kind === "devcon"
      ? { kind: "campaign", golden: home.kind === "golden" }
      : { kind: "realm" },
  ) ?? { labor: 0, essence: 0 };

const factsOf = ({
  home,
  eligible = true,
  claimed = false,
  space = 10_000,
  reminder = null,
  day = 3,
}: {
  home: LabHome;
  eligible?: boolean;
  claimed?: boolean;
  space?: number;
  reminder?: RealmLaborFacts["reminder"];
  day?: number;
}): RealmLaborFacts => {
  const claim = claimOf(home);
  const days = 7;
  return {
    plan: planRealmLabor({
      eligible,
      claimed,
      amount: claim.labor,
      essence: claim.essence,
      held: 18_000 - space,
      limit: 18_000,
    }),
    dailyAmount: claim.labor,
    dailyEssence: claim.essence,
    home,
    secondsLeft: LEFT,
    day,
    nextDay: day < days ? day + 1 : null,
    days,
    claimedDays: [1, 4, 5, 6].filter((past) => past < day),
    reminder,
    sending: false,
  };
};

/** Every state the owner's pick is shot in, by name. */
export const REALM_LABOR_PICK_STATES = {
  golden: factsOf({ home: HOMES.golden }),
  devcon: factsOf({ home: HOMES.devcon }),
  realm: factsOf({ home: HOMES.realm }),
  none: factsOf({ home: HOMES.plain, eligible: false }),
  partial: factsOf({ home: HOMES.golden, space: 1_400 }),
  "claimed-ask": factsOf({ home: HOMES.golden, claimed: true, reminder: "ask" }),
  "claimed-on": factsOf({ home: HOMES.golden, claimed: true, reminder: "on" }),
  "last-day": factsOf({ home: HOMES.golden, claimed: true, reminder: "on", day: 7 }),
} satisfies Record<string, RealmLaborFacts>;

export const REALM_LABOR_PICK_OPTIONS = ["today", "a", "b", "c"] as const;
export type RealmLaborPickOption = (typeof REALM_LABOR_PICK_OPTIONS)[number];
