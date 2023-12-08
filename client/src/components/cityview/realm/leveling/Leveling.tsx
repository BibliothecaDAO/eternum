import { useMemo } from "react";
import ProgressBar from "../../../../elements/ProgressBar";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { LevelIndex, useLevel } from "../../../../hooks/helpers/useLevel";

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
    return (level?.timeLeft || 0 / 604800) * 100;
  }, [level, nextBlockTimestamp]);

  const timeLeftColors = useMemo(() => {
    if (progress >= 66) {
      return {
        text: "text-order-brilliance",
        bg: "!bg-order-brilliance",
        container: "!bg-order-brilliance/40",
      };
    }
    if (progress >= 33) {
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
  }, [progress]);

  const onClick = () => {
    setShowLevelUp && setShowLevelUp(true);
  };

  return (
    // mouse is pointer
    <div className={className || ""}>
      <div onClick={onClick} className="cursor-pointer">
        {/* text-[13px] */}
        <div className={"flex items-center text-white justify-between font-bold"}>
          <div>Level: {level ? level.level : 0}</div>
        </div>
        <ProgressBar
          progress={progress}
          containerClassName={` ${timeLeftColors.container}`}
          className={timeLeftColors.bg}
          rounded
        />
      </div>
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
