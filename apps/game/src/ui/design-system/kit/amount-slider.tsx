import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { ReactNode } from "react";

import { type IconCode, KitIcon } from "./kit-icon";

/**
 * An amount from one up to the most the player can choose: the start's icon and 1, the track, then the end (the most,
 * or a way to take it all). Where something runs out before the end, a line marks it on the track and the thumb stops
 * there.
 */
export const AmountSlider = ({
  label,
  icon,
  value,
  max,
  stop,
  end,
  disabled = false,
  onChange,
}: {
  label: string;
  icon: IconCode;
  value: number;
  max: number;
  stop?: number;
  end: ReactNode;
  disabled?: boolean;
  onChange: (amount: number) => void;
}) => {
  const share = (amount: number) => (max > 1 ? (amount - 1) / (max - 1) : 0);
  return (
    <div className={cn("flex h-12 items-center gap-2.5", disabled && "opacity-40")}>
      <span className="flex w-14 shrink-0 items-center gap-1">
        <KitIcon code={icon} size={18} />
        <span className="text-[15px] tabular-nums text-kit-cream">1</span>
      </span>
      <span className="relative flex h-12 flex-1 items-center">
        <input
          type="range"
          aria-label={label}
          min={max > 0 ? 1 : 0}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Math.min(Number(event.target.value), stop ?? max))}
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
      <span className="flex min-w-[60px] shrink-0 justify-end text-[15px] tabular-nums text-kit-cream">{end}</span>
    </div>
  );
};
