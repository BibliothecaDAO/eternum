import { useMemo } from "react";
import ProgressBar from "../../../elements/ProgressBar";
import clsx from "clsx";
import useUIStore from "../../../../hooks/store/useUIStore";
import { targetPrices } from "../../../../hooks/helpers/useBanks";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import { BankInterface } from "@bibliothecadao/eternum";

type BankAuctionProps = {
  bankInfo: BankInterface;
  resourceId: 254 | 255;
};

export const BankAuction = ({ bankInfo, resourceId }: BankAuctionProps) => {
  const coefficient =
    (1 / (resourceId === 254 ? bankInfo?.wheatPrice : bankInfo?.fishPrice) - 1 / targetPrices[resourceId]) /
    (1 / targetPrices[resourceId]);

  const setTooltip = useUIStore((state) => state.setTooltip);

  const demandColors = useMemo(() => {
    if (coefficient > 0.25) {
      return {
        text: "text-order-brilliance",
        bg: "!bg-order-brilliance",
        container: "!bg-order-brilliance/40",
      };
    }
    if (coefficient <= -0.25) {
      return {
        text: "text-order-giants",
        bg: "!bg-order-giants",
        container: "!bg-order-giants/40",
      };
    }
    return {
      text: "text-order-fox",
      bg: "!bg-order-fox",
      container: "!bg-order-fox/40",
    };
  }, [coefficient]);

  const demandTooltip = useMemo(() => {
    const discount = Math.abs((1 - coefficient) * 100).toFixed(0);
    if (coefficient > 0.3) {
      return (
        <div className="flex flex-col items-center text-xxs">
          <div className={clsx("font-bold text-xxs", demandColors.text)}>No Demand</div>
          <div>
            <span className={clsx("italic", demandColors.text)}>{discount}% discount</span>{" "}
            {`on sending ${resourceId === 254 ? "wheat" : "fish"}`}
          </div>
        </div>
      );
    }
    if (coefficient > 0 && coefficient <= 0.3) {
      return (
        <div className="flex flex-col items-center text-xxs">
          <div className={clsx("font-bold text-xxs", demandColors.text)}>Low Demand</div>
          <div>
            <span className={clsx("italic", demandColors.text)}>{discount}% discount</span> on next build.
          </div>
        </div>
      );
    }
    if (coefficient <= -0.3) {
      return (
        <div className="flex flex-col items-center text-xxs">
          <div className={clsx("font-bold text-xxs", demandColors.text)}>Increased Demand</div>
          <div>
            <span className={clsx("italic", demandColors.text)}>{discount}% higher cost</span> on next build.
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center text-xxs">
        <div className={clsx("font-bold text-xxs", demandColors.text)}>High Demand</div>
        <div>
          <span className={clsx("italic", demandColors.text)}>{discount}% higher cost</span> on next build.
        </div>
      </div>
    );
  }, [coefficient]);

  const progress = useMemo(() => {
    // Adjust the coefficient to have a minimum value of -1 and a maximum value of 2
    const adjustedCoefficient = Math.min(Math.max(coefficient, -1), 2);

    // Map the range of -1 to 2 in coefficient to 0 to 100 in progress
    return Math.min((adjustedCoefficient + 1) * 50, 100); // This maps -1 to 0, 0 to 50, and 2 to 100
  }, [coefficient]);

  return (
    <div
      onMouseEnter={() =>
        setTooltip({
          position: "top",
          content: demandTooltip,
        })
      }
      onMouseLeave={() => setTooltip(null)}
      className="flex flex-col"
    >
      <div className={"flex items-center text-white justify-between text-[13px] font-bold"}>
        <div className="flex flex-row items-center">
          <div className="">1</div>
          <ResourceIcon resource={resourceId === 254 ? "Wheat" : "Fish" || ""} size="xs" />
          <div className="whitespace-nowrap">
            {" "}
            {`= ${(resourceId === 254 ? 1 / bankInfo?.wheatPrice : 1 / bankInfo?.fishPrice).toFixed(2)}`}
          </div>
          <ResourceIcon resource={"Lords" || ""} size="xs" />
        </div>
        <div className={clsx("ml-3 flex flex-row", demandColors.text)}>
          <ResourceIcon resource={resourceId === 254 ? "Wheat" : "Fish" || ""} size="xs" />
          {resourceId === 254
            ? priceDifferenceString(bankInfo.wheatPrice, 254)
            : priceDifferenceString(bankInfo.fishPrice, 255)}
        </div>
      </div>
      <ProgressBar
        progress={progress}
        containerClassName={`mt-1 ${demandColors.container}`}
        className={demandColors.bg}
        rounded
      />
    </div>
  );
};

const priceDifferenceString = (currentPrice: number, resourceId: 254 | 255) => {
  // current price = 1/currentPrice
  // target price  = 1/targetPrice
  // % difference from targetprice to currentprice
  let diff = ((1 / currentPrice - 1 / targetPrices[resourceId]) / (1 / targetPrices[resourceId])) * 100;
  return diff > 0 ? `+${diff.toFixed(2)}%` : `${diff.toFixed(2)}%`;
};
