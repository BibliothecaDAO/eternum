import { divideByPrecision, } from "@bibliothecadao/eternum";
import { findResourceById } from "@bibliothecadao/types";
import clsx from "clsx";
import { useMemo } from "react";
import { formatNumber } from "../utils/utils";
import { ResourceIcon } from "./resource-icon";

type ResourceCostProps = {
  resourceId: number;
  amount: number;
  color?: string;
  type?: "horizontal" | "vertical";
  className?: string;
  withTooltip?: boolean;
  onClick?: (e: any) => void;
  balance?: number;
  size?: "xs" | "sm" | "md" | "lg";
  textSize?: "xxs" | "xs" | "sm" | "md" | "lg"; // Added text size option
};

export const ResourceCost = ({
  type = "horizontal",
  className,
  withTooltip = false,
  onClick,
  size = "md",
  textSize = "xs", // Added text size option
  ...props
}: ResourceCostProps) => {
  const balance = divideByPrecision(props.balance!);
  const trait = useMemo(() => findResourceById(props.resourceId)?.trait, [props.resourceId]);
  const balanceColor = balance !== undefined && balance < props.amount ? "text-red/90" : "text-green/90";

  return (
    <div
      className={clsx(
        "relative flex items-center p-2 bg-gold/10 w-full mr-3 gap-1 border border-gold/10",
        type === "horizontal" ? "flex-row" : "flex-col justify-center",
        className,
      )}
    >
      <ResourceIcon
        className="self-center justify-center"
        withTooltip={withTooltip}
        resource={trait || ""}
        size={size}
      />
      <div
        className={clsx(
          "relative flex flex-col shrink-0 self-center ",
          type === "horizontal" ? "ml-1 text-left" : "items-center",
        )}
      >
        <div onClick={onClick} className={clsx(`relative text-${textSize} font-bold`, props.color)}>
          {" "}
          {Intl.NumberFormat("en-US", {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(props.amount || 0)}{" "}
          <span className={clsx(balanceColor, "font-normal")}>
            {!isNaN(balance) && `(${formatNumber(balance, 0)})`}{" "}
          </span>
        </div>
        {type === "horizontal" && (
          <div className={`text-${textSize} leading-[10px] self-start relative mt-1 font-normal`}>{trait}</div> // Applied text size option
        )}
      </div>
    </div>
  );
};
