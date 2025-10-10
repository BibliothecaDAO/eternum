import { ReactComponent as ArrowLeft } from "@/assets/icons/common/arrow-left.svg";
import { ReactComponent as ArrowRight } from "@/assets/icons/common/arrow-right.svg";
import { useUISound } from "@/audio";
import clsx from "clsx";
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
    <div className={clsx("flex items-center h-10 text-lg bg-gold/20 w-full rounded-xl", className)}>
      {arrows && (
        <div
          className={clsx(
            "flex items-center justify-center h-full px-1 border-r border-gold/10",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-gold/30",
          )}
          onClick={() => {
            if (!disabled) {
              onChange(Math.max(value - step, min));
              playClick();
            }
          }}
        >
          <ArrowLeft className="fill-gold " width={"6px"} height={"8px"} />
        </div>
      )}
      <input
        min={min}
        className="button-wood w-full appearance-none !outline-none h-full text-center bg-transparent text-gold flex-grow"
        value={displayValue}
        onFocus={onFocus}
        disabled={disabled}
        onChange={(e) => {
          const inputValue = e.target.value;
          if (inputValue.trim() === '') {
            setDisplayValue('');
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
          if (displayValue === '') {
            setDisplayValue(formatNumber(Math.max(value, min)));
          }
          onBlurProp?.();
        }}
      />

      {arrows && (
        <div
          className={clsx(
            "flex items-center justify-center h-full px-1 border-l border-gold/10",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-gold/30",
          )}
          onClick={() => {
            if (!disabled) {
              onChange(Math.min(value + step, max));
              playClick();
            }
          }}
        >
          <ArrowRight className="fill-gold" width={"6px"} height={"8px"} />
        </div>
      )}
    </div>
  );
};
