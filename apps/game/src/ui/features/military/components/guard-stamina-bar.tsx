import { HudStamina } from "@/ui/design-system/kit/hud-elements";
import { configManager } from "@bibliothecadao/eternum";
import { isStaminaRecharging } from "@/ui/shared/lib/stamina-visuals";

interface GuardStaminaBarProps {
  current?: number | bigint | null;
  max?: number | null;
}

/** A guard's stamina on the kit's stamina bar: good past two thirds, warn past one, bad below or under 40; refilling while it recharges. */
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
      <HudStamina
        stamina={{ current: clampedCurrent, max: maxValue, perExplore: configManager.getExploreStaminaCost() }}
        tone={staminaTone(clampedCurrent, share)}
        filling={isStaminaRecharging(clampedCurrent, maxValue)}
      />
    </span>
  );
};
