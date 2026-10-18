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
  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return num.toLocaleString("en-US");
    }
    return String(num);
  };

  const playClick = useUISound("ui.click");
  const [displayValue, setDisplayValue] = useState(formatNumber(value));

  useEffect(() => {
    setDisplayValue(formatNumber(value));
  }, [value]);

  const parseNumber = (str: string): number => {
    return parseFloat(str.replace(/,/g, ""));
  };

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
          if (allowDecimals) {
            const match = inputValue.match(/[+-]?([0-9,]+([.][0-9]*)?|[.][0-9]+)/);
            if (match) {
              const parsedNumber = Math.min(parseNumber(match[0]), max);
              setDisplayValue(match[0]);
              onChange(parsedNumber);
            } else {
              setDisplayValue(formatNumber(min));
              onChange(min);
            }
          } else {
            const match = inputValue.match(/[+-]?([0-9,]+)/);
            if (match) {
              const parsedValue = parseNumber(match[0]);
              const maxValue = Math.min(Math.max(Math.floor(parsedValue), min), max);
              setDisplayValue(formatNumber(maxValue));
              onChange(maxValue);
            } else {
              setDisplayValue(formatNumber(min));
              onChange(min);
            }
          }
        }}
        onBlur={() => {
          if (displayValue === "") {
            setDisplayValue(formatNumber(Math.max(value, min)));
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
