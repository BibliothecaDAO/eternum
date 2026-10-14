import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount, formatExact } from "@/ui/design-system/kit/amount";
import { Button, type Price } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { StoreBar } from "@/ui/design-system/kit/store-bar";
import { type Tier, TierChip } from "@/ui/design-system/kit/tier-chip";
import { formatDuration } from "@/ui/design-system/kit/time";
import {
  ARMY_WILL_BE_LOST,
  ATTACK,
  ATTACKING,
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
  art: string;
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
  army: { art: string; troops: number } | null;
  guard: number | null | undefined;
  fight: SiteFight | undefined;
  /** What a camp or rift pays: the full amount, and what fits when the store would overflow. */
  pay: { icon: IconCode; amount: number; fits?: number } | null;
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
    <Sheet label={word} onClose={onClose}>
      <header className="flex items-center gap-3">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-kit-line2 bg-kit-ground">
          <KitIcon code={icon} size={36} />
        </span>
        <h2 className="frontier-title flex-1">{word}</h2>
        {picking && guard !== null && <Chip icons={["Tr"]} label={TROOPS} value={formatExact(guard)} />}
      </header>
      {picking && choices ? <Choices choices={choices} /> : <Matchup army={army} beast={beast} guard={guard} />}
      <div className="flex gap-2">
        {!picking && <FightPlate fight={fight} />}
        <div
          className={cn(
            "frontier-card flex h-[92px] flex-1 flex-col items-center justify-center gap-1 !rounded-xl !border-2 !border-kit-gold",
            lost && "opacity-50",
          )}
        >
          {chest ? <ChestPay chest={chest} /> : pay ? <Pay pay={pay} /> : null}
          {xp !== undefined && !(chest && lost) && (
            <Chip icons={[]} label={XP} value={`+${formatAmount(xp)}`} unit={XP} />
          )}
        </div>
      </div>
      {guide}
      <Verb
        verb={verb}
        site={word}
        armyLost={lost === true}
        onRealm={pay?.fits !== undefined && pay.fits < pay.amount ? onRealm : undefined}
      />
    </Sheet>
  );
};

const Matchup = ({
  army,
  beast,
  guard,
}: {
  army: { art: string; troops: number } | null;
  beast: string | undefined;
  guard: number | null | undefined;
}) => (
  <div className="flex items-center justify-center gap-2">
    {army && (
      <span data-tone="lit" className="frontier-chip h-8 !py-0 !pl-1">
        <span className="contents">
          <img src={army.art} alt="" className="size-[22px] rounded-full object-cover" />
          <span className="frontier-chip-number tabular-nums !text-base">{formatExact(army.troops)}</span>
        </span>
      </span>
    )}
    <KitIcon code="At" size={22} />
    {beast && <span className="text-sm font-semibold text-kit-cream">{beast}</span>}
    {guard !== null && <Chip icons={["Tr"]} label={TROOPS} value={formatExact(guard)} />}
  </div>
);

/** No army selected: each army is a row with the fight it would have, and a tap opens the attack with it. */
const Choices = ({ choices }: { choices: readonly SiteChoice[] }) => (
  <div className="flex flex-col gap-1.5">
    {choices.map((choice) => (
      <button
        key={choice.label}
        type="button"
        aria-label={choice.label}
        onClick={choice.onPick}
        className="frontier-card flex h-14 w-full items-center gap-2 !rounded-xl px-2.5"
      >
        <img src={choice.art} alt="" className="size-8 rounded-full object-cover" />
        <span className="text-base tabular-nums text-kit-cream">{formatExact(choice.troops)}</span>
        <span className="flex flex-1 items-center justify-end gap-3">
          <Forecast fight={choice.fight} size="row" />
        </span>
        <KitIcon code="Cv" size={16} />
      </button>
    ))}
  </div>
);

