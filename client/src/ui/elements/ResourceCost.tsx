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
          "relative flex flex-col shrink-0  self-center ml-2",
          type === "horizontal" ? "ml-1  text-left" : "items-center",
        )}
      >
        <div onClick={onClick} className={clsx("relative text-xs", props.color)}>
          {props.color && props.amount > 0 ? "+" : ""}
          {Intl.NumberFormat("en-US", {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(props.amount || 0)}{" "}
          <span className="text-green/90">{props.balance && `(${currencyFormat(props.balance, 0)})`}</span>
        </div>
        {type === "horizontal" && <div className="text-xs leading-[10px] self-start relative mt-1">{trait}</div>}
      </div>
    </div>
  );
};
