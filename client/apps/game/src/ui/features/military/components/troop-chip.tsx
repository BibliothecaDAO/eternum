import { ResourceIcon } from "@/ui/design-system/molecules";
import { getTierStyle } from "@/ui/utils/tier-styles";
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
  troops: Troops;
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
      tierText: "text-[9px]",
      tierPadding: "px-1 py-0.5",
    },
    sm: {
      padding: "px-2 py-1",
      gap: "gap-2",
      text: "text-xs",
      tierText: "text-[11px]",
      tierPadding: "px-1.5 py-0.5",
    },
    md: {
      padding: "px-2.5 py-1.5",
      gap: "gap-2",
      text: "text-sm",
      tierText: "text-xs",
      tierPadding: "px-2 py-1",
    },
    lg: {
      padding: "px-3 py-2",
      gap: "gap-3",
      text: "text-base",
      tierText: "text-sm",
      tierPadding: "px-2.5 py-1",
    },
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`relative w-full ${className}`}>
      <div
        className={`${currentSize.padding} bg-gold/10 h-full flex ${
          direction === "row" ? "flex-row" : "flex-col"
        } justify-between ${currentSize.gap} border border-gold/10`}
      >
        <div className={`flex items-center ${currentSize.gap}`}>
          <ResourceIcon
            withTooltip={false}
            resource={
              resources.find((r) => r.id === getTroopResourceId(troops.category as TroopType, TroopTier.T1))?.trait ||
              ""
            }
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
        <span
          className={`${currentSize.tierPadding} rounded ${currentSize.tierText} font-bold border relative ${getTierStyle(troops.tier)}`}
        >
          <span className="relative z-10">{troops.tier}</span>
        </span>
      </div>
    </div>
  );
};
