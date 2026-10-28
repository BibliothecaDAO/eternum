import { formatDuration, formatShort } from "@bibliothecadao/types";
import { type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudIconButton, HudPanel } from "@/ui/design-system/kit/hud-elements";

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
  heldAgainstNeed,
} from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { type Cost, isCovered } from "./army-order";
import { useEnterConfirms } from "./enter-confirms";

/** The order the row stands for, as assistive technology names it: its icons and numbers say it on screen. */
const VERBS = { explore: EXPLORE, move: MOVE } as const;

/**
 * The action bar with an order pending, in one row: its costs (stamina before → after, the wheat, and for a new tile
 * what the reveal sends home and its XP), and × to drop it. The same tile tapped again sends it (owner, 27 October
 * 2026: "Yes double tapping to explore on mobile, the confirm bar can be compacted into one single row"); Enter does on
 * a keyboard. A short cost turns ember with its exact wait, and the refill stands in the row; the gains are gone until
 * it is covered.
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
  /** Refill, offered in the row when the order's stamina is short. */
  refill?: ReactNode;
  onCancel: () => void;
  onGo: () => void;
}) => {
  const covered = isCovered(stamina) && isCovered(wheat);
  useEnterConfirms(covered ? onGo : undefined);
  return (
    <HudPanel label={VERBS[kind]} collapsible={false} bodyClassName="flex min-h-11 items-center gap-1.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1.5">
        <CostChip icon="stamina" label={STAMINA} cost={stamina} after={(held) => `${held} → ${held - stamina.cost}`} />
        <CostChip icon="wheat" label={WHEAT} cost={wheat} after={() => `−${formatShort(wheat.cost)}`} />
        {covered && kind === "explore" && revealYield !== null && (
          <RevealYield revealYield={revealYield} laborFits={laborFits} />
        )}
        {covered && kind === "explore" && (
          <HudChip>
            {formatShort(xp, { signed: true })} {XP}
          </HudChip>
        )}
        {covered && kind === "move" && (
          <HudChip icons={["move"]} label={MOVE}>
            {formatShort(tiles)}
          </HudChip>
        )}
        {!isCovered(stamina) && refill}
      </div>
      <HudIconButton icon="close" label={CANCEL} kind="quiet" size="sm" onClick={onCancel} />
    </HudPanel>
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
      <HudChip icons={[icon]} label={label} tone="bad">
        {heldAgainstNeed(cost.held, cost.cost)}
      </HudChip>
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
      <HudChip icons={["essence"]} label={ESSENCE}>
        {formatShort(revealYield, { signed: true })}
      </HudChip>
      <HudChip icons={["labor"]} label={LABOR} tone="bad">
        {formatShort(laborFits, { signed: true })}
      </HudChip>
    </>
  ) : (
    <HudChip icons={["essence", "labor"]} label={`${ESSENCE}, ${LABOR}`}>
      {formatShort(revealYield, { signed: true })}
    </HudChip>
  );
