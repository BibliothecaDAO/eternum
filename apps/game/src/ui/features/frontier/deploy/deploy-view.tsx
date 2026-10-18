import { formatAmount, formatExact } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import type { IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudNotice, HudPortrait, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { shortfallLine } from "@/ui/design-system/kit/reasons";
import { BUILD, DEPLOY, DEPLOY_FIGURES, DEPLOYING, TROOPS } from "@/ui/design-system/kit/words";
import type { Direction } from "@bibliothecadao/types";

import type { Tier } from "@/ui/design-system/kit/tier-chip";

import { AmountRange } from "../amount-range";
import { AttributeMarks } from "../attributes/attribute-marks";
import { DayEnds } from "../day-ends";
import type { DayClock } from "../hud/day-clock";
import { hudPrices } from "../hud-prices";
import { DeployRing } from "./deploy-ring";

type RingTile = { direction: Direction; open: boolean; explored: boolean };

/**
 * Deploy (wireframe 04), from its props: how many troops, the wheat they cost, the wheat left and how far it moves the
 * army, what each reveal sends home and the stamina it starts with, when it ends, and one Deploy carrying its wheat
 * price. The slider's ends are Minimum and Maximum; it stops where the wheat runs out. Every figure is an icon and a
 * number that names itself when asked. With no troops at home, Build is the step. Unknown is a dash.
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
  art: IconMeaning | undefined;
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
    <HudSheet label={DEPLOY} onClose={onClose}>
      {slots && (
        <span className="flex justify-end">
          <SlotMarks used={slots.used} allowed={slots.allowed} />
        </span>
      )}
      <Hero art={art} count={count} />
      <AmountRange
        label={TROOPS}
        icon="explore"
        value={count ?? 0}
        max={troopsMax}
        stop={wheatStop}
        disabled={noTroops}
        onChange={onCount}
      />
      {noTroops ? (
        <>
          <HudNotice tone="warn" line={shortfallLine({ kind: "short", of: "troops", held: 0, need: 1 })} />
          <HudButton kind="primary" onClick={onBuild}>
            {BUILD}
          </HudButton>
        </>
      ) : (
        <>
          <Equation equation={equation} rations={rations} />
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {count === 1 ? (
              <HudChip icons={["explore"]} label={DEPLOY_FIGURES.scout}>
                {""}
              </HudChip>
            ) : (
              <HudChip icons={["essence", "labor"]} label={DEPLOY_FIGURES.revealSends}>
                {revealYield === undefined ? "—" : `+${formatAmount(revealYield)}`}
              </HudChip>
            )}
            <HudChip icons={["stamina"]} label={DEPLOY_FIGURES.startingStamina}>
              {formatAmount(startingStamina)}
            </HudChip>
            {startingTiers && <AttributeMarks tiers={startingTiers} />}
          </div>
          <span className="flex justify-center">
            <DayEnds endsAt={clock?.endsAt} secondsLeft={clock?.secondsLeft} tone={clock?.tone ?? "calm"} />
          </span>
          {ring && <DeployRing ring={ring.tiles} chosen={ring.chosen} onChoose={ring.onPick} />}
        </>
      )}
      {canDeploy && equation && (
        <HudButton
          kind="primary"
          icon="military"
          prices={hudPrices([{ of: "wheat", amount: equation.wheatCost }])}
          busy={sending ? DEPLOYING : undefined}
          onClick={onDeploy}
        >
          {DEPLOY}
        </HudButton>
      )}
      {wheatShort && <HudNotice tone="warn" line={shortfallLine({ kind: "short", of: "wheat", ...wheatShort })} />}
    </HudSheet>
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
    <HudChip icons={rations ? ["wheat", "rations"] : ["wheat"]} label={DEPLOY_FIGURES.wheatToDeploy}>
      {`−${formatExact(equation?.wheatCost)}`}
    </HudChip>
    <span aria-hidden className="text-hud-muted">
      →
    </span>
    <HudChip icons={["wheat"]} label={DEPLOY_FIGURES.wheatLeft} tone={equation?.wheatLeft === 0 ? "bad" : undefined}>
      {formatExact(equation?.wheatLeft)}
    </HudChip>
    <HudChip icons={["move"]} label={DEPLOY_FIGURES.tilesPaid} tone={equation?.tiles === 0 ? "bad" : undefined}>
      {formatAmount(equation?.tiles)}
    </HudChip>
  </div>
);

/** The troops as their portrait, and the count large beside it. */
const Hero = ({ art, count }: { art: IconMeaning | undefined; count: number | undefined }) => (
  <div className="flex items-center justify-center gap-3.5">
    {art && <HudPortrait icon={art} label={TROOPS} />}
    <span role="img" aria-label={`${TROOPS} ${formatExact(count)}`} className="text-hud-display tabular-nums">
      {formatExact(count)}
    </span>
  </div>
);

/** The day's army slots: one mark each, lit where an army stands. */
const SlotMarks = ({ used, allowed }: { used: number; allowed: number }) => (
  <span role="img" aria-label={`${DEPLOY_FIGURES.slots} ${used} / ${allowed}`} className="flex gap-1">
    {Array.from({ length: allowed }, (_, index) => (
      <i
        key={index}
        className={`h-4 w-3 rounded-b-md rounded-t-sm border-2 border-hud-accent ${index < used ? "bg-hud-accent" : ""}`}
      />
    ))}
  </span>
);
