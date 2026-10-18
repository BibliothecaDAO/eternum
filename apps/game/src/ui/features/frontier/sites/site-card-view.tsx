import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount, formatExact } from "@/ui/design-system/kit/amount";
import {
  HudButton,
  HudChip,
  HudMeter,
  HudPanel,
  HudRarity,
  HudRow,
  HudSheet,
} from "@/ui/design-system/kit/hud-elements";
import { hudPrices, type Price } from "../hud-prices";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { formatDuration } from "@/ui/design-system/kit/time";
import {
  ARMY_WILL_BE_LOST,
  ATTACK,
  ATTACKING,
  FULL,
  LORDS,
  MOVE,
  needsStamina,
  ON_ITS_WAY,
  REALM,
  tooFarFrom,
  TROOPS,
  WOULD_BE_LOST,
  XP,
} from "@/ui/design-system/kit/words";

import type { OrderInFlight } from "@/hooks/store/use-actions-in-flight";
import type { ReactNode } from "react";

import { guideTarget } from "../guide/guide-thread";
import { useEnterConfirms } from "../hud/enter-confirms";
import type { Cost } from "../hud/army-order";
import type { SiteFight } from "./site-card-plan";
import { type AttackTargetKind, TARGET_MARKS } from "./site-marks";

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
 * attack preview's own forecast), or none while it is out of reach. Picking it opens the attack with that army.
 */
export type SiteChoice = {
  label: string;
  art: IconMeaning;
  troops: number;
  fight: SiteFight | undefined;
  onPick: () => void;
};

/**
 * A guarded site's card (wireframe 06): the kind, the matchup (the army against the guard, a ruin's beast named on it),
 * the outcome pair (the fight: attacks to win and troops lost, or troops lost and the guard left in amber; and what the
 * clear pays, what fits large, with its XP, or a ruin's chest with its tier and exact LORDS), then one step.
 */
export const SiteCardView = ({
  site,
  beast,
  army,
  guard,
  fight,
  pay,
  chest,
  xp,
  verb,
  choices,
  guide,
  onRealm,
  onClose,
}: {
  site: AttackTargetKind;
  beast: string | undefined;
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
  /** The guide's line when it speaks about this fight. */
  guide?: ReactNode;
  /** The way to make room when the payout does not all fit. */
  onRealm?: () => void;
  onClose: () => void;
}) => {
  const { word, icon } = TARGET_MARKS[site];
  const lost = fight && fight.outcome === "loses";
  // With no army selected the realm's armies are the choices, and the guard moves up beside the kind.
  const picking = choices !== undefined && choices.length > 0;
  return (
    <HudSheet label={word} onClose={onClose}>
      <header className="flex items-center justify-between gap-3">
        <SiteMark icon={icon} />
        {picking && guard !== null && (
          <HudChip icons={["troops"]} label={TROOPS}>
            {formatExact(guard)}
          </HudChip>
        )}
      </header>
      {picking && choices ? <Choices choices={choices} /> : <Matchup army={army} beast={beast} guard={guard} />}
      <div className="flex gap-2">
        {!picking && <FightPlate fight={fight} />}
        <Plate dimmed={lost}>
          {chest ? <ChestPay chest={chest} /> : pay ? <Pay pay={pay} /> : null}
          {xp !== undefined && !(chest && lost) && (
            <HudChip>
              {`+${formatAmount(xp)}`} {XP}
            </HudChip>
          )}
        </Plate>
      </div>
      {guide}
      <Verb
        verb={verb}
        site={word}
        armyLost={lost === true}
        onRealm={pay?.fits !== undefined && pay.fits < pay.amount ? onRealm : undefined}
      />
    </HudSheet>
  );
};

/** A site's painting at the head of its card; `children` marks it (a won fight's flag). */
export const SiteMark = ({ icon, children }: { icon: IconMeaning; children?: ReactNode }) => (
  <span className="relative flex size-16 shrink-0 items-center justify-center rounded-xl border border-hud-line bg-hud-surface">
    <SemanticIcon name={icon} size={36} />
    {children}
  </span>
);

/** One half of a card's outcome pair, a fight or a pay, on the panel's surface; dimmed when it will not happen. */
const Plate = ({ dimmed = false, children }: { dimmed?: boolean; children: ReactNode }) => (
  <HudPanel
    collapsible={false}
    className={cn("flex-1", dimmed && "opacity-50")}
    bodyClassName="flex h-hud-frontier-card flex-col items-center justify-center gap-1.5"
  >
    {children}
  </HudPanel>
);

const Matchup = ({
  army,
  beast,
  guard,
}: {
  army: { art: IconMeaning; troops: number } | null;
  beast: string | undefined;
  guard: number | null | undefined;
}) => (
  <div className="flex items-center justify-center gap-2">
    {army && (
      <HudChip icons={[army.art]} label={TROOPS}>
        {formatExact(army.troops)}
      </HudChip>
    )}
    <SemanticIcon name="attack" size={22} />
    {beast && <span className="text-hud-strong text-hud-ink">{beast}</span>}
    {guard !== null && (
      <HudChip icons={["troops"]} label={TROOPS}>
        {formatExact(guard)}
      </HudChip>
    )}
  </div>
);

