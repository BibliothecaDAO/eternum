import { formatAmount, formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import { formatDuration } from "@/ui/design-system/kit/time";
import { CANCEL, ESSENCE, EXPLORE, LABOR, LEFT, MOVE, STAMINA, WHEAT, XP } from "@/ui/design-system/kit/words";

import { type Cost, isCovered } from "./army-order";

const VERBS = { explore: { word: EXPLORE, icon: "Ey" }, move: { word: MOVE, icon: "Bt" } } as const;

/**
 * The action bar with an order pending: its costs in one row (stamina before → after, the wheat, and for a new tile
 * what the reveal sends home and its XP), then Cancel and the verb. A short cost turns ember with its exact wait; the
 * gains and the verb are gone until it is covered.
 */
export const OrderBar = ({
  kind,
  tiles,
  stamina,
  wheat,
  revealYield,
  xp,
  onCancel,
  onGo,
}: {
  kind: "explore" | "move";
  tiles: number;
  stamina: Cost;
  wheat: Cost;
  /** Explore only; null in a game whose reveals pay no supplies. */
  revealYield: number | undefined | null;
  xp: number | undefined;
  onCancel: () => void;
  onGo: () => void;
}) => {
  const covered = isCovered(stamina) && isCovered(wheat);
  const verb = VERBS[kind];
  return (
    <>
      <div className="frontier-card pointer-events-auto flex min-h-11 flex-wrap items-center justify-center gap-1.5 !rounded-xl px-1 py-1.5">
        <CostChip icon="St" label={STAMINA} cost={stamina} after={(held) => `${held} → ${held - stamina.cost}`} />
        <CostChip icon="Wh" label={WHEAT} cost={wheat} after={() => `−${formatExact(Math.ceil(wheat.cost))}`} />
        {covered && kind === "explore" && revealYield !== null && (
          <Chip
            icons={["Es", "La"]}
            label={`${ESSENCE}, ${LABOR}`}
            value={revealYield === undefined ? "—" : `+${formatAmount(revealYield)}`}
          />
        )}
        {covered && kind === "explore" && <Chip icons={[]} label={XP} value={`+${formatAmount(xp)}`} unit={XP} />}
        {covered && kind === "move" && <Chip icons={["Bt"]} label={MOVE} value={formatAmount(tiles)} />}
      </div>
      <div className="pointer-events-auto flex gap-2">
        <Button
          role="outline"
          word={CANCEL}
          onClick={onCancel}
          className={covered ? "!h-14 w-[104px]" : "!h-14 flex-1"}
        />
        {covered && <Button role="primary" icon={verb.icon} word={verb.word} onClick={onGo} className="flex-1" />}
      </div>
    </>
  );
};

/** A cost on the bar: what it leaves when covered, or held against needed in ember with its exact wait. */
const CostChip = ({
  icon,
  label,
  cost,
  after,
}: {
  icon: IconCode;
  label: string;
  cost: Cost;
  after: (held: number) => string;
}) => {
  if (cost.held !== undefined && isCovered(cost)) return <Chip icons={[icon]} label={label} value={after(cost.held)} />;
  return (
    <>
      <Chip
        icons={[icon]}
        label={label}
        value={`${formatExact(cost.held)} / ${formatExact(Math.ceil(cost.cost))}`}
        ember
      />
      {cost.wait !== undefined && <Chip icons={["Hg"]} label={LEFT} value={formatDuration(cost.wait)} />}
    </>
  );
};
