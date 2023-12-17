import { useMemo } from "react";
import ProgressBar from "../../../../elements/ProgressBar";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { LevelIndex, useLevel } from "../../../../hooks/helpers/useLevel";
import clsx from "clsx";

type LevelingProps = {
  className?: string;
  entityId: number | undefined;
  setShowLevelUp?: (show: boolean) => void;
};

export const Leveling = ({ className, entityId, setShowLevelUp }: LevelingProps) => {
  const { getEntityLevel } = useLevel();

  const level = entityId ? getEntityLevel(entityId) : undefined;
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const progress = useMemo(() => {
    return ((level?.timeLeft || 0) / 604800) * 100;
  }, [level, nextBlockTimestamp]);

  const timeLeftColors = useMemo(() => {
    if (progress >= 66) {
      return {
        text: "text-order-brilliance",
        bg: "!bg-order-brilliance text-order-brilliance",
        container: "!bg-order-brilliance/40 text-order-brilliance/40",
      };
    }
    if (progress >= 33) {
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
  }, [progress]);

  const onClick = () => {
    setShowLevelUp && setShowLevelUp(true);
  };

  return (
    // mouse is pointer
    <div
      className={clsx(
        className,
        "flex flex-col items-center justify-center absolute top-2 right-2 w-14 h-14 -mt-1 cursor-pointer",
      )}
      onClick={onClick}
    >
      {/* text-[13px] */}
      <div className={clsx(timeLeftColors.text, "flex items-center justify-between text-[13px] font-bold")}>
        <div>{level ? level.level : 0}</div>
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
          stroke-dashoffset={((2 * 22) / 7) * 120 - (((progress / 100) * 2 * 22) / 7) * 120}
          className={timeLeftColors.bg}
        />
      </svg>
      <div className="text-white text-xxs absolute -bottom-5">Order LVL</div>
    </div>
  );
};

type LevelingBonusIconsProps = {
  bonuses: { bonusType: number; bonusAmount: number }[];
  className?: string;
};

export const LevelingBonusIcons = ({ className, bonuses }: LevelingBonusIconsProps) => {
  return (
    <div className={className}>
      {bonuses.map((bonus) => {
        if (bonus.bonusAmount === 0) return null;
        if (bonus.bonusType === LevelIndex.FOOD)
          return (
            <div className="flex flex-col items-center justify-center mr-1">
              <div>🌾</div>
              <div className="text-order-brilliance"> +{bonus.bonusAmount}% </div>
            </div>
          );

        if (bonus.bonusType === LevelIndex.RESOURCE)
          return (
            <div className="flex flex-col items-center justify-center mr-1">
              <div>💎</div>
              <div className="text-order-brilliance"> +{bonus.bonusAmount}% </div>
            </div>
          );

        if (bonus.bonusType === LevelIndex.TRAVEL)
          return (
            <div className="flex flex-col items-center justify-center mr-1">
              <div>🫏</div>
              <div className="text-order-brilliance"> +{bonus.bonusAmount}% </div>
            </div>
          );
        if (bonus.bonusType === LevelIndex.COMBAT)
          return (
            <div className="flex flex-col items-center justify-center">
              <div>🛡️</div>
              <div className="text-order-brilliance"> +{bonus.bonusAmount}% </div>
            </div>
          );
      })}
    </div>
  );
};
