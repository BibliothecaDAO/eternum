import "./size-row.css";

import { formatExact } from "@bibliothecadao/types";
import { HudSlider } from "@/ui/design-system/kit/hud-elements";
import { MAXIMUM, SIZE_ROW } from "@/ui/design-system/kit/words";

/**
 * How many troops go, in one row: one fewer, the slider up to the most that can go, one more, the count when the
 * sheet's button does not carry it, and Max, lit while the count is at it. Max takes `max`, the most the player should
 * send (the wheat a march burns kept back); the slider still reaches `most`, what the contract takes.
 */
export const SizeRow = ({
  label,
  value,
  most,
  max = most,
  count = false,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  most: number;
  max?: number;
  count?: boolean;
  disabled?: boolean;
  onChange: (amount: number) => void;
}) => {
  const set = (amount: number) => onChange(Math.max(0, Math.min(amount, most)));
  return (
    <div className="size-row" data-disabled={disabled ? "" : undefined}>
      <button
        type="button"
        className="size-row__step"
        aria-label={SIZE_ROW.fewer}
        disabled={disabled || value <= 0}
        onClick={() => set(value - 1)}
      >
        −
      </button>
      <span className="size-row__track">
        <HudSlider label={label} value={value} max={most} disabled={disabled} onChange={set} />
      </span>
      <button
        type="button"
        className="size-row__step"
        aria-label={SIZE_ROW.more}
        disabled={disabled || value >= most}
        onClick={() => set(value + 1)}
      >
        +
      </button>
      {count && <b className="size-row__count">{formatExact(value)}</b>}
      <button
        type="button"
        className="ui-pick size-row__max"
        aria-label={`${MAXIMUM} ${formatExact(max)}`}
        aria-pressed={value === max && max > 0}
        disabled={disabled}
        onClick={() => set(max)}
      >
        {SIZE_ROW.max}
      </button>
    </div>
  );
};
