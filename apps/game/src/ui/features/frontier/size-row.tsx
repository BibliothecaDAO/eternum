import "./size-row.css";

import { formatExact } from "@bibliothecadao/types";
import { HudSlider } from "@/ui/design-system/kit/hud-elements";
import { MAXIMUM, SIZE_ROW } from "@/ui/design-system/kit/words";

/**
 * How many troops go, in one row: one fewer, the slider, one more, the count when the sheet's button does not carry it,
 * and Max, lit while the count is at the most. Where something runs out before the slider's end (the wheat a march
 * burns), `most` stops the thumb there and Max takes that much.
 */
export const SizeRow = ({
  label,
  value,
  max,
  most = max,
  count = false,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  most?: number;
  count?: boolean;
  disabled?: boolean;
  onChange: (amount: number) => void;
}) => {
  const top = Math.min(most, max);
  const set = (amount: number) => onChange(Math.max(0, Math.min(amount, top)));
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
        <HudSlider
          label={label}
          value={value}
          max={max}
          stop={most < max ? most : undefined}
          disabled={disabled}
          onChange={set}
        />
      </span>
      <button
        type="button"
        className="size-row__step"
        aria-label={SIZE_ROW.more}
        disabled={disabled || value >= top}
        onClick={() => set(value + 1)}
      >
        +
      </button>
      {count && <b className="size-row__count">{formatExact(value)}</b>}
      <button
        type="button"
        className="size-row__max"
        aria-label={`${MAXIMUM} ${formatExact(top)}`}
        aria-pressed={value === top && top > 0}
        disabled={disabled}
        onClick={() => set(top)}
      >
        {SIZE_ROW.max}
      </button>
    </div>
  );
};
