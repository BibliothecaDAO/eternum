import { ResourceIcon } from "@/ui/design-system/molecules";
import { getTierStyle } from "@/ui/utils/tier-styles";
import { currencyFormat } from "@/ui/utils/utils";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import { resources, Troops, TroopTier, TroopType } from "@bibliothecadao/types";

export const TroopChip = ({
  troops,
  className,
  direction = "row",
  iconSize = "sm",
  negative = false,
}: {
  troops: Troops;
  className?: string;
  direction?: "row" | "column";
  iconSize?: "sm" | "md" | "lg";
  negative?: boolean;
}) => {
  if (!troops) return null;

  return (
    <div className={`relative w-full ${className}`}>
      <div
        className={`px-2 py-1 bg-gold/10 h-full flex ${
          direction === "row" ? "flex-row" : "flex-col"
        } justify-between gap-2 border border-gold/10`}
      >
        <div className="flex items-center gap-2">
          <ResourceIcon
            withTooltip={false}
            resource={
              resources.find((r) => r.id === getTroopResourceId(troops.category as TroopType, TroopTier.T1))?.trait ||
              ""
            }
            size={iconSize}
          />
          <div
            className={`${
              Number(troops.count || 0) === 0 ? "text-gold" : negative ? "text-red" : "text-green"
            } text-xs self-center`}
          >
            {Number(troops.count || 0) === 0 ? "" : negative ? "-" : ""}
            {currencyFormat(Number(troops.count || 0), 0)}
          </div>
        </div>
        <span
          className={`px-1.5 py-0.5 rounded ${
            iconSize === "sm" ? "text-[11px]" : iconSize === "md" ? "text-xs" : "text-sm"
          } font-bold border relative ${getTierStyle(troops.tier)}`}
        >
          <span className="relative z-10">{troops.tier}</span>
        </span>
      </div>
    </div>
  );
};
