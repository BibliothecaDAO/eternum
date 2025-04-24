import { ResourceIcon } from "@/ui/elements/resource-icon";
import { divideByPrecision } from "@bibliothecadao/eternum";
import { findResourceById } from "@bibliothecadao/types";
import clsx from "clsx";
import { useMemo } from "react";
import { currencyFormat } from "../utils/utils";

const SIZES = ["xs", "sm", "md", "lg"] as const;
const TEXT_SIZES = ["xxs", "xs", "sm", "md", "lg"] as const;
const LAYOUT_TYPES = ["horizontal", "vertical"] as const;

type TextSize = (typeof TEXT_SIZES)[number];

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
  textSize?: TextSize;
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

  const hasSufficientBalance = balance !== undefined && divideByPrecision(balance) >= amount;
  const balanceColor = hasSufficientBalance ? "text-green/90" : "text-red/90";

  const containerClasses = clsx(
    "relative flex items-center p-2 bg-gold/5 rounded gap-1 border border-gold/5 shadow-inner",
    type === "horizontal" ? "flex-row" : "flex-col justify-center",
    className,
  );

  const contentClasses = clsx(
    "relative flex flex-col shrink-0 self-center",
    type === "horizontal" ? "ml-1 text-left" : "items-center",
  );

  const showBalance = balance !== undefined && !isNaN(balance);

  // Determine the text size for the trait name (one step smaller)
  const getSmallerTextSize = (size: TextSize): TextSize => {
    const currentIndex = TEXT_SIZES.indexOf(size);
    return TEXT_SIZES[Math.max(0, currentIndex - 1)];
  };
  const traitTextSize = getSmallerTextSize(textSize);

  return (
    <div className={containerClasses}>
      <ResourceIcon
        className="self-center justify-center"
        withTooltip={withTooltip}
        resource={trait || ""}
        size={size}
      />
      <div className={contentClasses}>
        <div onClick={onClick} className={clsx("relative", `text-${textSize}`, color)}>
          {formatAmount(amount)}
          {showBalance && (
            <span className={clsx("font-normal", balanceColor)}>{` (${currencyFormat(balance, 0)})`}</span>
          )}
        </div>
        {type === "horizontal" && trait && (
          <div className={clsx("relative font-normal self-start uppercase text-opacity-75", `text-${traitTextSize}`)}>
            {trait}
          </div>
        )}
      </div>
    </div>
  );
};
