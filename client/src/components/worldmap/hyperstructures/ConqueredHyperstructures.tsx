import { useMemo } from "react";
import clsx from "clsx";
import { useHyperstructure } from "../../../hooks/helpers/useHyperstructure";
import useUIStore from "../../../hooks/store/useUIStore";

type ConqueredHyperstructuresProps = {
  className?: string;
  order: number;
};

export const ConqueredHyperstructures = ({ className, order }: ConqueredHyperstructuresProps) => {
  const { getConqueredHyperstructures } = useHyperstructure();
  const conqueredHyperstructures = useMemo(() => {
    return getConqueredHyperstructures(order).length;
  }, [order]);

  const setTooltip = useUIStore((state) => state.setTooltip);

  const timeLeftColors = useMemo(() => {
    if (conqueredHyperstructures >= 10) {
      return {
        text: "text-order-brilliance",
        bg: "!bg-order-brilliance text-order-brilliance",
        container: "!bg-order-brilliance/40 text-order-brilliance/40",
      };
    }
    if (conqueredHyperstructures >= 5) {
      return {
        text: "text-order-fox",
        bg: "!bg-order-fox text-order-fox",
        container: "!bg-order-fox/40 text-order-fox/40",
      };
    }
    return {
      text: "text-order-giants",
      bg: "!bg-order-giants text-order-giants",
      container: "!bg-order-giants/40 text-order-giants/40",
    };
  }, [conqueredHyperstructures]);

  return (
    // mouse is pointer
    <div
      onMouseEnter={() => {
        setTooltip({
          position: "top",
          content: (
            <>
              <ConqueredHyperstructuresBonusIcons conqueredHyperstructures={conqueredHyperstructures} />
            </>
          ),
        });
      }}
      className={clsx(className, clsx("flex flex-col items-center justify-center w-14 h-14 cursor-pointer", className))}
      onClick={() => {}}
    >
      {/* text-[13px] */}
      <div className={clsx(timeLeftColors.text, "flex items-center justify-between text-[13px] font-bold")}>
        <div>{conqueredHyperstructures}</div>
      </div>
      <svg className="absolute top-0 left-0 transform -rotate-90 w-14 h-14" viewBox="0 0 288 288">
        <circle
          cx="145"
          cy="145"
          r="120"
          stroke="currentColor"
          stroke-width="10"
          fill="transparent"
          className={timeLeftColors.container}
        />

        <circle
          cx="145"
          cy="145"
          r="120"
          stroke="currentColor"
          stroke-width="10"
          fill="transparent"
          stroke-dasharray={((2 * 22) / 7) * 120}
          stroke-dashoffset={((2 * 22) / 7) * 120 - (((conqueredHyperstructures / 16) * 2 * 22) / 7) * 120}
          className={timeLeftColors.bg}
        />
      </svg>
      <div className="text-white text-xxs absolute -bottom-5">Conquests</div>
    </div>
  );
};

type LevelingBonusIconsProps = {
  conqueredHyperstructures: number;
  className?: string;
};

export const ConqueredHyperstructuresBonusIcons = ({
  className,
  conqueredHyperstructures,
}: LevelingBonusIconsProps) => {
  const bonus = conqueredHyperstructures * 25;
  return (
    <div className={className}>
      <div className="flex flex-col items-center justify-center mr-1">
        <div>🌾</div>
        <div className="text-order-brilliance"> +{bonus}% </div>
      </div>

      <div className="flex flex-col items-center justify-center mr-1">
        <div>💎</div>
        <div className="text-order-brilliance"> +{bonus}% </div>
      </div>

      <div className="flex flex-col items-center justify-center mr-1">
        <div>🫏</div>
        <div className="text-order-brilliance"> +{bonus}% </div>
      </div>
      <div className="flex flex-col items-center justify-center">
        <div>🛡️</div>
        <div className="text-order-brilliance"> +{bonus}% </div>
      </div>
    </div>
  );
};
