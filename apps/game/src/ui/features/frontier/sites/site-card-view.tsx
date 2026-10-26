import type { FrontierBeast } from "@/three/structures/frontier-beast";
import { formatDuration, formatExact, formatHeldAgainst, LORDS, formatShort } from "@bibliothecadao/types";
import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  HudButton,
  HudChip,
  HudCost,
  HudMeter,
  HudPanel,
  HudRarity,
  HudRow,
  HudSheet,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { costLine, type Price } from "@/ui/design-system/kit/price-faces";
import {
  type Tier,
  ARMY_WILL_BE_LOST,
  ATTACK,
  ATTACKING,
  FULL,
  MOVE,
  needsStamina,
  NO_ARMY_OUT,
  PICK_AN_ARMY,
  ON_ITS_WAY,
  REALM,
  tooFarFrom,
  TROOPS,
  BEAST,
  FIGHT_WORDS,
  WOULD_BE_LOST,
  XP,
} from "@/ui/design-system/kit/words";

import type { OrderInFlight } from "@/hooks/store/use-actions-in-flight";
import { type ReactNode, useState } from "react";

import { useEnterConfirms } from "../hud/enter-confirms";
import type { Cost } from "../hud/army-order";
import { FightBar } from "./fight-bar";
import { shareTaken } from "./fight-record";
import type { SiteFight } from "./site-card-plan";
import { type AttackTargetKind, TARGET_MARKS, attackTargetName } from "./site-marks";

/** The step under the outcome: Attack (the same tap whatever the forecast), Move until the army is in reach, or
 * Attack held back, by the stamina the army lacks or by a site too far for one order. One line under it says why. */
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
  | { kind: "far" };

/**
 * An army that could take the site, offered when none is selected: the fight it would have from where it stands (the
 * attack preview's own forecast), or none while it is out of reach or the site is not a fight. Picking it selects that
 * army for the site, whose card then acts for it.
 */
export type SiteChoice = {
  label: string;
  art: IconMeaning;
  troops: number;
  fight: SiteFight | undefined;
  onPick: () => void;
};

