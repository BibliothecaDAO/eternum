import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount, formatExact } from "@/ui/design-system/kit/amount";
import { AmountSlider } from "@/ui/design-system/kit/amount-slider";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { DayEnds } from "@/ui/design-system/kit/clock-line";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { BUILD, DEPLOY, DEPLOYING, MOVE, STAMINA, TROOPS, WHEAT } from "@/ui/design-system/kit/words";
import type { Direction } from "@bibliothecadao/types";

import type { Tier } from "@/ui/design-system/kit/tier-chip";

import { AttributeMarks } from "../attributes/attribute-marks";
import type { DayClock } from "../hud/day-clock";
import { DeployRing } from "./deploy-ring";

type RingTile = { direction: Direction; open: boolean; explored: boolean };

/**
 * Deploy (wireframe 04), from its props: how many troops, the wheat they cost, the wheat left and how far it moves the
 * army, what each reveal sends home and the stamina it starts with, when it ends, and one Deploy carrying its wheat
 * price. The slider stops where the wheat runs out; with no troops at home, Build is the step. Unknown is a dash.
 */
export const DeployView = ({
  slots,
  art,
  troopsAtHome,
  count,
  troopsMax,
  wheatStop,
  onCount,
  equation,
  rations = false,
  revealYield,
  startingStamina,
  startingTiers,
  clock,
  ring,
  canDeploy,
  sending,
  onDeploy,
  wheatShort,
  onBuild,
  onClose,
}: {
  slots: { used: number; allowed: number } | undefined;
  art: string | undefined;
  troopsAtHome: number | undefined;
  count: number | undefined;
  troopsMax: number;
  /** The count where the wheat runs out, when it runs out before the troops do. */
  wheatStop: number | undefined;
  onCount: (count: number) => void;
  equation: { wheatCost: number; wheatLeft: number; tiles: number } | null | undefined;
  /** The Barracks took Rations: its mark sits on the wheat price. */
  rations?: boolean;
  revealYield: number | undefined;
  startingStamina: number | undefined;
  /** The tiers the realm's training buildings give a new army; unknown is undefined. */
  startingTiers?: readonly [Tier, Tier, Tier, Tier];
  clock: Pick<DayClock, "endsAt" | "secondsLeft" | "tone"> | undefined;
  ring: { tiles: readonly RingTile[]; chosen: Direction | null; onPick: (direction: Direction) => void } | undefined;
  canDeploy: boolean;
  sending: boolean;
  onDeploy: () => void;
  /** Not even one troop's wheat: held against one troop's price, and the farms' wait. */
  wheatShort: { held: number; need: number; wait: number | undefined } | undefined;
  onBuild: () => void;
  onClose: () => void;
}) => {
  const noTroops = troopsAtHome === 0;
  return (
    <Sheet label={DEPLOY} onClose={onClose}>
      <header className="flex items-center justify-between">
        <h2 className="frontier-title !text-[20px]">{DEPLOY}</h2>
        {slots && <SlotMarks used={slots.used} allowed={slots.allowed} />}
      </header>
      <Hero art={art} count={count} />
      <AmountSlider
        label={TROOPS}
        icon="Ey"
        value={count ?? 0}
        max={troopsMax}
        stop={wheatStop}
        end={formatExact(troopsMax)}
        disabled={noTroops}
        onChange={onCount}
      />
      {noTroops ? (
        <ReasonPlate
          reason={{ kind: "short", icon: "Tr", held: 0, need: 1 }}
          step={<Button role="primary" word={BUILD} className="w-[140px]" onClick={onBuild} />}
        />
      ) : (
        <>
          <Equation equation={equation} rations={rations} />
          <div className="flex items-center justify-center gap-1.5">
            {count === 1 ? (
              <Chip icons={["Ey"]} label={TROOPS} value="" />
            ) : (
              <Chip
                icons={["Es", "La"]}
                label={TROOPS}
                value={revealYield === undefined ? "—" : `+${formatAmount(revealYield)}`}
              />
            )}
            <Chip icons={["St"]} label={STAMINA} value={formatAmount(startingStamina)} />
            {startingTiers && <AttributeMarks tiers={startingTiers} />}
          </div>
          <DayEnds endsAt={clock?.endsAt} secondsLeft={clock?.secondsLeft} tone={clock?.tone ?? "calm"} />
          {ring && <DeployRing ring={ring.tiles} chosen={ring.chosen} onChoose={ring.onPick} />}
        </>
      )}
      {canDeploy && equation && (
        <Button
          role="primary"
          word={DEPLOY}
          prices={[{ of: "wheat", amount: equation.wheatCost }]}
          loading={sending ? DEPLOYING : undefined}
          onClick={onDeploy}
        />
      )}
      {wheatShort && <ReasonPlate reason={{ kind: "short", icon: "Wh", ...wheatShort }} />}
    </Sheet>
  );
};

/** The wheat equation: what the troops cost, the wheat left, and the tiles that wheat moves the army. */
const Equation = ({
  equation,
  rations,
}: {
  equation: { wheatCost: number; wheatLeft: number; tiles: number } | null | undefined;
  rations: boolean;
}) => (
  <div className="flex items-center justify-center gap-1.5">
    <Chip icons={rations ? ["Wh", "Ra"] : ["Wh"]} label={WHEAT} value={`−${formatExact(equation?.wheatCost)}`} />
    <span aria-hidden className="text-[16px] text-kit-muted">
      →
    </span>
    <Chip icons={["Wh"]} label={WHEAT} value={formatExact(equation?.wheatLeft)} ember={equation?.wheatLeft === 0} />
    <Chip icons={["Bt"]} label={MOVE} value={formatAmount(equation?.tiles)} ember={equation?.tiles === 0} />
  </div>
);

/** The troops as their portrait, and the count large beside it. */
const Hero = ({ art, count }: { art: string | undefined; count: number | undefined }) => (
  <div className="flex items-center justify-center gap-3.5">
    <span className="size-16 overflow-hidden rounded-full border border-kit-line2 bg-kit-ground">
      {art && <img src={art} alt="" className="size-full object-cover" />}
    </span>
    <span aria-label={TROOPS} className="frontier-hero tabular-nums">
      {formatExact(count)}
    </span>
  </div>
);

/** The day's army slots: one mark each, lit where an army stands. */
const SlotMarks = ({ used, allowed }: { used: number; allowed: number }) => (
  <span role="img" aria-label={`${used} / ${allowed}`} className="flex gap-[3px]">
    {Array.from({ length: allowed }, (_, index) => (
      <i
        key={index}
        className={cn("h-[18px] w-3 rounded-b-md rounded-t-sm border-2 border-kit-gold", index < used && "bg-kit-gold")}
      />
    ))}
  </span>
);
