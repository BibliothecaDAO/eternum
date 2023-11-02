import { useMemo } from "react";
import { useLabor } from "../../../../hooks/helpers/useLabor";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { getPosition, getZone } from "../../../../utils/utils";
import ProgressBar from "../../../../elements/ProgressBar";
import clsx from "clsx";
import useUIStore from "../../../../hooks/store/useUIStore";

export const LaborAuction = () => {
  const realmId = useRealmStore((state) => state.realmId);

  const { useLaborAuctionCoefficient } = useLabor();

  const position = realmId ? getPosition(realmId) : undefined;
  const zone = position ? getZone(position.x) : undefined;
  const setTooltip = useUIStore((state) => state.setTooltip);

  const coefficient = zone ? useLaborAuctionCoefficient(zone) : undefined;

  const demandColors = useMemo(() => {
    if (coefficient <= 1) {
      return {
        text: "text-order-brilliance",
        bg: "!bg-order-brilliance",
        container: "!bg-order-brilliance/40",
      };
    }
    if (coefficient <= 1.25) {
      return {
        text: "text-order-fox",
        bg: "!bg-order-fox",
        container: "!bg-order-fox/40",
      };
    }
    return {
      text: "text-order-giants",
      bg: "!bg-order-giants",
      container: "!bg-order-giants/40",
    };
  }, [coefficient]);

  const demandTooltip = useMemo(() => {
    const discount = Math.abs((1 - coefficient) * 100).toFixed(0);
    if (coefficient <= 0.65) {
      return (
        <div className="flex flex-col items-center text-xxs">
          <div className={clsx("font-bold text-xxs", demandColors.text)}>No Demand</div>
          <div>
            <span className={clsx("italic", demandColors.text)}>{discount}% discount</span> on next build.
          </div>
        </div>
      );
    }
    if (coefficient <= 1) {
      return (
        <div className="flex flex-col items-center text-xxs">
          <div className={clsx("font-bold text-xxs", demandColors.text)}>Low Demand</div>
          <div>
            <span className={clsx("italic", demandColors.text)}>{discount}% discount</span> on next build.
          </div>
        </div>
      );
    }
    if (coefficient <= 1.25) {
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
    if (coefficient <= 0.5) {
      return 0;
    }
    if (coefficient >= 1.5) {
      return 100;
    }
    return (coefficient - 0.5) * 100;
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
        <div>Zone: {`${zone || 1}`}</div>
        <div className={clsx("ml-3", demandColors.text)}>×{coefficient ? coefficient.toFixed(2) : 1}</div>
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
