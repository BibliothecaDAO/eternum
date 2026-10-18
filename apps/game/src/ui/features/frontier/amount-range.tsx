import { formatExact } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudSlider } from "@/ui/design-system/kit/hud-elements";
import { MAXIMUM, MINIMUM } from "@/ui/design-system/kit/words";

/**
 * An amount from one up to the most the player can choose: Minimum, the track, Maximum. Each end is a button that
 * takes its amount, and says which it is when asked. Where something runs out before the end, the track marks it, the
 * thumb stops there, and Maximum takes that much.
 */
export const AmountRange = ({
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
  const least = max > 0 ? 1 : 0;
  const most = Math.min(stop ?? max, max);
  return (
    <div className="flex items-center gap-2">
      <HudButton
        kind="secondary"
        size="sm"
        icon={icon}
        aria-label={`${MINIMUM} ${formatExact(least)}`}
        disabled={disabled}
        onClick={() => onChange(least)}
      >
        {formatExact(least)}
      </HudButton>
      <span className="flex-1">
        <HudSlider
          label={label}
          value={value}
          min={least}
          max={max}
          stop={stop}
          disabled={disabled}
          onChange={onChange}
        />
      </span>
      <HudButton
        kind="secondary"
        size="sm"
        aria-label={`${MAXIMUM} ${formatExact(most)}`}
        disabled={disabled}
        onClick={() => onChange(most)}
      >
        {formatExact(most)}
      </HudButton>
    </div>
  );
};