/** No army selected: each army is a row with the fight it would have, and a tap opens the attack with it. */
const Choices = ({ choices }: { choices: readonly SiteChoice[] }) => (
  <div className="flex flex-col gap-1.5">
    {choices.map((choice) => (
      <HudRow
        key={choice.label}
        lead={<SemanticIcon name={choice.art} alt="" className="size-8 rounded-full object-cover" />}
        title={choice.label}
        detail={`${formatExact(choice.troops)} ${TROOPS}`}
        onClick={choice.onPick}
        trail={
          <>
            <Forecast fight={choice.fight} size="row" />
            <SemanticIcon name="chevron-right" size={16} />
          </>
        }
      />
    ))}
  </div>
);

/** The fight: attacks to win as pips beside the flag and what this attack costs; or, a loss, in amber, never greyed. */
const FightPlate = ({ fight }: { fight: SiteFight | undefined }) => (
  <span {...guideTarget("forecast")} className="flex flex-1">
    <Plate>
      <Forecast fight={fight} size="plate" />
    </Plate>
  </span>
);

/**
 * One forecast, drawn the same on the attack's plate and on an army's row. The pips beside the flag count the attacks
 * the whole fight takes to win; the figures are the one attack Attack sends now, as its result will show them: the
 * troops it costs and, while the guard still stands after it, the guard left. A fight the army does not win shows
 * both in amber, under a skull that names itself. Unknown is a dash on the plate and nothing on a row.
 */
const Forecast = ({ fight, size }: { fight: SiteFight | undefined; size: "plate" | "row" }) => {
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
        <Line icon="troops" value={formatExact(known.guardLeft)} hot />
      </>
    );
  }
  return (
    <>
      <span className="flex items-center gap-1.5" aria-label={known ? `${known.exchanges}` : "—"}>
        <SemanticIcon name="flag" size={22} />
        {known ? (
          <span aria-hidden className="flex gap-1">
            {Array.from({ length: known.exchanges }, (_, index) => (
              <i key={index} className="size-2 rounded-full border border-hud-line-strong" />
            ))}
          </span>
        ) : (
          <span className="text-hud-title tabular-nums text-hud-ink">—</span>
        )}
      </span>
      <Line icon="skull" value={known ? `−${formatExact(known.troopsLost)}` : "—"} />
      {known && known.guardLeft > 0 && <Line icon="troops" value={formatExact(known.guardLeft)} />}
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
    <HudRarity tier={chest.tier} word />
  </>
);

const Verb = ({
  verb,
  site,
  armyLost,
  onRealm,
}: {
  verb: SiteVerb | null;
  site: string;
  /** The forecast ends with the army gone: Attack still runs, in red, and says so. */
  armyLost: boolean;
  onRealm: (() => void) | undefined;
}) => {
  const warns = verb?.kind === "attack" && armyLost;
  // Enter confirms the attack the forecast wins or stalls; one that loses the army takes a deliberate tap.
  useEnterConfirms(verb?.kind === "attack" && !verb.inFlight && !warns ? verb.onAttack : undefined);
  if (!verb) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className={cn("grid gap-2", onRealm && "grid-cols-3")}>
        {onRealm && (
          <HudButton kind="secondary" icon="realm" onClick={onRealm}>
            {REALM}
          </HudButton>
        )}
        <span className={cn("grid", onRealm && "col-span-2")}>
          {verb.kind === "move" ? (
            <HudButton kind="primary" icon="move" prices={hudPrices(verb.prices)} onClick={verb.onMove}>
              {MOVE}
            </HudButton>
          ) : (
            // An attack that loses the army is no gold verb: it says so in the bad tone and waits for a deliberate tap.
            <HudButton
              kind={warns ? "secondary" : "primary"}
              tone={warns ? "bad" : undefined}
              icon="attack"
              prices={hudPrices(attackPrices(verb))}
              busy={verb.kind === "attack" ? inFlightWord(verb.inFlight, "attack", ATTACKING) : undefined}
              disabled={verb.kind !== "attack"}
              onClick={verb.kind === "attack" ? verb.onAttack : undefined}
            >
              {ATTACK}
            </HudButton>
          )}
        </span>
      </div>
      <VerbLine {...verbLine(verb, site, warns)} />
    </div>
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
  const line = needsStamina(formatExact(cost), formatExact(held));
  return wait === undefined ? line : `${line} · ${formatDuration(wait)}`;
};

const VerbLine = ({ line, warns }: { line: string | undefined; warns: boolean }) =>
  line === undefined ? null : (
    <p role="status" className={cn("text-center text-hud-body", warns ? "text-hud-bad" : "text-hud-ink")}>
      {line}
    </p>
  );
