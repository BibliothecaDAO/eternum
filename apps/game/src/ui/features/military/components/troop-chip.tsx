import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { TierChip } from "../utils/tier-chip";
import { knownAmount } from "@/ui/utils/utils";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import { resources, Troops, TroopTier, TroopType, formatAmount } from "@bibliothecadao/types";

export const TroopChip = ({
  troops,
  className,
  direction = "row",
  size = "sm",
  negative = false,
}: {
  troops: Pick<Troops, "category" | "tier" | "count">;
  className?: string;
  direction?: "row" | "column";
  size?: "xs" | "sm" | "md" | "lg";
  negative?: boolean;
}) => {
  if (!troops) return null;

  const sizeClasses = {
    xs: {
      padding: "px-1.5 py-0.5",
      gap: "gap-1",
      text: "text-hud-label",
    },
    sm: {
      padding: "px-2 py-1",
      gap: "gap-2",
      text: "text-hud-label",
    },
    md: {
      padding: "px-2.5 py-1.5",
      gap: "gap-2",
      text: "text-hud-body",
    },
    lg: {
      padding: "px-3 py-2",
      gap: "gap-3",
      text: "text-hud-body",
    },
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`relative w-full ${className}`}>
      <div
        className={`${currentSize.padding} bg-hud-hover h-full flex items-center ${
          direction === "row" ? "flex-row" : "flex-col"
        } ${currentSize.gap} border border-hud-divider`}
      >
        <TierChip tier={troops.tier} />
        <ResourceIcon
          withTooltip={false}
          resource={getTroopResourceId(troops.category as TroopType, TroopTier.T1)}
          size={size}
        />
        <div
          className={`${
            Number(troops.count || 0) === 0 ? "text-hud-accent" : negative ? "text-hud-bad" : "text-hud-good"
          } ${currentSize.text} self-center`}
        >
          {Number(troops.count || 0) === 0 ? "" : negative ? "-" : ""}
          {formatAmount(knownAmount(Number(troops.count || 0)))}
        </div>
      </div>
    </div>
  );
};
