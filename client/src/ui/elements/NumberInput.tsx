import { ReactComponent as ArrowLeft } from "@/assets/icons/common/arrow-left.svg";
import { ReactComponent as ArrowRight } from "@/assets/icons/common/arrow-right.svg";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { soundSelector, useUiSounds } from "../../hooks/useUISound";

type NumberInputProps = {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  className?: string;
  min?: number;
  max: number;
  arrows?: boolean;
  allowDecimals?: boolean;
};

export const NumberInput = ({
  value,
  onChange,
  className,
  step = 1,
  max = 0,
  min = 0,
  arrows = true,
  allowDecimals = false,
}: NumberInputProps) => {
  const { play: playClick } = useUiSounds(soundSelector.click);
  const [displayValue, setDisplayValue] = useState(value.toString());

  useEffect(() => {
    setDisplayValue(value.toString());
  }, [value]);

  return (
    <div className={clsx("flex items-center h-10 text-lg bg-gold/20 w-full", className)}>
      {arrows && (
        <div
          className="flex items-center justify-center h-full px-1 border-r cursor-pointer border-gold/10 hover:bg-gold/30 "
          onClick={() => {
            onChange(Math.max(value - step, min));
            playClick();
          }}
        >
          <ArrowLeft className="fill-gold " width={"6px"} height={"8px"} />
        </div>
      )}
      <input
        min={min}
        className="w-full appearance-none !outline-none h-full text-center bg-transparent text-gold flex-grow"
        value={displayValue}
        onChange={(e) => {
          if (allowDecimals) {
            console.log("heyyyy");
            setDisplayValue(e.target.value.match(/[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)/)?.[0] ?? min.toString());
            onChange(parseFloat(e.target.value.match(/[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)/)?.[0] ?? min.toString()));
          } else {
            setDisplayValue(e.target.value.match(/[+-]?([0-9]+)/)?.[0] ?? min.toString());
            onChange(parseInt(e.target.value.match(/[+-]?([0-9]+)/)?.[0] ?? min.toString()));
          }
        }}
      />

      {arrows && (
        <div
          className="flex items-center justify-center h-full px-1 border-l cursor-pointer border-gold/10 hover:bg-gold/30"
          onClick={() => {
            onChange(Math.min(value + step, max));
            playClick();
          }}
        >
          {arrows && <ArrowRight className="fill-gold" width={"6px"} height={"8px"} />}
        </div>
      )}
    </div>
  );
};
