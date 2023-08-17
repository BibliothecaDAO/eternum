import { ReactComponent as ArrowLeft } from "../assets/icons/common/arrow-left.svg";
import { ReactComponent as ArrowRight } from "../assets/icons/common/arrow-right.svg";
import clsx from "clsx";
import { soundSelector, useUiSounds } from "../hooks/useUISound";

type NumberInputProps = {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  className?: string;
  min?: number;
  max: number;
};

export const NumberInput = ({
  value,
  onChange,
  className,
  step = 1,
  max,
  min = 0,
}: NumberInputProps) => {
  const { play: playClick } = useUiSounds(soundSelector.click);

  return (
    <div
      className={clsx(
        "flex items-center border rounded-lg w-22 h-7 border-gold",
        className,
      )}
    >
      <div
        className="flex items-center justify-center h-full px-1 border-r cursor-pointer border-gold"
        onClick={() => {
          onChange(Math.max(value - step, min));
          playClick();
        }}
      >
        <ArrowLeft />
      </div>

      <input
        type="number"
        min={min}
        className=" w-14 text-xs appearance-none !outline-none h-full text-center bg-transparent text-light-pink"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
      />

      <div
        className="flex items-center justify-center h-full px-1 border-l cursor-pointer border-gold"
        onClick={() => {
          onChange(Math.min(value + step, max));
          playClick();
        }}
      >
        <ArrowRight />
      </div>
    </div>
  );
};
