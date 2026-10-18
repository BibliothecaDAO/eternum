import { type IconMeaning } from "@/ui/design-system/icon";
import { formatAmount, formatCharge, formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";

import { formatDuration } from "@/ui/design-system/kit/time";
import {
  CANCEL,
  ESSENCE,
  EXPLORE,
  LABOR,
  LEFT,
  MOVE,
  NEXT_ORDER,
  QUEUED,
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
      <div className="frontier-card pointer-events-auto flex min-h-11 flex-wrap items-center justify-center gap-1.5 !rounded-xl px-1 py-1.5">
        <CostChip icon="stamina" label={STAMINA} cost={stamina} after={(held) => `${held} → ${held - stamina.cost}`} />
        <CostChip icon="wheat" label={WHEAT} cost={wheat} after={() => `−${formatCharge(wheat.cost)}`} />
        {covered && kind === "explore" && revealYield !== null && (
          <RevealYield revealYield={revealYield} laborFits={laborFits} />
        )}
        {covered && kind === "explore" && <Chip icons={[]} label={XP} value={`+${formatAmount(xp)}`} unit={XP} />}
        {covered && kind === "move" && <Chip icons={["move"]} label={MOVE} value={formatAmount(tiles)} />}
      </div>
      <div className="pointer-events-auto flex gap-2">
        <Button
          role="outline"
          word={CANCEL}
          onClick={onCancel}
          className={covered || staminaShort ? "!h-14 w-hud-frontier-side" : "!h-14 flex-1"}
        />
        {covered && <Button role="primary" icon={verb.icon} word={verb.word} onClick={onGo} className="flex-1" />}
        {staminaShort && refill}
      </div>
    </>
  );
};

/**
 * The action bar while the selected army's order is in flight and a tile was tapped for it: that tile is the army's
 * next order, which leaves when the order in flight applies. Cancel drops it; another tap replaces it.
 */
export const NextOrderBar = ({ onCancel }: { onCancel: () => void }) => (
  <div className="pointer-events-auto flex gap-2">
    <div className="frontier-card flex min-h-11 flex-1 items-center justify-center gap-1.5 !rounded-xl px-1 py-1.5">
      <Chip icons={["hourglass"]} label={NEXT_ORDER} value={QUEUED} />
    </div>
    <Button role="outline" word={CANCEL} onClick={onCancel} className="!h-14 w-hud-frontier-side" />
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
  if (cost.held !== undefined && isCovered(cost)) return <Chip icons={[icon]} label={label} value={after(cost.held)} />;
  return (
    <>
      <Chip icons={[icon]} label={label} value={`${formatHeld(cost.held)} / ${formatCharge(cost.cost)}`} ember />
      {cost.wait !== undefined && <Chip icons={["hourglass"]} label={LEFT} value={formatDuration(cost.wait)} />}
    </>
  );
};

/** What is held against a short cost, in whole units counted down: a shortfall never reads as enough. */
const formatHeld = (held: number | undefined): string => formatExact(held === undefined ? undefined : Math.floor(held));

/** What a reveal sends home: Essence or labor, one amount; when labor no longer fits, its half reads apart in ember. */
const RevealYield = ({ revealYield, laborFits }: { revealYield: number | undefined; laborFits: number | undefined }) =>
  revealYield !== undefined && laborFits !== undefined && laborFits < revealYield ? (
    <>
      <Chip icons={["essence"]} label={ESSENCE} value={`+${formatAmount(revealYield)}`} />
      <Chip icons={["labor"]} label={LABOR} value={`+${formatAmount(laborFits)}`} ember />
    </>
  ) : (
    <Chip
      icons={["essence", "labor"]}
      label={`${ESSENCE}, ${LABOR}`}
      value={revealYield === undefined ? "—" : `+${formatAmount(revealYield)}`}
    />
  );
