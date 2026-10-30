import type { FrontierBeast } from "@/three/structures/frontier-beast";
import { formatExact, LORDS, formatShort } from "@bibliothecadao/types";
import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  HudButton,
  HudChip,
  HudCost,
  HudNotice,
  HudRarity,
  HudSheet,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { costLine, type Price } from "@/ui/design-system/kit/price-faces";
import { type Reason, reasonLine } from "@/ui/design-system/kit/reasons";
import {
  type Tier,
  ARMY,
  ARMY_WILL_BE_LOST,
  ATTACK,
  ATTACKING,
  MOVE,
  ON_ITS_WAY,
  REALM,
  REST_DID_NOT_FIT,
  RUIN_RULE,
  siteTitle,
  STORAGE,
  tooFarFrom,
  TROOPS,
  FIGHT_WORDS,
  XP,
} from "@/ui/design-system/kit/words";

import type { OrderInFlight } from "@/hooks/store/use-actions-in-flight";
import type { ReactNode } from "react";

import { useEnterConfirms } from "../hud/enter-confirms";
import type { Cost } from "../hud/army-order";
import { GuardToken } from "../hud/army-token";
import { FightSide } from "./fight-side";
import type { SiteFight } from "./site-card-plan";
import { type AttackTargetKind, TARGET_MARKS, attackTargetName } from "./site-marks";

/** The step under the outcome: Attack (the same tap whatever the forecast), Move until the army is in reach, or
 * Attack held back, by the stamina the army lacks or by a site too far for one order, which the foot then says. */
export type SiteVerb =
  | {
      kind: "attack";
      stamina: number;
      /** The army's order in flight, this attack or another: the step cannot be pressed until its outcome arrives. */
      inFlight?: OrderInFlight;
      /** Why the army's last attack here did not happen, in one line. */
      refused?: string;
      onAttack: () => void;
    }
  | { kind: "move"; prices: readonly Price[]; onMove: () => void }
  | { kind: "short"; stamina: Cost }
  | { kind: "far" }
  | { kind: "blocked"; reason: string };

/**
 * A guarded site's card (wireframe 06), read as its result will read (the owner's option A), headed as the owner picked
 * (28 October 2026, layout V1: "v1 token header yes"). The guard stands at its head as the dock draws an army: its
 * portrait, its strength under it. Beside it, what the site is (its kind and its beast, where the title does not say
 * them), or with an army in reach what this attack comes to; then, on one row, what the clear pays (what fits, with its
 * XP, or a ruin's chest with its tier and exact LORDS): "This attack earns" over the reward when it clears the site, the
 * reward dimmed when it does not (owner, 26 October 2026: "moving the clear rewards in the 'this attack clears it' ->
 * This attack earns xxx"). With an army selected, each side's troops before and after, the guard's strength said there
 * and not on its token. Its foot is the sheet's: Realm on the left, the one step alone on the right.
 */
