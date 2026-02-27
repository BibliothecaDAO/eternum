import { cn } from "@/ui/design-system/atoms/lib/utils";

interface GuardStaminaBarProps {
  current?: number | bigint | null;
  max?: number | null;
  className?: string;
}

const getStaminaFillClass = (current: number, percentage: number) => {
  if (current < 40) return "bg-progress-bar-danger";
  if (percentage > 66) return "bg-progress-bar-good";
  if (percentage > 33) return "bg-progress-bar-medium";
  return "bg-progress-bar-danger";
};

export const GuardStaminaBar = ({ current, max, className }: GuardStaminaBarProps) => {
  const maxValue = Number(max ?? 0);
  if (!Number.isFinite(maxValue) || maxValue <= 0) return null;

  const rawCurrent = typeof current === "bigint" ? Number(current) : Number(current ?? 0);
  const currentValue = Number.isFinite(rawCurrent) ? rawCurrent : 0;
  const clampedCurrent = Math.min(Math.max(currentValue, 0), maxValue);
  const percentage = (clampedCurrent / maxValue) * 100;
  const roundedCurrent = Math.round(clampedCurrent);
  const roundedMax = Math.round(maxValue);

  return (
    <div
      className={cn("h-1 w-full overflow-hidden rounded-full border border-gold/20 bg-dark-brown/70", className)}
      title={`Stamina ${roundedCurrent}/${roundedMax}`}
      aria-label={`Stamina ${roundedCurrent}/${roundedMax}`}
    >
      <div
        className={cn("h-full transition-all duration-300", getStaminaFillClass(clampedCurrent, percentage))}
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
    </div>
  );
};
