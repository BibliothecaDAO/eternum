import { NumberInput } from "@/ui/design-system/atoms/number-input";

const AMOUNT_BUTTON =
  "h-9 flex-none rounded-lg border border-gold/40 px-3 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40 max-lg:h-11";

interface TroopAmountProps {
  troopCount: number;
  /** The most that can go: the troops on hand within the army's remaining cap. */
  maxAffordable: number;
  /** How many the source holds; when fewer fit, the count reads "of N that fit", so +500 and Max read against N. */
  held: number;
  onChange: (value: number) => void;
  /** Nothing can be chosen (no troop on hand, the cap reached): the reason is said once, on the order's button. */
  disabled: boolean;
}

/** What one press of the quick button adds to the count. */
const QUICK_ADD = 500;

/** How many troops go, in one row: the count, out of how many can, +500 (each press adds 500, up to that), and Max. */
export const TroopAmount = ({ troopCount, maxAffordable, held, onChange, disabled }: TroopAmountProps) => (
  <div className="flex items-center gap-2">
    <label className="flex min-w-0 flex-1 items-center gap-2">
      <span className="sr-only">Troop count</span>
      <NumberInput
        arrows={false}
        min={0}
        max={maxAffordable}
        step={100}
        value={troopCount}
        onChange={onChange}
        disabled={disabled}
        className="h-9 w-28 flex-none rounded-lg border border-gold/25 bg-black/40 text-sm max-lg:h-11"
      />
      <span className="truncate text-sm tabular-nums text-gold/70">
        of {maxAffordable.toLocaleString()}
        {held > maxAffordable && " that fit"}
      </span>
    </label>
    <button
      type="button"
      onClick={() => onChange(Math.min(troopCount + QUICK_ADD, maxAffordable))}
      disabled={disabled || troopCount >= maxAffordable}
      className={AMOUNT_BUTTON}
    >
      +{QUICK_ADD}
    </button>
    <button
      type="button"
      onClick={() => onChange(maxAffordable)}
      disabled={disabled || troopCount >= maxAffordable}
      className={AMOUNT_BUTTON}
    >
      Max
    </button>
  </div>
);
