import { ResourceIcon } from "@/ui/elements/resource-icon";
import { divideByPrecision, findResourceById } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useMemo } from "react";
import { currencyFormat } from "../utils/utils";

const SIZES = ["xs", "sm", "md", "lg"] as const;
const TEXT_SIZES = ["xxs", "xs", "sm", "md", "lg"] as const;
const LAYOUT_TYPES = ["horizontal", "vertical"] as const;

type ResourceCostProps = {
  resourceId: number;
  amount: number;
  balance?: number;
  color?: string;
  type?: (typeof LAYOUT_TYPES)[number];
  className?: string;
  withTooltip?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  size?: (typeof SIZES)[number];
  textSize?: (typeof TEXT_SIZES)[number];
};

const formatAmount = (amount: number) => {
  return Intl.NumberFormat("en-US", {
    notation: amount < 0.01 ? "standard" : "compact",
    maximumFractionDigits: amount < 0.01 ? 6 : 2,
  }).format(amount);
};

export const ResourceCost = ({
  resourceId,
  amount,
  balance,
  color,
  type = "horizontal",
  className,
  withTooltip = false,
  onClick,
  size = "md",
  textSize = "xs",
}: ResourceCostProps) => {
  const trait = useMemo(() => findResourceById(resourceId)?.trait, [resourceId]);

  const balanceColor = balance !== undefined && divideByPrecision(balance) < amount ? "text-red/90" : "text-green/90";

  const containerClasses = clsx(
    "relative flex items-center p-2 bg-gold/10 rounded gap-1 border border-gold/10",
    type === "horizontal" ? "flex-row" : "flex-col justify-center",
    className,
  );

  const contentClasses = clsx(
    "relative flex flex-col shrink-0 self-center",
    type === "horizontal" ? "ml-1 text-left" : "items-center",
  );

  return (
    <div className={containerClasses}>
      <ResourceIcon
        className="self-center justify-center"
        withTooltip={withTooltip}
        resource={trait || ""}
        size={size}
      />
      <div className={contentClasses}>
        <div onClick={onClick} className={clsx(`relative text-${textSize} font-bold`, color)}>
          {formatAmount(amount)}
          <span className={clsx(balanceColor, "font-normal")}>
            {balance !== undefined && !isNaN(balance) && ` (${currencyFormat(balance, 0)})`}
          </span>
        </div>
        {type === "horizontal" && trait && (
          <div className={clsx(`text-${textSize} leading-[10px] self-start relative mt-1 font-normal`)}>{trait}</div>
        )}
      </div>
    </div>
  );
};
