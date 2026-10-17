import { ResourceIcon } from "@/ui/design-system/molecules";
import { TroopTierChip } from "@/ui/design-system/kit/troop-tier-chip";
import { currencyFormat } from "@/ui/utils/utils";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import { resources, Troops, TroopTier, TroopType } from "@bibliothecadao/types";

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
      text: "text-[10px]",
    },
    sm: {
      padding: "px-2 py-1",
      gap: "gap-2",
      text: "text-xs",
    },
    md: {
      padding: "px-2.5 py-1.5",
      gap: "gap-2",
      text: "text-sm",
    },
    lg: {
      padding: "px-3 py-2",
      gap: "gap-3",
      text: "text-base",
    },
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`relative w-full ${className}`}>
      <div
        className={`${currentSize.padding} bg-gold/10 h-full flex items-center ${
          direction === "row" ? "flex-row" : "flex-col"
        } ${currentSize.gap} border border-gold/10`}
      >
        <TroopTierChip tier={troops.tier} size={size} />
        <ResourceIcon
          withTooltip={false}
          resource={getTroopResourceId(troops.category as TroopType, TroopTier.T1)}
          size={size}
        />
        <div
          className={`${
            Number(troops.count || 0) === 0 ? "text-gold" : negative ? "text-red" : "text-green"
          } ${currentSize.text} self-center`}
        >
          {Number(troops.count || 0) === 0 ? "" : negative ? "-" : ""}
          {currencyFormat(Number(troops.count || 0), 0)}
        </div>
      </div>
    </div>
  );
};
