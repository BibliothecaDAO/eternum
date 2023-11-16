import { useMemo, useState } from "react";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import ProgressBar from "../../../../elements/ProgressBar";
import clsx from "clsx";
import { useRealm } from "../../../../hooks/helpers/useRealm";
import useBlockchainStore from "../../../../hooks/store/useBlockchainStore";
import { LevelingPopup } from "./LevelingPopup";

export const Leveling = () => {
  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const { getRealmLevel } = useRealm();

  const level = realmEntityId ? getRealmLevel(realmEntityId) : undefined;
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const progress = useMemo(() => {
    return (level.timeLeft / 604800) * 100;
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
    if (level.level < 3) {
      setShowLevelUp(true);
    }
  };

  return (
    // mouse is pointer
    <div>
      {showLevelUp && <LevelingPopup onClose={() => setShowLevelUp(false)}></LevelingPopup>}
      <div onClick={onClick} className="cursor-pointer">
        <div className={"flex items-center text-white justify-between text-[13px] font-bold"}>
          <div className={clsx("ml-3")}>Level: {level ? level.level : 0}</div>
          <div className={clsx("ml-3", timeLeftColors.text)}>%{level.percentage}</div>
        </div>
        <ProgressBar
          progress={progress}
          containerClassName={`mt-1 ${timeLeftColors.container}`}
          className={timeLeftColors.bg}
          rounded
        />
      </div>
    </div>
  );
};
