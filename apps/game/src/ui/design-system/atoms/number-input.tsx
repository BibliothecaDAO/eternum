import { formatTypedNumber, readTypedNumber, typedNumberText } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { useUISound } from "@/audio";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useEffect, useState } from "react";

type NumberInputProps = {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  className?: string;
  min?: number;
  max?: number;
  arrows?: boolean;
  allowDecimals?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
};

export const NumberInput = ({
  value,
  onChange,
  className,
  step = 1,
  max = Infinity,
  min = 0,
  arrows = true,
  allowDecimals = false,
  onFocus,
  onBlur: onBlurProp,
  disabled = false,
}: NumberInputProps) => {
  const playClick = useUISound("ui.click");
  const [displayValue, setDisplayValue] = useState(formatTypedNumber(value));

  useEffect(() => {
    setDisplayValue(formatTypedNumber(value));
  }, [value]);

  return (
    <div className={cn("ui-field w-full gap-1", className)} data-fill>
      {arrows && (
        <button
          type="button"
          aria-label="Decrease amount"
          disabled={disabled}
          className="ui-button"
          data-kind="quiet"
          data-size="sm"
          data-icon-only
          onClick={() => {
            if (!disabled) {
              onChange(Math.max(value - step, min));
              playClick();
            }
          }}
        >
          <SemanticIcon name="arrow-left" size={16} />
        </button>
      )}
      <input
        inputMode={allowDecimals ? "decimal" : "numeric"}
        min={min}
        className="min-w-0 flex-1 text-center"
        value={displayValue}
        onFocus={onFocus}
        disabled={disabled}
        onChange={(e) => {
          const inputValue = e.target.value;
          if (inputValue.trim() === "") {
            setDisplayValue("");
            return;
          }
          const typed = typedNumberText(inputValue, { whole: !allowDecimals });
          if (typed === undefined) {
            setDisplayValue(formatTypedNumber(min));
            onChange(min);
          } else if (allowDecimals) {
            setDisplayValue(typed);
            onChange(Math.min(readTypedNumber(typed) ?? min, max));
          } else {
            const whole = Math.min(Math.max(readTypedNumber(typed, { whole: true }) ?? min, min), max);
            setDisplayValue(formatTypedNumber(whole));
            onChange(whole);
          }
        }}
        onBlur={() => {
          if (displayValue === "") {
            setDisplayValue(formatTypedNumber(Math.max(value, min)));
          }
          onBlurProp?.();
        }}
      />

      {arrows && (
        <button
          type="button"
          aria-label="Increase amount"
          disabled={disabled}
          className="ui-button"
          data-kind="quiet"
          data-size="sm"
          data-icon-only
          onClick={() => {
            if (!disabled) {
              onChange(Math.min(value + step, max));
              playClick();
            }
          }}
        >
          <SemanticIcon name="arrow-right" size={16} />
        </button>
      )}
    </div>
  );
};