/** The fight: attacks to win as pips beside the flag and what this attack costs; or, a loss, in amber, never greyed. */
const FightPlate = ({ fight }: { fight: SiteFight | undefined }) => (
  <div
    {...guideTarget("forecast")}
    className="frontier-card flex h-[92px] flex-1 flex-col items-center justify-center gap-1.5 !rounded-xl"
  >
    <Forecast fight={fight} size="plate" />
  </div>
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
          icon="Sk"
          value={`−${formatExact(known.troopsLost)}`}
          hot
          name={known.outcome === "loses" ? WOULD_BE_LOST : undefined}
        />
        <Line icon="Tr" value={formatExact(known.guardLeft)} hot />
      </>
    );
  }
  return (
    <>
      <span className="flex items-center gap-1.5" aria-label={known ? `${known.exchanges}` : "—"}>
        <KitIcon code="Fl" size={22} />
        {known ? (
          <span aria-hidden className="flex gap-[3px]">
            {Array.from({ length: known.exchanges }, (_, index) => (
              <i key={index} className="size-[9px] rounded-full border border-kit-gold" />
            ))}
          </span>
        ) : (
          <span className="text-lg tabular-nums text-kit-cream">—</span>
        )}
      </span>
      <Line icon="Sk" value={known ? `−${formatExact(known.troopsLost)}` : "—"} />
      {known && known.guardLeft > 0 && <Line icon="Tr" value={formatExact(known.guardLeft)} />}
    </>
  );
};

/** An icon and its figure; a name puts the line on the tooltip (hover, or press-and-hold). */
const Line = ({ icon, value, hot = false, name }: { icon: IconCode; value: string; hot?: boolean; name?: string }) => (
  <span className="flex items-center gap-1.5" data-tip={name}>
    <KitIcon code={icon} size={22} />
    <span className={cn("text-xl leading-none tabular-nums", hot ? "text-kit-hot" : "text-kit-cream")}>{value}</span>
  </span>
);

/** What a clear pays home, what fits large; the full amount small beside a full bar when it does not all fit. */
const Pay = ({ pay }: { pay: { icon: IconCode; amount: number; fits?: number } }) => {
  const short = pay.fits !== undefined && pay.fits < pay.amount;
  return (
    <>
      <span className="flex items-center gap-1.5">
        <KitIcon code={pay.icon} size={28} />
        <span className="text-[26px] leading-none tabular-nums text-kit-gold2">
          +{formatExact(short ? pay.fits : pay.amount)}
        </span>
      </span>
      {short && (
        <span className="flex w-4/5 items-center gap-1.5">
          <span className="text-sm tabular-nums text-kit-muted">{formatExact(pay.amount)}</span>
          <StoreBar amount={1} limit={1} tone="ember" />
        </span>
      )}
    </>
  );
};

/** A ruin's chest: the exact LORDS it pays, fixed when it was found, and its tier. */
const ChestPay = ({ chest }: { chest: { tier: Tier; lords: number } }) => (
  <>
    <span className="flex items-center gap-1.5" aria-label={`${formatExact(chest.lords)} ${LORDS}`}>
      <KitIcon code="Ch" size={26} />
      <KitIcon code="Lo" size={22} />
      <span className="text-[24px] leading-none tabular-nums text-kit-gold2">+{formatExact(chest.lords)}</span>
    </span>
    <TierChip tier={chest.tier} showWord />
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
      <div className="flex gap-2">
        {onRealm && <Button role="secondary" icon="Cs" word={REALM} className="w-[120px]" onClick={onRealm} />}
        {verb.kind === "move" ? (
          <Button role="primary" icon="Bt" word={MOVE} prices={verb.prices} onClick={verb.onMove} className="flex-1" />
        ) : (
          <Button
            role="primary"
            icon="At"
            word={ATTACK}
            prices={attackPrices(verb)}
            loading={verb.kind === "attack" ? inFlightWord(verb.inFlight, "attack", ATTACKING) : undefined}
            disabled={verb.kind !== "attack"}
            warns={warns}
            onClick={verb.kind === "attack" ? verb.onAttack : undefined}
            className="flex-1"
          />
        )}
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
    <p role="status" className={cn("text-center text-sm", warns ? "text-kit-red" : "text-kit-cream")}>
      {line}
    </p>
  );
