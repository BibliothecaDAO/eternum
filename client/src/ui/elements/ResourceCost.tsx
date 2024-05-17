import { useMemo } from "react";
import { findResourceById } from "@bibliothecadao/eternum";
import { ResourceIcon } from "./ResourceIcon";
import clsx from "clsx";
import { currencyFormat } from "../utils/utils";

type ResourceCostProps = {
  isLabor?: boolean;
  resourceId: number;
  amount: number;
  color?: string;
  type?: "horizontal" | "vertical";
  className?: string;
  withTooltip?: boolean;
  onClick?: (e: any) => void;
  balance?: number;
};

export const ResourceCost = ({
  type = "horizontal",
  isLabor = false,
  className,
  withTooltip = false,
  onClick,
  ...props
}: ResourceCostProps) => {
  const trait = useMemo(() => findResourceById(props.resourceId)?.trait, [props.resourceId]);
  const balanceColor = props.balance !== undefined && props.balance < props.amount ? "text-red/90" : "text-green/90";

  return (
    <div
      className={clsx(
        "relative flex items-center p-1",
        type === "horizontal" ? "flex-row" : "flex-col justify-center",
        className,
      )}
    >
      <ResourceIcon
        className="self-center"
        isLabor={isLabor}
        withTooltip={withTooltip}
        resource={trait || ""}
        size="md"
      />
      <div
        className={clsx(
          "relative flex flex-col shrink-0 self-center ml-2",
          type === "horizontal" ? "ml-1 text-left" : "items-center",
        )}
      >
        <div onClick={onClick} className={clsx("relative text-xs font-bold", props.color)}>
          {props.color && props.amount > 0 ? "+" : ""}
          {Intl.NumberFormat("en-US", {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(props.amount || 0)}{" "}
          <span className={clsx(balanceColor, "font-normal")}>
            {props.balance !== undefined && `(${currencyFormat(props.balance, 0)})`}{" "}
          </span>
        </div>
        {type === "horizontal" && (
          <div className="text-xs leading-[10px] self-start relative mt-1 font-normal">{trait}</div>
        )}
      </div>
    </div>
  );
};
