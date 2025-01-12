import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat } from "@/ui/utils/utils";
import { ClientComponents } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";

export const TroopDisplay = ({
  troops,
  className,
  direction = "row",
  iconSize = "lg",
  negative = false,
}: {
  troops: ComponentValue<ClientComponents["Army"]["schema"]["troops"]> | undefined;
  className?: string;
  direction?: "row" | "column";
  iconSize?: "sm" | "md" | "lg";
  negative?: boolean;
}) => {
  return (
    <div
      className={`grid ${
        direction === "row" ? "grid-cols-3" : "grid-cols-1"
      } gap-2 relative w-full text-gold font-bold ${className}`}
    >
      <div
        className={`px-2 py-1 bg-gold/10 flex ${
          direction === "row" ? "flex-col" : "flex-row"
        } justify-between gap-2 border border-gold/10`}
      >
        <ResourceIcon withTooltip={false} resource={"Crossbowman"} size={iconSize} />
        <div
          className={`${
            Number(troops?.crossbowman_count || 0) === 0 ? "text-gold" : negative ? "text-red" : "text-green"
          } text-xs self-center`}
        >
          {Number(troops?.crossbowman_count || 0) === 0 ? "" : negative ? "-" : ""}
          {currencyFormat(Number(troops?.crossbowman_count || 0), 0)}
        </div>
      </div>
      <div
        className={`px-2 py-1 bg-gold/10 flex ${
          direction === "row" ? "flex-col" : "flex-row"
        } justify-between gap-2 border border-gold/10`}
      >
        <ResourceIcon withTooltip={false} resource={"Knight"} size={iconSize} />
        <div
          className={`${
            Number(troops?.knight_count || 0) === 0 ? "text-gold" : negative ? "text-red" : "text-green"
          } text-xs self-center`}
        >
          {Number(troops?.knight_count || 0) === 0 ? "" : negative ? "-" : ""}
          {currencyFormat(Number(troops?.knight_count || 0), 0)}
        </div>
      </div>
      <div
        className={`px-2 py-1 bg-gold/10 flex ${
          direction === "row" ? "flex-col" : "flex-row"
        } justify-between gap-2 border border-gold/10`}
      >
        <ResourceIcon withTooltip={false} resource={"Paladin"} size={iconSize} />
        <div
          className={`${
            Number(troops?.paladin_count || 0) === 0 ? "text-gold" : negative ? "text-red" : "text-green"
          } text-xs self-center`}
        >
          {Number(troops?.paladin_count || 0) === 0 ? "" : negative ? "-" : ""}
          {currencyFormat(Number(troops?.paladin_count || 0), 0)}
        </div>
      </div>
    </div>
  );
};