/**
 * A guarded site's card (wireframe 06), read as its result will read (the owner's option A): what this attack comes to,
 * each side's troops before and after it ("you lose", "you kill", each with its share), and what the clear pays when
 * cleared (what fits large, with its XP, or a ruin's chest with its tier and exact LORDS). Its foot is the sheet's: Details, which
 * opens the whole fight's figures, and Realm on the left; the one step alone on the right.
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
  xp,
  verb,
  choices,
  receipt,
  onRealm,
  onClose,
}: {
  site: AttackTargetKind;
  /** The site's own name, the one its map plate and every list give it: the card's title, its kind beneath. */
  name?: string;
  beast: (Pick<FrontierBeast, "beast" | "name"> & { combatClass: string }) | undefined;
  army: { art: IconMeaning; troops: number } | null;
  guard: number | null | undefined;
  fight: SiteFight | undefined;
  /** What a camp or rift pays: the full amount, and what fits when the store would overflow. */
  pay: { icon: IconMeaning; amount: number; fits?: number } | null;
  /** A ruin's chest: its tier and the exact LORDS stored with it; undefined until the facts carry them. */
  chest?: { tier: Tier; lords: number };
  xp: number | undefined;
  verb: SiteVerb | null;
  choices?: readonly SiteChoice[];
  receipt?: ReactNode;
  /** The way to make room when the payout does not all fit. */
  onRealm?: () => void;
  onClose: () => void;
}) => {
  const { word: kind, icon } = TARGET_MARKS[site];
  const word = attackTargetName(site, beast);
  const lost = fight && fight.outcome === "loses";
  const [details, setDetails] = useState(false);
  // With no army selected the realm's armies are the choices, and the guard moves up beside the kind.
  const picking = choices !== undefined;
  const guardIcon = beast ? beastMeaning(beast.beast) : "troops";
  // The army against a guard of known size, with the fight forecast: what option A reads, side by side.
  const facing = picking ? undefined : facingOf(army, guard, fight);
  return (
    <HudSheet label={name ?? word} onClose={onClose}>
      <header className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <SiteMark icon={beast ? beastMeaning(beast.beast) : icon} />
          {facing ? (
            <Outcome facing={facing} line={beast && beast.name !== kind ? `${beast.name} · ${kind}` : kind} />
          ) : (
            name && kind !== beast?.name && <span className="text-hud-label text-hud-muted">{kind}</span>
          )}
        </span>
        {picking && <BeastGuard beast={beast} guard={guard} />}
      </header>
      {picking && choices ? (
        <ArmyChoices does="attack" choices={choices} guardIcon={guardIcon} />
      ) : facing ? (
        <div className="flex gap-2">
          <Side
            art={facing.army.art}
            before={facing.army.troops}
            change={facing.fight.troopsLost}
            word={FIGHT_WORDS.youLose}
            side="ours"
          />
          <Side
            art={guardIcon}
            before={facing.guard}
            change={facing.guard - facing.fight.guardLeft}
            word={FIGHT_WORDS.youKill}
            side="theirs"
            tip={beast?.combatClass}
          />
        </div>
      ) : (
        <Matchup army={army} beast={beast} guard={guard} />
      )}
      <Gain dimmed={lost === true}>
        {chest ? <ChestPay chest={chest} /> : pay ? <Pay pay={pay} /> : null}
        {xp !== undefined && !(chest && lost) && (
          <HudChip>
            {formatShort(xp, { signed: true })} {XP}
          </HudChip>
        )}
      </Gain>
      {details && facing && <WholeFight fight={facing.fight} guard={facing.guard} />}
      {receipt}
      <Verb
        verb={verb}
        site={word}
        armyLost={lost === true}
        details={facing ? { open: details, onToggle: () => setDetails((open) => !open) } : undefined}
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

/** What this attack comes to, in the card's title words, over the guard and the site's kind. */
const Outcome = ({ facing: { army, fight }, line }: { facing: Facing; line: string }) => {
  const armyLost = fight.troopsLost >= army.troops;
  const word = armyLost ? FIGHT_WORDS.armyLost : fight.guardLeft === 0 ? FIGHT_WORDS.clears : FIGHT_WORDS.holds;
  return (
    <span className="flex min-w-0 flex-col">
      <span className={cn("text-hud-title", armyLost ? "text-hud-bad" : "text-hud-ink")}>{word}</span>
      <span className="truncate text-hud-body text-hud-muted">{line}</span>
    </span>
  );
};

/**
 * One side of this attack: its troops before → after, the after in red when none are left, its bar in its colour with
 * the part the attack takes in grey, and what it loses with its share of the side; a beast's combat class on its hover.
 */
const Side = ({
  art,
  before,
  change,
  word,
  side,
  tip,
}: {
  art: IconMeaning;
  before: number;
  change: number;
  word: (troops: string, share: string) => string;
  side: "ours" | "theirs";
  tip?: string;
}) => {
  const after = Math.max(0, before - change);
  return (
    <HudPanel collapsible={false} className="flex-1" bodyClassName="flex flex-col items-center gap-1 py-2">
      <span className="flex items-center gap-2 tabular-nums" data-tip={tip}>
        <SemanticIcon name={art} size={26} />
        <span className="whitespace-nowrap text-hud-body text-hud-muted">{formatExact(before)} →</span>
        <span className={cn("text-hud-display leading-none", after === 0 ? "text-hud-bad" : "text-hud-ink")}>
          {formatExact(after)}
        </span>
      </span>
      <FightBar before={before} after={after} side={side} />
      <span className="text-hud-label text-hud-muted">{word(formatExact(change), shareTaken(change, before))}</span>
    </HudPanel>
  );
};

/** What the clear pays, "When cleared" however many attacks it takes (Details counts them); dimmed when the fight is lost. */
const Gain = ({ dimmed, children }: { dimmed: boolean; children: ReactNode }) => (
  <HudPanel
    collapsible={false}
    className={cn(dimmed && "opacity-50")}
    bodyClassName="flex items-center justify-between gap-3 py-2"
  >
    <span className="text-hud-label text-hud-muted">{FIGHT_WORDS.whenCleared}</span>
    <span className="flex flex-wrap items-center justify-end gap-3">{children}</span>
  </HudPanel>
);

/** Details: the whole fight's figures, attack after attack until it ends: how it ends, and what it costs each side. */
const WholeFight = ({ fight, guard }: { fight: KnownFight; guard: number }) => (
  <HudPanel collapsible={false} bodyClassName="flex flex-col gap-1 py-2">
    <span className="text-hud-label text-hud-muted">{FIGHT_WORDS.wholeFight}</span>
    <dl className="flex flex-col gap-1 text-hud-body">
      <Figure
        name={FIGHT_WORDS.attacks}
        value={`${formatExact(fight.exchanges)} · ${FIGHT_WORDS.ends[fight.outcome]}`}
      />
      <Figure name={FIGHT_WORDS.lose} value={`−${formatExact(fight.whole.troopsLost)}`} bad />
      <Figure name={FIGHT_WORDS.kill} value={`${formatExact(fight.whole.guardKilled)} / ${formatExact(guard)}`} />
      <Figure name={FIGHT_WORDS.stamina} value={formatExact(fight.whole.stamina)} />
    </dl>
  </HudPanel>
);

/** One of the whole fight's figures: its name, and its value at the right. */
const Figure = ({ name, value, bad = false }: { name: string; value: string; bad?: boolean }) => (
  <div className="flex items-center justify-between gap-4">
    <dt className="text-hud-muted">{name}</dt>
    <dd className={cn("tabular-nums", bad ? "text-hud-bad" : "text-hud-ink")}>{value}</dd>
  </div>
);

/** A site's painting at the head of its card; `children` marks it (a won fight's flag). */
export const SiteMark = ({ icon, children }: { icon: IconMeaning; children?: ReactNode }) => (
  <span className="relative flex size-16 shrink-0 items-center justify-center rounded-xl border border-hud-line bg-hud-surface">
    <SemanticIcon name={icon} size={36} />
    {children}
  </span>
);

const Matchup = ({
  army,
  beast,
  guard,
}: {
  army: { art: IconMeaning; troops: number } | null;
  beast: (Pick<FrontierBeast, "beast" | "name"> & { combatClass: string }) | undefined;
  guard: number | null | undefined;
}) => (
  <div className="flex items-center justify-center gap-2">
    {army && (
      <HudChip icons={[army.art]} label={TROOPS}>
        {formatShort(army.troops)}
      </HudChip>
    )}
    <SemanticIcon name="attack" size={22} />
    <BeastGuard beast={beast} guard={guard} />
  </div>
);

/** Species and remaining strength, including while choosing an army. */
const BeastGuard = ({
  beast,
  guard,
}: {
  beast: (Pick<FrontierBeast, "beast" | "name"> & { combatClass: string }) | undefined;
  guard: number | null | undefined;
}) =>
  guard === null ? null : (
    <span className="flex items-center gap-2" data-tip={beast?.combatClass}>
      {beast && <span className="text-hud-strong text-hud-ink">{beast.name}</span>}
      <HudChip icons={[beast ? beastMeaning(beast.beast) : "troops"]} label={beast ? BEAST : TROOPS}>
        {formatShort(guard)}
      </HudChip>
    </span>
  );

/**
 * A site's card with no army selected, whatever the site: what an army does there, then each of the realm's armies as
 * a row (with the fight it would have, at a guarded site) that a tap picks for it; with none out, where one comes from.
 */
export const ArmyChoices = ({
  does,
  choices,
  guardIcon,
}: {
  does: keyof typeof PICK_AN_ARMY;
  choices: readonly SiteChoice[];
  /** The guard's mark, at a site an army fights; its rows then carry their forecasts. */
  guardIcon?: IconMeaning;
}) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-hud-label text-hud-muted">{choices.length > 0 ? PICK_AN_ARMY[does] : NO_ARMY_OUT}</p>
    {choices.map((choice) => (
      <HudRow
        key={choice.label}
        lead={<SemanticIcon name={choice.art} alt="" className="size-8 rounded-full object-cover" />}
        title={choice.label}
        detail={`${formatExact(choice.troops)} ${TROOPS}`}
        onClick={choice.onPick}
        trail={
          <>
            {guardIcon && <Forecast fight={choice.fight} size="row" guardIcon={guardIcon} />}
            <SemanticIcon name="chevron-right" size={16} />
          </>
        }
      />
    ))}
  </div>
);

/**
 * One forecast, drawn the same on the attack's plate and on an army's row. The flag's count is the attacks the whole
 * fight takes to win; the figures are the one attack Attack sends now, as its result will show them: the
 * troops it costs and, while the guard still stands after it, the guard left. A fight the army does not win shows
 * both in amber, under a skull that names itself. Unknown is a dash on the plate and nothing on a row.
 */
const Forecast = ({
  fight,
  size,
  guardIcon = "troops",
}: {
  fight: SiteFight | undefined;
  size: "plate" | "row";
  guardIcon?: IconMeaning;
}) => {
  const known = fight && fight.outcome !== "refused" ? fight : undefined;
  if (!known && size === "row") return null;
  if (known && known.outcome !== "wins") {
    return (
      <>
        <Line
          icon="skull"
          value={`−${formatExact(known.troopsLost)}`}
          hot
          name={known.outcome === "loses" ? WOULD_BE_LOST : undefined}
        />
        <Line icon={guardIcon} value={formatExact(known.guardLeft)} hot />
      </>
    );
  }
  return (
    <>
      <Line icon="flag" value={known ? `×${known.exchanges}` : "—"} name={FIGHT_WORDS.attacks} />
      <Line icon="skull" value={known ? `−${formatExact(known.troopsLost)}` : "—"} />
      {known && known.guardLeft > 0 && <Line icon={guardIcon} value={formatExact(known.guardLeft)} />}
    </>
  );
};

/** An icon and its figure; a name puts the line on the tooltip (hover, or press-and-hold). */
const Line = ({
  icon,
  value,
  hot = false,
  name,
}: {
  icon: IconMeaning;
  value: string;
  hot?: boolean;
  name?: string;
}) => (
  <span className="flex items-center gap-1.5" data-tip={name}>
    <SemanticIcon name={icon} size={22} />
    <span className={cn("text-hud-display leading-none tabular-nums", hot ? "text-hud-bad" : "text-hud-ink")}>
      {value}
    </span>
  </span>
);

/** What a clear pays home, what fits large; the full amount small beside a full bar when it does not all fit. */
const Pay = ({ pay }: { pay: { icon: IconMeaning; amount: number; fits?: number } }) => {
  const short = pay.fits !== undefined && pay.fits < pay.amount;
  return (
    <>
      <span className="flex items-center gap-1.5">
        <SemanticIcon name={pay.icon} size={28} />
        <span className="text-hud-display leading-none tabular-nums text-hud-gold">
          +{formatExact(short ? pay.fits : pay.amount)}
        </span>
      </span>
      {short && (
        <span className="flex w-4/5 items-center gap-1.5">
          <span className="text-hud-body tabular-nums text-hud-muted">{formatExact(pay.amount)}</span>
          <HudMeter share={1} tone="bad" label={FULL} />
        </span>
      )}
    </>
  );
};

/** A ruin's chest: the exact LORDS it pays, fixed when it was found, and its tier. */
const ChestPay = ({ chest }: { chest: { tier: Tier; lords: number } }) => (
  <>
    <span className="flex items-center gap-1.5" aria-label={`${formatExact(chest.lords)} ${LORDS}`}>
      <SemanticIcon name="chest" size={26} />
      <SemanticIcon name="lords" size={22} />
      <span className="text-hud-display leading-none tabular-nums text-hud-gold">+{formatExact(chest.lords)}</span>
    </span>
    <HudRarity tier={chest.tier} />
  </>
);

const Verb = ({
  verb,
  site,
  armyLost,
  details,
  onRealm,
}: {
  verb: SiteVerb | null;
  site: string;
  /** The forecast ends with the army gone: Attack still runs, in red, and says so. */
  armyLost: boolean;
  /** Details, while the fight is known: whether the whole fight's figures are open, and the press that opens them. */
  details: { open: boolean; onToggle: () => void } | undefined;
  onRealm: (() => void) | undefined;
}) => {
  const warns = verb?.kind === "attack" && armyLost;
  // Enter confirms the attack the forecast wins or stalls; one that loses the army takes a deliberate tap.
  useEnterConfirms(verb?.kind === "attack" && !verb.inFlight && !warns ? verb.onAttack : undefined);
  if (!verb) return null;
  return (
    <>
      <VerbLine {...verbLine(verb, site, warns)} />
      <HudWindowFoot note={<HudCost line={costLine(verb.kind === "move" ? verb.prices : attackPrices(verb))} />}>
        {details && (
          <HudButton kind="secondary" aria-expanded={details.open} onClick={details.onToggle}>
            {FIGHT_WORDS.details}
          </HudButton>
        )}
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
 * is the news. Otherwise the warning, or why the step is not Attack.
 */
const verbLine = (verb: SiteVerb, site: string, warns: boolean): { line: string | undefined; warns: boolean } => {
  if (verb.kind === "attack" && verb.refused && !verb.inFlight) return { line: verb.refused, warns: true };
  return { line: warns ? ARMY_WILL_BE_LOST : verbReason(verb, site), warns };
};

const attackPrices = (verb: Exclude<SiteVerb, { kind: "move" }>): readonly Price[] => {
  if (verb.kind === "attack") return [{ of: "stamina", amount: verb.stamina }];
  return verb.kind === "short" ? [{ of: "stamina", amount: verb.stamina.cost }] : [];
};

/** Why the step is not Attack, or cannot run: the stamina missing and when it is back, or the site out of reach. */
const verbReason = (verb: SiteVerb, site: string): string | undefined => {
  if (verb.kind === "attack") return undefined;
  if (verb.kind !== "short") return tooFarFrom(site);
  const { cost, held, wait } = verb.stamina;
  const pair = formatHeldAgainst(held, cost);
  const line = needsStamina(pair.need, pair.held);
  return wait === undefined ? line : `${line} · ${formatDuration(wait, { days: false })}`;
};

const VerbLine = ({ line, warns }: { line: string | undefined; warns: boolean }) =>
  line === undefined ? null : (
    <p role="status" className={cn("text-center text-hud-body", warns ? "text-hud-bad" : "text-hud-ink")}>
      {line}
    </p>
  );
