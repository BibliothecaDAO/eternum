import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount, formatExact } from "@/ui/design-system/kit/amount";
import { Button, type Price } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { StoreBar } from "@/ui/design-system/kit/store-bar";
import { type Tier, TierChip } from "@/ui/design-system/kit/tier-chip";
import {
  ATTACK,
  ATTACKING,
  CAMP,
  LORDS,
  MOVE,
  REALM,
  RIFT,
  RUIN,
  STRAGGLERS,
  TROOPS,
  XP,
} from "@/ui/design-system/kit/words";

import type { ReactNode } from "react";

import { guideTarget } from "../guide/guide-thread";
import type { Cost } from "../hud/army-order";
import type { SiteFight } from "./site-card-plan";

/** The guarded sites; stragglers are drawn now and read once the contracts' taxonomy names them. */
type GuardedSite = "camp" | "rift" | "ruin" | "stragglers";

const SITES: Record<GuardedSite, { word: string; icon: IconCode }> = {
  camp: { word: CAMP, icon: "Cp" },
  rift: { word: RIFT, icon: "Rf" },
  ruin: { word: RUIN, icon: "Fr" },
  stragglers: { word: STRAGGLERS, icon: "Tr" },
};

/** The step under the outcome: Attack (the same tap whatever the forecast), Move until the army is in reach, or the
 * stamina held against the attack's cost. */
export type SiteVerb =
  | { kind: "attack"; stamina: number; sending: boolean; onAttack: () => void }
  | { kind: "move"; prices: readonly Price[]; onMove: () => void }
  | { kind: "short"; stamina: Cost };

/** An army that could take the site, offered when none is selected: its forecast marked win or loss. */
export type SiteChoice = { label: string; art: string; troops: number; wins: boolean | undefined; onPick: () => void };

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
  site: GuardedSite;
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
  const { word, icon } = SITES[site];
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
        <FightPlate fight={fight} />
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
      <Verb verb={verb} onRealm={pay?.fits !== undefined && pay.fits < pay.amount ? onRealm : undefined} />
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
          <span className="frontier-chip-number tabular-nums !text-[15px]">{formatExact(army.troops)}</span>
        </span>
      </span>
    )}
    <KitIcon code="At" size={22} />
    {beast && <span className="text-[13px] font-semibold text-kit-cream">{beast}</span>}
    {guard !== null && <Chip icons={["Tr"]} label={TROOPS} value={formatExact(guard)} />}
  </div>
);

/** No army selected: the armies are the choices, each marked with its forecast. */
const Choices = ({ choices }: { choices: readonly SiteChoice[] }) => (
  <div className="flex gap-1.5">
    {choices.map((choice) => (
      <button
        key={choice.label}
        type="button"
        aria-label={choice.label}
        onClick={choice.onPick}
        className="frontier-card flex h-16 min-w-0 flex-1 items-center justify-center gap-1.5 !rounded-xl"
      >
        <img src={choice.art} alt="" className="size-8 rounded-full object-cover" />
        <span className="text-[15px] tabular-nums text-kit-cream">{formatExact(choice.troops)}</span>
        {choice.wins !== undefined && <KitIcon code={choice.wins ? "Fl" : "Sk"} size={20} />}
      </button>
    ))}
  </div>
);

/** The fight: attacks to win as pips beside the flag and the troops it costs; or, a loss, in amber, never greyed. */
const FightPlate = ({ fight }: { fight: SiteFight | undefined }) => {
  const known = fight && fight.outcome !== "refused" ? fight : undefined;
  const loses = known && known.outcome !== "wins";
  return (
    <div
      {...guideTarget("forecast")}
      className="frontier-card flex h-[92px] flex-1 flex-col items-center justify-center gap-1.5 !rounded-xl"
    >
      {loses ? (
        <>
          <Line icon="Sk" value={`−${formatExact(known.troopsLost)}`} hot />
          <Line icon="Tr" value={formatExact(known.guardLeft)} hot />
        </>
      ) : (
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
              <span className="text-[18px] tabular-nums text-kit-cream">—</span>
            )}
          </span>
          <Line icon="Sk" value={known ? `−${formatExact(known.troopsLost)}` : "—"} />
        </>
      )}
    </div>
  );
};

const Line = ({ icon, value, hot = false }: { icon: IconCode; value: string; hot?: boolean }) => (
  <span className="flex items-center gap-1.5">
    <KitIcon code={icon} size={22} />
    <span className={cn("text-[20px] leading-none tabular-nums", hot ? "text-kit-hot" : "text-kit-cream")}>
      {value}
    </span>
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
          <span className="text-[14px] tabular-nums text-kit-muted">{formatExact(pay.amount)}</span>
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

const Verb = ({ verb, onRealm }: { verb: SiteVerb | null; onRealm: (() => void) | undefined }) => {
  if (!verb) return null;
  if (verb.kind === "short") {
    const { held, cost, wait } = verb.stamina;
    return <ReasonPlate reason={{ kind: "short", icon: "St", held, need: cost, wait }} />;
  }
  return (
    <div className="flex gap-2">
      {onRealm && <Button role="secondary" icon="Cs" word={REALM} className="w-[120px]" onClick={onRealm} />}
      {verb.kind === "attack" ? (
        <Button
          role="primary"
          icon="At"
          word={ATTACK}
          prices={[{ of: "stamina", amount: verb.stamina }]}
          loading={verb.sending ? ATTACKING : undefined}
          onClick={verb.onAttack}
          className="flex-1"
        />
      ) : (
        <Button role="primary" icon="Bt" word={MOVE} prices={verb.prices} onClick={verb.onMove} className="flex-1" />
      )}
    </div>
  );
};
