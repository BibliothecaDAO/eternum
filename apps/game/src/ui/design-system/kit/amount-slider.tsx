import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { formatExact } from "./amount";

import { MAXIMUM, MINIMUM } from "./words";

/**
 * An amount from one up to the most the player can choose: Minimum, the track, Maximum. Each end is a button that
 * takes its amount, and says which it is when asked. Where something runs out before the end, a line marks it on the
 * track, the thumb stops there, and Maximum takes that much.
 */
export const AmountSlider = ({
  label,
  icon,
  value,
  max,
  stop,
  disabled = false,
  onChange,
}: {
  label: string;
  icon: IconMeaning;
  value: number;
  max: number;
  stop?: number;
  disabled?: boolean;
  onChange: (amount: number) => void;
}) => {
  const share = (amount: number) => (max > 1 ? (amount - 1) / (max - 1) : 0);
  const least = max > 0 ? 1 : 0;
  const most = Math.min(stop ?? max, max);
  return (
    <div className={cn("flex h-12 items-center gap-2", disabled && "opacity-40")}>
      <End name={MINIMUM} amount={least} disabled={disabled} onTake={onChange}>
        <SemanticIcon name={icon} size={18} />
      </End>
      <span className="relative flex h-12 flex-1 items-center">
        <input
          type="range"
          aria-label={label}
          min={least}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Math.min(Number(event.target.value), most))}
          className="h-2 w-full cursor-pointer appearance-none rounded bg-kit-line accent-kit-amber"
        />
        {stop !== undefined && (
          <u
            aria-hidden
            className="absolute bottom-2 top-2 w-[3px] bg-light-red"
            style={{ left: `${share(stop) * 100}%` }}
          />
        )}
      </span>
      <End name={MAXIMUM} amount={most} disabled={disabled} onTake={onChange} />
    </div>
  );
};

/** One end of the track: a 48-tall button on the chip token that takes its amount. */
const End = ({
  name,
  amount,
  disabled,
  onTake,
  children,
}: {
  name: string;
  amount: number;
  disabled: boolean;
  onTake: (amount: number) => void;
  children?: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={`${name} ${formatExact(amount)}`}
    disabled={disabled}
    onClick={() => onTake(amount)}
    className="flex h-12 shrink-0 items-center"
  >
    <span className="frontier-chip h-8 !gap-1 !px-2.5 !py-0 text-base tabular-nums text-kit-cream">
      <span className="contents">
        {children}
        {formatExact(amount)}
      </span>
    </span>
  </button>
);
