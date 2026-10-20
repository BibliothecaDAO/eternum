import { formatAmount, formatCharge, formatDuration } from "@bibliothecadao/types";
import { type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudButton, HudChip, HudPanel } from "@/ui/design-system/kit/hud-elements";

import {
  CANCEL,
  ESSENCE,
  EXPLORE,
  LABOR,
  LEFT,
  MOVE,
  NEXT_ORDER,
  AFTER_THIS_ONE,
  STAMINA,
  WHEAT,
  XP,
} from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { type Cost, isCovered } from "./army-order";
import { useEnterConfirms } from "./enter-confirms";

const VERBS = { explore: { word: EXPLORE, icon: "explore" }, move: { word: MOVE, icon: "move" } } as const;

/**
 * The action bar with an order pending: its costs in one row (stamina before → after, the wheat, and for a new tile
 * what the reveal sends home and its XP), then Cancel and the verb; Enter confirms it on a keyboard. A short cost turns ember with its exact wait; the
 * gains and the verb are gone until it is covered.
 */
export const OrderBar = ({
  kind,
  tiles,
  stamina,
  wheat,
  revealYield,
  laborFits,
  xp,
  refill,
  onCancel,
  onGo,
}: {
  kind: "explore" | "move";
  tiles: number;
  stamina: Cost;
  wheat: Cost;
  /** Explore only; null in a game whose reveals pay no supplies. */
  revealYield: number | undefined | null;
  /** What of a labor reveal fits the labor store; less than the yield splits the chip, labor's half in ember. */
  laborFits?: number;
  xp: number | undefined;
  /** Refill, offered beside Cancel when the order's stamina is short. */
  refill?: ReactNode;
  onCancel: () => void;
  onGo: () => void;
}) => {
  const covered = isCovered(stamina) && isCovered(wheat);
  const staminaShort = !isCovered(stamina) && refill !== undefined;
  useEnterConfirms(covered ? onGo : undefined);
  const verb = VERBS[kind];
  return (
    <>
      <HudPanel collapsible={false} bodyClassName="flex min-h-11 flex-wrap items-center justify-center gap-1.5">
        <CostChip icon="stamina" label={STAMINA} cost={stamina} after={(held) => `${held} → ${held - stamina.cost}`} />
        <CostChip icon="wheat" label={WHEAT} cost={wheat} after={() => `−${formatCharge(wheat.cost)}`} />
        {covered && kind === "explore" && revealYield !== null && (
          <RevealYield revealYield={revealYield} laborFits={laborFits} />
        )}
        {covered && kind === "explore" && (
          <HudChip>
            {`+${formatAmount(xp)}`} {XP}
          </HudChip>
        )}
        {covered && kind === "move" && (
          <HudChip icons={["move"]} label={MOVE}>
            {formatAmount(tiles)}
          </HudChip>
        )}
      </HudPanel>
      <div className={cn("pointer-events-auto grid gap-2", (covered || staminaShort) && "grid-cols-3")}>
        <HudButton kind="quiet" onClick={onCancel}>
          {CANCEL}
        </HudButton>
        {covered && (
          <span className="col-span-2 grid">
            <HudButton kind="primary" icon={verb.icon} onClick={onGo}>
              {verb.word}
            </HudButton>
          </span>
        )}
        {staminaShort && <span className="col-span-2 grid">{refill}</span>}
      </div>
    </>
  );
};

/**
 * The action bar while the selected army's order is in flight and a tile was tapped for it: that tile is the army's
 * next order, which leaves when the order in flight applies. Cancel drops it; another tap replaces it.
 */
export const NextOrderBar = ({ onCancel }: { onCancel: () => void }) => (
  <div className="pointer-events-auto grid grid-cols-3 gap-2">
    <HudPanel
      collapsible={false}
      className="col-span-2"
      bodyClassName="flex min-h-11 items-center justify-center gap-1.5"
    >
      <HudChip icons={["hourglass"]} label={NEXT_ORDER}>
        {AFTER_THIS_ONE}
      </HudChip>
    </HudPanel>
    <HudButton kind="quiet" onClick={onCancel}>
      {CANCEL}
    </HudButton>
  </div>
);

/** A cost on the bar: what it leaves when covered, or held against needed in ember with its exact wait. */
const CostChip = ({
  icon,
  label,
  cost,
  after,
}: {
  icon: IconMeaning;
  label: string;
  cost: Cost;
  after: (held: number) => string;
}) => {
  if (cost.held !== undefined && isCovered(cost))
    return (
      <HudChip icons={[icon]} label={label}>
        {after(cost.held)}
      </HudChip>
    );
  return (
    <>
      <HudChip
        icons={[icon]}
        label={label}
        tone="bad"
      >{`${formatAmount(cost.held === undefined ? undefined : Math.floor(cost.held))} / ${formatCharge(cost.cost)}`}</HudChip>
      {cost.wait !== undefined && (
        <HudChip icons={["hourglass"]} label={LEFT}>
          {formatDuration(cost.wait)}
        </HudChip>
      )}
    </>
  );
};

/** What a reveal sends home: Essence or labor, one amount; when labor no longer fits, its half reads apart in ember. */
const RevealYield = ({ revealYield, laborFits }: { revealYield: number | undefined; laborFits: number | undefined }) =>
  revealYield !== undefined && laborFits !== undefined && laborFits < revealYield ? (
    <>
      <HudChip icons={["essence"]} label={ESSENCE}>{`+${formatAmount(revealYield)}`}</HudChip>
      <HudChip icons={["labor"]} label={LABOR} tone="bad">{`+${formatAmount(laborFits)}`}</HudChip>
    </>
  ) : (
    <HudChip icons={["essence", "labor"]} label={`${ESSENCE}, ${LABOR}`}>
      {revealYield === undefined ? "—" : `+${formatAmount(revealYield)}`}
    </HudChip>
  );