export const SiteCardView = ({
  site,
  name,
  beast,
  army,
  guard,
  fight,
  pay,
  chest,
  ruinChoice,
  xp,
  verb,
  receipt,
  onRealm,
  onClose,
}: {
  site: AttackTargetKind;
  /** The site's own name, the one its map plate and every list give it: the card's title with its kind, as the hover. */
  name?: string;
  beast: (Pick<FrontierBeast, "beast" | "name"> & { combatClass: string }) | undefined;
  army: { art: IconMeaning; troops: number } | null;
  guard: number | null | undefined;
  fight: SiteFight | undefined;
  /** What a camp or rift pays: the full amount, and what fits when the store would overflow. */
  pay: { icon: IconMeaning; amount: number; fits?: number } | null;
  /** A ruin's chest: its tier and the exact LORDS stored with it; undefined until the facts carry them. */
  chest?: { tier: Tier; lords: number };
  ruinChoice?: { depth: string };
  xp: number | undefined;
  verb: SiteVerb | null;
  receipt?: ReactNode;
  /** The way to make room when the payout does not all fit. */
  onRealm?: () => void;
  onClose: () => void;
}) => {
  const { word: kind, icon } = TARGET_MARKS[site];
  const word = attackTargetName(site, beast);
  const title = name ? siteTitle(name, kind, beast?.name) : word;
  const lost = fight && fight.outcome === "loses";
  // With no army selected the card says what the site is and pays, and its guard (owner, 28 October 2026: "agree with
  // no picker"); selecting an army, then the site, gives the fight.
  const armyless = army === null;
  const guardIcon = beast ? beastMeaning(beast.beast) : "troops";
  // The army against a guard of known size, with the fight forecast: what option A reads, side by side.
  const facing = facingOf(army, guard, fight);
  const reward =
    chest || pay || xp !== undefined ? (
      <Reward dimmed={facing !== undefined && !clears(facing)}>
        {chest ? <ChestPay chest={chest} /> : pay ? <Pay pay={pay} /> : null}
        {xp !== undefined && !(chest && lost) && (
          <HudChip>
            {formatShort(xp, { signed: true })} {XP}
          </HudChip>
        )}
      </Reward>
    ) : null;
  // What the site is, in the words the title has not said: its beast.
  const what = beast?.name !== title ? beast?.name : undefined;
  return (
    <HudSheet label={title} onClose={onClose}>
      <header className="flex items-center gap-3">
        {typeof guard === "number" ? (
          <GuardToken
            label={beast?.name ?? TROOPS}
            art={guardIcon}
            troops={armyless ? guard : undefined}
            tip={beast?.combatClass}
          />
        ) : (
          <SiteMark icon={beast ? beastMeaning(beast.beast) : icon} />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          {facing ? (
            <Outcome facing={facing} earns={reward !== null} />
          ) : (
            what && <span className="text-hud-label text-hud-muted">{what}</span>
          )}
          {reward}
        </span>
      </header>
      {ruinChoice && (
        <p data-ruin-rule className="text-hud-label">
          <span className="text-hud-muted">{ruinChoice.depth} · </span>
          <span className="text-hud-ink">{RUIN_RULE}</span>
        </p>
      )}
      {!armyless && <FightPanel army={army} guard={guard} facing={facing} beast={beast} guardIcon={guardIcon} />}
      {receipt}
      <Verb
        verb={verb}
        site={word}
        armyLost={lost === true}
        lossInHeadline={facing !== undefined && isArmyLost(facing)}
        onRealm={pay?.fits !== undefined && pay.fits < pay.amount ? onRealm : undefined}
      />
    </HudSheet>
  );
};

type KnownFight = Exclude<SiteFight, { outcome: "refused" }>;
type Facing = { army: { art: IconMeaning; troops: number }; guard: number; fight: KnownFight };

const facingOf = (
  army: Facing["army"] | null,
  guard: number | null | undefined,
  fight: SiteFight | undefined,
): Facing | undefined =>
  army && typeof guard === "number" && fight && fight.outcome !== "refused" ? { army, guard, fight } : undefined;

const armyLeft = ({ army, fight }: Facing) => Math.max(0, army.troops - fight.troopsLost);
const isArmyLost = (facing: Facing) => armyLeft(facing) === 0;
const clears = (facing: Facing) => !isArmyLost(facing) && facing.fight.guardLeft === 0;

/** What this attack comes to, in the card's title words: what it earns when it clears the site (its reward under it). */
const Outcome = ({ facing, earns }: { facing: Facing; earns: boolean }) => (
  <span className={cn("text-hud-title", isArmyLost(facing) ? "text-hud-bad" : "text-hud-ink")}>
    {outcomeWord(facing, earns)}
  </span>
);

const outcomeWord = (facing: Facing, earns: boolean): string => {
  if (isArmyLost(facing)) return FIGHT_WORDS.armyLost;
  if (!clears(facing)) return FIGHT_WORDS.holds;
  return earns ? FIGHT_WORDS.earns : FIGHT_WORDS.clears;
};

/** What the clear pays, in the headline; dimmed when this attack does not clear the site. */
const Reward = ({ dimmed, children }: { dimmed: boolean; children: ReactNode }) => (
  <span className={cn("flex flex-wrap items-center gap-2", dimmed && "opacity-50")}>{children}</span>
);

/** A site's painting at the head of its card; `children` marks it (a won fight's flag). */
const SiteMark = ({ icon, children }: { icon: IconMeaning; children?: ReactNode }) => (
  <span className="relative flex size-16 shrink-0 items-center justify-center rounded-xl border border-hud-line bg-hud-surface">
    <SemanticIcon name={icon} size={36} />
    {children}
  </span>
);

/**
 * The fight's two sides, in every state of the card (owner, 10-27: "this panel doesnt match at all our new battle
 * panels"): each side's troops now and what this attack leaves it, near or far; refused, the same sides with a dash
 * where no forecast is known. The state itself is the line under them and the held step.
 */
const FightPanel = ({
  army,
  guard,
  facing,
  beast,
  guardIcon,
}: {
  army: { art: IconMeaning; troops: number } | null;
  guard: number | null | undefined;
  facing: Facing | undefined;
  beast: (Pick<FrontierBeast, "beast" | "name"> & { combatClass: string }) | undefined;
  guardIcon: IconMeaning;
}) =>
  army || guard !== null ? (
    <div className="flex gap-2">
      {army && (
        <FightSide
          label={ARMY}
          mark={<SemanticIcon name={army.art} size={26} />}
          before={army.troops}
          kept={facing && armyLeft(facing)}
          side="ours"
        />
      )}
      {guard !== null && (
        <FightSide
          label={beast?.name ?? TROOPS}
          mark={<SemanticIcon name={guardIcon} size={26} />}
          before={guard}
          kept={facing?.fight.guardLeft}
          side="theirs"
          tip={beast?.combatClass}
        />
      )}
    </div>
  ) : null;

/** What a clear pays home: what fits, marked Full, as the fight's result marks it, when the store cannot take it all. */
const Pay = ({ pay }: { pay: { icon: IconMeaning; amount: number; fits?: number } }) => {
  const short = pay.fits !== undefined && pay.fits < pay.amount;
  return (
    <span className="flex items-center gap-1.5">
      <SemanticIcon name={pay.icon} size={22} />
      <span className="text-hud-title leading-none tabular-nums text-hud-gold">
        +{formatExact(short ? pay.fits : pay.amount)}
      </span>
      {short && (
        <HudChip label={STORAGE} tone="bad">
          {REST_DID_NOT_FIT}
        </HudChip>
      )}
    </span>
  );
};

/** A ruin's chest: the exact LORDS it pays, fixed when it was found, and its tier. */
const ChestPay = ({ chest }: { chest: { tier: Tier; lords: number } }) => (
  <>
    <span className="flex items-center gap-1.5" aria-label={`${formatExact(chest.lords)} ${LORDS}`}>
      <SemanticIcon name="chest" size={22} />
      <SemanticIcon name="lords" size={18} />
      <span className="text-hud-title leading-none tabular-nums text-hud-gold">+{formatExact(chest.lords)}</span>
    </span>
    <HudRarity tier={chest.tier} />
  </>
);

const Verb = ({
  verb,
  site,
  armyLost,
  lossInHeadline,
  onRealm,
}: {
  verb: SiteVerb | null;
  site: string;
  /** The forecast ends with the army gone: Attack still runs, in red, and says so. */
  armyLost: boolean;
  /** The headline already says this attack loses the army: the line under the step does not say it again. */
  lossInHeadline: boolean;
  onRealm: (() => void) | undefined;
}) => {
  const warns = verb?.kind === "attack" && armyLost;
  // Enter confirms the attack the forecast wins or stalls; one that loses the army takes a deliberate tap.
  useEnterConfirms(verb?.kind === "attack" && !verb.inFlight && !warns ? verb.onAttack : undefined);
  if (!verb) return null;
  return (
    <>
      <VerbLine {...verbLine(verb, site, warns && !lossInHeadline)} />
      <HudWindowFoot note={<FootNote verb={verb} site={site} />}>
        {onRealm && (
          <HudButton kind="secondary" icon="realm" onClick={onRealm}>
            {REALM}
          </HudButton>
        )}
        {verb.kind === "move" ? (
          <HudButton kind="primary" icon="move" onClick={verb.onMove}>
            {MOVE}
          </HudButton>
        ) : (
          // A losing attack uses the shared danger action.
          <HudButton
            kind={warns ? "danger" : "primary"}
            icon="attack"
            busy={verb.kind === "attack" ? inFlightWord(verb.inFlight, "attack", ATTACKING) : undefined}
            disabled={verb.kind !== "attack"}
            onClick={verb.kind === "attack" ? verb.onAttack : undefined}
          >
            {ATTACK}
          </HudButton>
        )}
      </HudWindowFoot>
    </>
  );
};

/**
 * The word on an army's step while an order of that army is in flight: the step's own word for its own order, and
 * that the army is on its way for another. Undefined once the army is free.
 */
export const inFlightWord = (inFlight: OrderInFlight | undefined, own: OrderInFlight, word: string) =>
  inFlight && (inFlight === own ? word : ON_ITS_WAY);

/**
 * The one line under the step. An attack that did not happen says why, in red, ahead of the forecast's warning: it
 * is the news. Otherwise the warning that the whole fight loses the army, where the headline does not already say it,
 * or, under Move, that the site is out of reach.
 */
const verbLine = (verb: SiteVerb, site: string, warns: boolean): { line: string | undefined; warns: boolean } => {
  if (verb.kind === "blocked") return { line: verb.reason, warns: true };
  if (verb.kind === "attack" && verb.refused && !verb.inFlight) return { line: verb.refused, warns: true };
  return { line: warns ? ARMY_WILL_BE_LOST : verb.kind === "move" ? tooFarFrom(site) : undefined, warns };
};

/**
 * Beside the step, what it costs; or, while Attack is held back, why, in the place of its cost: the stamina line says
 * the cost already, so the card says it once (owner, 28 October 2026: "the need 30 stamina line can actually replace
 * the 30 stamina below it it just makes more sense, and we save space").
 */
const FootNote = ({ verb, site }: { verb: SiteVerb; site: string }) => {
  switch (verb.kind) {
    case "attack":
      return <HudCost line={costLine([{ of: "stamina", amount: verb.stamina }])} />;
    case "move":
      return <HudCost line={costLine(verb.prices)} />;
    case "blocked":
      return null;
    default:
      return <HudNotice tone="warn" line={reasonLine(heldBack(verb, site))} />;
  }
};

/** Why Attack is held back: the stamina missing and when it is back, or the site out of reach. */
const heldBack = (verb: Extract<SiteVerb, { kind: "short" | "far" }>, site: string): Reason => {
  if (verb.kind === "far") return { kind: "failed", line: tooFarFrom(site) };
  const { cost, held, wait } = verb.stamina;
  return { kind: "short", of: "stamina", held, need: cost, wait };
};

const VerbLine = ({ line, warns }: { line: string | undefined; warns: boolean }) =>
  line === undefined ? null : (
    <p role="status" className={cn("text-center text-hud-body", warns ? "text-hud-bad" : "text-hud-ink")}>
      {line}
    </p>
  );
