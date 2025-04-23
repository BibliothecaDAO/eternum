import { ResourceIcon } from "@/ui/elements/resource-icon";
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
        <div className="text-xs text-gold/80 self-center">Tier {troops.tier}</div>
      </div>
    </div>
  );
};
