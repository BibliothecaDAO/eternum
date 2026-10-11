import { formatAmount, formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import { formatDuration } from "@/ui/design-system/kit/time";
import { CANCEL, ESSENCE, EXPLORE, LABOR, LEFT, MOVE, STAMINA, WHEAT, XP } from "@/ui/design-system/kit/words";
import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";

import { type Cost, isCovered } from "./army-order";

const VERBS = { explore: { word: EXPLORE, icon: "Ey" }, move: { word: MOVE, icon: "Bt" } } as const;

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
        <CostChip icon="St" label={STAMINA} cost={stamina} after={(held) => `${held} → ${held - stamina.cost}`} />
        <CostChip icon="Wh" label={WHEAT} cost={wheat} after={() => `−${formatExact(Math.ceil(wheat.cost))}`} />
        {covered && kind === "explore" && revealYield !== null && (
          <RevealYield revealYield={revealYield} laborFits={laborFits} />
        )}
        {covered && kind === "explore" && <Chip icons={[]} label={XP} value={`+${formatAmount(xp)}`} unit={XP} />}
        {covered && kind === "move" && <Chip icons={["Bt"]} label={MOVE} value={formatAmount(tiles)} />}
      </div>
      <div className="pointer-events-auto flex gap-2">
        <Button
          role="outline"
          word={CANCEL}
          onClick={onCancel}
          className={covered || staminaShort ? "!h-14 w-[104px]" : "!h-14 flex-1"}
        />
        {covered && <Button role="primary" icon={verb.icon} word={verb.word} onClick={onGo} className="flex-1" />}
        {staminaShort && refill}
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

/** What a reveal sends home: Essence or labor, one amount; when labor no longer fits, its half reads apart in ember. */
const RevealYield = ({ revealYield, laborFits }: { revealYield: number | undefined; laborFits: number | undefined }) =>
  revealYield !== undefined && laborFits !== undefined && laborFits < revealYield ? (
    <>
      <Chip icons={["Es"]} label={ESSENCE} value={`+${formatAmount(revealYield)}`} />
      <Chip icons={["La"]} label={LABOR} value={`+${formatAmount(laborFits)}`} ember />
    </>
  ) : (
    <Chip
      icons={["Es", "La"]}
      label={`${ESSENCE}, ${LABOR}`}
      value={revealYield === undefined ? "—" : `+${formatAmount(revealYield)}`}
    />
  );

/** On a keyboard, Enter confirms the order its verb offers; never while the player is typing. */
const useEnterConfirms = (onGo: (() => void) | undefined) => {
  const latest = useRef(onGo);
  useLayoutEffect(() => {
    latest.current = onGo;
  });
  useEffect(() => {
    const confirm = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]");
      if (event.key !== "Enter" || typing || !latest.current) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", confirm);
    return () => window.removeEventListener("keydown", confirm);
  }, []);
};
