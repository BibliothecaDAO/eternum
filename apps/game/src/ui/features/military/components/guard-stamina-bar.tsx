import { HudMeter } from "@/ui/design-system/kit/hud-elements";
import { isStaminaRecharging } from "@/ui/shared/lib/stamina-visuals";

interface GuardStaminaBarProps {
  current?: number | bigint | null;
  max?: number | null;
}

/** A guard's stamina on the sheet's meter: good past two thirds, warn past one, bad below or under 40; refilling while it recharges. */
const staminaTone = (current: number, share: number) =>
  current < 40 || share <= 1 / 3 ? "bad" : share > 2 / 3 ? "good" : "warn";

export const GuardStaminaBar = ({ current, max }: GuardStaminaBarProps) => {
  const maxValue = Number(max ?? 0);
  if (!Number.isFinite(maxValue) || maxValue <= 0) return null;

  const rawCurrent = typeof current === "bigint" ? Number(current) : Number(current ?? 0);
  const currentValue = Number.isFinite(rawCurrent) ? rawCurrent : 0;
  const clampedCurrent = Math.min(Math.max(currentValue, 0), maxValue);
  const share = clampedCurrent / maxValue;
  const label = `Stamina ${Math.round(clampedCurrent)}/${Math.round(maxValue)}`;

  return (
    <span title={label} className="block w-full">
      <HudMeter
        share={share}
        tone={staminaTone(clampedCurrent, share)}
        label={label}
        filling={isStaminaRecharging(clampedCurrent, maxValue)}
      />
    </span>
  );
};
