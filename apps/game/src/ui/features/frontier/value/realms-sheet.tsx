import "./realms-sheet.css";

import { formatExact } from "@bibliothecadao/types";
import type { AlertsAsk } from "@/shell/profile/alerts-ask";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudNotice, HudSheet, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import {
  ADD_TO_HOME_SCREEN,
  CLAIMING_LABOR,
  EACH_DAY,
  HOME_STEP_WORDS,
  NO_REALM_LABOR,
  REALM_LABOR,
  REMIND_ME,
  REMINDER_ON,
  SEASON,
  TURNING_ALERTS_ON,
  claimRealmLaborLabel,
  dayOpensIn,
  laborFits,
  seasonDayLabel,
  seasonEndsIn,
} from "@/ui/design-system/kit/words";
import { HomeArt } from "@/ui/shared/components/home-art";
import type { LaborHome, RealmLaborPlan, SeasonDay } from "./realm-labor";
import type { RealmLaborFacts } from "./use-realm-labor";

/**
 * The daily claim of a home founded with a held Realm or a campaign's ticket (owner's pick, option C of
 * reports/realm-labor-1.md): the home's picture with what it gives each day, the days around today, and the claim. Once
 * claimed it says when the next day opens, and offers a push for it while this device would not get one.
 */
export const RealmsSheet = ({
  labor,
  map,
  ask,
  sending,
  onClaim,
  onClose,
}: {
  labor: RealmLaborFacts;
  /** A held Realm's map from the Realm index, when the account's held-Realms answer has one. */
  map: string | null;
  ask: AlertsAsk;
  sending: boolean;
  onClaim: () => void;
  onClose: () => void;
}) => (
  <HudSheet label={REALM_LABOR} onClose={onClose}>
    {labor.home ? (
      <div className="realm-labor">
        <HomeBanner home={labor.home} labor={labor} map={map} />
        <SeasonStrip days={labor.days} />
        {isStorageShort(labor.plan) && <HudNotice tone="warn" line={laborFits(labor.plan.fits, labor.plan.total)} />}
        {labor.plan.claimed && <NextDay labor={labor} ask={ask} />}
        {labor.plan.claimable && <ClaimFoot plan={labor.plan} sending={sending} onClaim={onClaim} />}
      </div>
    ) : (
      <NoClaim />
    )}
  </HudSheet>
);

const isStorageShort = (plan: RealmLaborPlan) => !plan.claimed && plan.fits < plan.total;

/** The home's picture, wide, with its name and what its claim gives each day. */
const HomeBanner = ({ home, labor, map }: { home: LaborHome; labor: RealmLaborFacts; map: string | null }) => (
  <div className="realm-labor__banner">
    <BannerArt home={home} map={map} />
    <div className="realm-labor__about">
      <HomeName home={home} />
      <span className="realm-labor__amounts">
        <Amount icon="labor" amount={labor.dailyAmount} />
        {labor.dailyEssence > 0 && <Amount icon="essence" amount={labor.dailyEssence} />}
        <span className="realm-labor__each">{EACH_DAY}</span>
      </span>
    </div>
  </div>
);

const BannerArt = ({ home, map }: { home: LaborHome; map: string | null }) =>
  home.kind === "campaign" ? (
    <HomeArt icon={home.mark.icon} size={124} tier={home.mark.golden ? "golden" : "regular"} />
  ) : (
    <HomeArt map={map} icon="realm" size={104} eager />
  );

const HomeName = ({ home }: { home: LaborHome }) => (
  <span className="realm-labor__name">
    <strong>{home.kind === "campaign" ? home.mark.line : home.name}</strong>
    {home.kind === "realm" && <span>{HOME_STEP_WORDS.realm(home.realmId)}</span>}
  </span>
);

const Amount = ({ icon, amount }: { icon: "labor" | "essence"; amount: number }) => (
  <span className="realm-labor__amount">
    <Icon name={icon} size={24} />
    {formatExact(amount)}
  </span>
);

/** The days around today: each claimed (ticked), missed (struck), today's, or ahead. */
const SeasonStrip = ({ days }: { days: SeasonDay[] }) => (
  <ol className="realm-labor__days" aria-label={SEASON}>
    {days.map(({ day, state, today }) => (
      <li
        key={day}
        data-state={state}
        aria-current={today ? "date" : undefined}
        aria-label={seasonDayLabel(day, state)}
      >
        <span aria-hidden="true">{day}</span>
        {state === "claimed" && <Icon name="check" size={14} />}
      </li>
    ))}
  </ol>
);

/** Once claimed: what the next day's claim waits for, and the push that says when it opens. */
const NextDay = ({ labor, ask }: { labor: RealmLaborFacts; ask: AlertsAsk }) => (
  <div className="realm-labor__next" role="timer">
    <Icon name="hourglass" size={22} />
    <span>
      {labor.nextDay === null ? seasonEndsIn(labor.secondsLeft) : dayOpensIn(labor.nextDay, labor.secondsLeft)}
    </span>
    {labor.nextDay !== null && <Reminder ask={ask} />}
  </div>
);

/** The ask for the next day's push: secondary, never the sheet's weight; its state once on. */
const Reminder = ({ ask }: { ask: AlertsAsk }) => {
  if (ask === null) return null;
  if (ask.kind === "on")
    return (
      <span className="realm-labor__reminder-on">
        <Icon name="notifications" size={18} />
        {REMINDER_ON}
      </span>
    );
  const install = ask.kind === "install";
  return (
    <HudButton
      kind="secondary"
      size="sm"
      icon={install ? "download" : "notifications"}
      busy={ask.busy ? TURNING_ALERTS_ON : undefined}
      onClick={ask.act}
    >
      {install ? ADD_TO_HOME_SCREEN : REMIND_ME}
    </HudButton>
  );
};

/** The sheet's one verb: what lands, the Labor that fits and any Essence. */
const ClaimFoot = ({ plan, sending, onClaim }: { plan: RealmLaborPlan; sending: boolean; onClaim: () => void }) => (
  <HudWindowFoot>
    <HudButton
      kind="primary"
      icon="claim"
      busy={sending ? CLAIMING_LABOR : undefined}
      disabled={sending}
      onClick={onClaim}
    >
      {claimRealmLaborLabel(plan.fits, plan.essence)}
    </HudButton>
  </HudWindowFoot>
);

const NoClaim = () => (
  <div className="realm-labor__none">
    <HomeArt icon="realm" size={40} tier="free" />
    <span>{NO_REALM_LABOR}</span>
  </div>
);
