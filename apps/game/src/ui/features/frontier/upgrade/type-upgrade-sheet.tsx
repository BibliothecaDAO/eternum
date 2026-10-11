import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Button, type Price } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { type Reason, ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { type Tier, TierChip } from "@/ui/design-system/kit/tier-chip";
import { UPGRADE, UPGRADING } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/** One side of a tier's choice: its art and name, and what it gives every building of the type, before → after. */
type Side = { icon: IconCode; name: string; gain: { icon: IconCode; label: string; value: string } };

/**
 * A building type's Upgrade sheet (wireframes 02 and 09): one sheet whichever way the player came, a building on the
 * board or its row in the castle's tree. The type, its tier now and next on their framed chips, then its two sides
 * (farm, workshop, barracks) with what each gives every building of the type, the first tap lifting one, or what the
 * tier gives where there is no choice; then the seal (the choice is final for the season) and Upgrade carrying its
 * Essence and labor. When the realm cannot pay, the price held against what it has and the step take Upgrade's place.
 * At legendary there is nothing next.
 */
export const TypeUpgradeSheet = ({
  icon,
  name,
  tier,
  sides,
  lifted,
  onLift,
  gives,
  prices,
  short,
  sending,
  onUpgrade,
  onClose,
}: {
  icon: IconCode;
  name: string;
  tier: Tier;
  sides?: readonly [Side, Side];
  lifted?: 0 | 1;
  onLift?: (side: 0 | 1) => void;
  /** What the next tier gives where there is no choice (a hut's population; a training building's next army). */
  gives?: ReactNode;
  prices: readonly Price[];
  short?: { reason: Extract<Reason, { kind: "short" }>; step: ReactNode };
  sending: boolean;
  onUpgrade: () => void;
  onClose: () => void;
}) => {
  const top = tier === 5;
  return (
    <Sheet label={name} onClose={onClose}>
      <header className="flex items-center gap-2.5">
        <KitIcon code={icon} size={30} />
        <h2 className="frontier-title flex-1 !text-[20px]">{name}</h2>
      </header>
      <div className="flex items-center justify-center gap-2">
        <TierChip tier={tier} showWord />
        {!top && (
          <>
            <span aria-hidden className="text-[18px] text-kit-muted">
              →
            </span>
            <TierChip tier={(tier + 1) as Tier} showWord />
          </>
        )}
        {top && <KitIcon code="Ok" size={22} />}
      </div>
      {!top && gives}
      {!top && sides && (
        <div role="radiogroup" className="flex gap-2">
          {sides.map((side, index) => (
            <SideCard key={side.name} side={side} lifted={lifted === index} onLift={() => onLift?.(index as 0 | 1)} />
          ))}
        </div>
      )}
      {/* A tier with two sides waits for one to be lifted: the choice is final for the season. */}
      {!top &&
        !(sides && lifted === undefined) &&
        (short ? (
          <ReasonPlate reason={short.reason} step={short.step} />
        ) : (
          <div className="flex items-center gap-2">
            {sides && <KitIcon code="Fx" size={26} />}
            <Button
              role="primary"
              word={UPGRADE}
              prices={prices}
              loading={sending ? UPGRADING : undefined}
              onClick={onUpgrade}
              className="flex-1"
            />
          </div>
        ))}
    </Sheet>
  );
};

/** A side of the choice: its art and name, and what it gives every building of the type; lifted when chosen. */
const SideCard = ({ side, lifted, onLift }: { side: Side; lifted: boolean; onLift: () => void }) => (
  <button
    type="button"
    role="radio"
    aria-checked={lifted}
    aria-label={side.name}
    onClick={onLift}
    className={cn(
      "frontier-card flex h-[120px] flex-1 flex-col items-center justify-center gap-1 !rounded-xl transition-transform",
      lifted && "-translate-y-1 !border-[3px] !border-kit-hot",
    )}
  >
    <span className="flex size-[52px] items-center justify-center rounded-xl bg-kit-ground">
      <KitIcon code={side.icon} size={30} />
    </span>
    <span className="text-[14px] font-semibold text-kit-cream">{side.name}</span>
    <Chip icons={[side.gain.icon]} label={side.gain.label} value={side.gain.value} />
  </button>
);
