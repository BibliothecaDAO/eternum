import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount } from "@/ui/design-system/kit/amount";

import { CardFanGlyph } from "../glyphs";

/** A token's stamina bar: five segments of the army's own maximum, so a full bar reads full whatever its Logistics. */
const SEGMENTS = 5;

const TOKEN = "relative flex h-[72px] w-14 shrink-0 flex-col items-center justify-center gap-[3px] rounded-xl";

/**
 * One army on the dock: its portrait with its XP balance as the badge (a number alone; there is no level), a card fan
 * when a tier is affordable now, its stamina in segments, and its troops. Read-only on a visit.
 */
export const ArmyToken = ({
  label,
  art,
  xp,
  stamina,
  troops,
  canBuyTier,
  selected,
  flyTarget,
  onPick,
}: {
  label: string;
  art: string | undefined;
  xp: number | undefined;
  stamina: { current: number; max: number } | undefined;
  troops: number | undefined;
  canBuyTier: boolean;
  selected: boolean;
  /** Where a gain flies into the portrait. */
  flyTarget?: string;
  /** Absent on a visit: the token is shown, never picked. */
  onPick?: () => void;
}) => {
  const body = (
    <>
      <span data-fly-target={flyTarget} className="relative size-10 shrink-0">
        <span className="block size-full overflow-hidden rounded-full border border-kit-line2 bg-kit-ground">
          {art && <img src={art} alt="" className="size-full object-cover" />}
        </span>
        <span className="absolute -bottom-1 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-kit-line2 bg-kit-ink px-1 text-[12px] leading-none text-kit-gold2 tabular-nums">
          {formatAmount(xp)}
        </span>
        {canBuyTier && (
          <span className="absolute -right-2 -top-1.5 size-[18px]">
            <CardFanGlyph className="size-full" />
          </span>
        )}
      </span>
      <StaminaSegments stamina={stamina} />
      <span className="text-[14px] leading-none text-kit-cream tabular-nums">{formatAmount(troops)}</span>
    </>
  );
  const look = cn(TOKEN, "border bg-kit-ground", selected ? "border-[3px] border-kit-hot" : "border-kit-line");
  return onPick ? (
    <button type="button" aria-label={label} aria-pressed={selected} onClick={onPick} className={look}>
      {body}
    </button>
  ) : (
    <div role="group" aria-label={label} className={look}>
      {body}
    </div>
  );
};

/** An open army slot: a plus in a dashed ring that opens Deploy; the first one pulses while no army is out. */
export const OpenSlot = ({ label, pulse, onDeploy }: { label: string; pulse: boolean; onDeploy: () => void }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onDeploy}
    className={cn(TOKEN, "border border-kit-line bg-kit-ground")}
  >
    <span
      className={cn(
        "flex size-10 items-center justify-center rounded-full border-2 border-dashed border-kit-line2 text-[18px] text-kit-gold",
        pulse && "animate-pulse border-kit-hot",
      )}
    >
      +
    </span>
  </button>
);

const StaminaSegments = ({ stamina }: { stamina: { current: number; max: number } | undefined }) => {
  const filled = stamina && stamina.max > 0 ? (SEGMENTS * stamina.current) / stamina.max : 0;
  return (
    <span
      role="meter"
      aria-valuenow={stamina?.current}
      aria-valuemax={stamina?.max}
      className="flex w-full gap-0.5 px-1.5"
    >
      {Array.from({ length: SEGMENTS }, (_, index) => (
        <i key={index} className="h-[5px] flex-1 overflow-hidden rounded-sm bg-kit-line">
          <b
            className="block h-full bg-kit-sage"
            style={{ width: `${Math.min(1, Math.max(0, filled - index)) * 100}%` }}
          />
        </i>
      ))}
    </span>
  );
};
