import { BattleManager, BattleStatus, BattleType } from "@/dojo/modelManager/BattleManager";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Structure } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import { Health } from "@/types";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

export function formatTimeDifference(time: Date) {
  const diffInMs = Number(time) - Number(new Date(0));
  const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  if (days > 0) {
    return `${days}D, ${time.toISOString().substring(11, 19)}`;
  } else {
    return `${time.toISOString().substring(11, 19)}`;
  }
}

export const DurationLeft = ({
  battleManager,
  currentTimestamp,
  structure,
}: {
  battleManager: BattleManager | undefined;
  currentTimestamp: number;
  structure: Structure | undefined;
}) => {
  const durationLeft = useMemo(() => {
    if (!battleManager) return undefined;
    if (battleManager.isSiege(currentTimestamp)) return battleManager.getSiegeTimeLeft(currentTimestamp);
    return battleManager.getTimeLeft(currentTimestamp);
  }, [battleManager, currentTimestamp]);

  const [timeLeft, setTimeLeft] = useState<Date | undefined>(durationLeft);

  useEffect(() => {
    if (!timeLeft) return;
    if (timeLeft.getTime() === 0) return;
    const timer = setInterval(() => {
      const date = new Date(0);
      date.setTime(timeLeft.getTime() - 1000);
      setTimeLeft(date);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    setTimeLeft(durationLeft);
  }, [durationLeft]);

  const battleType = useMemo(() => {
    return battleManager?.getBattleType(structure);
  }, [battleManager, structure]);

  if (timeLeft) {
    if (battleManager?.isSiege(currentTimestamp) && battleType === BattleType.Structure) {
      return `Siege ongoing: ${formatTimeDifference(timeLeft)} left`;
    } else if (battleManager?.isSiege(currentTimestamp)) {
      return "Loading...";
    } else {
      return `${formatTimeDifference(timeLeft)} left`;
    }
  }
};

export const ProgressBar = ({
  className,
  attackingHealth,
  defendingHealth,
}: {
  className?: string;
  attackingHealth: { current: bigint } | undefined;
  defendingHealth: { current: bigint } | undefined;
}) => {
  const totalHealth = useMemo(
    () => (attackingHealth?.current || 0n) + (defendingHealth?.current || 0n),
    [attackingHealth, defendingHealth],
  );

  const attackingHealthPercentage = useMemo(
    () =>
      totalHealth !== 0n ? ((Number(attackingHealth?.current || 0n) / Number(totalHealth)) * 100).toFixed(2) : "0",
    [attackingHealth, totalHealth],
  );
  const defendingHealthPercentage = useMemo(
    () =>
      totalHealth !== 0n ? ((Number(defendingHealth?.current || 0n) / Number(totalHealth)) * 100).toFixed(2) : "0",
    [defendingHealth, totalHealth],
  );

  const gradient = useMemo(() => {
    const attackPercentage = parseFloat(attackingHealthPercentage);
    const defendPercentage = parseFloat(defendingHealthPercentage);
    return `linear-gradient(to right, #2B2E3E ${attackPercentage}%, #2B2E3E ${attackPercentage}%, #46201D ${attackPercentage}%, #46201D ${
      attackPercentage + defendPercentage
    }%)`;
  }, [attackingHealthPercentage, defendingHealthPercentage]);
  return (
    <>
      {!isNaN(Number(attackingHealthPercentage)) && !isNaN(Number(defendingHealthPercentage)) && (
        <div className={`relative h-6 mx-auto bg-opacity-40 ${className}`} style={{ background: gradient }}>
          <div className="flex px-4 justify-between">
            {Number(attackingHealthPercentage) > 0 && (
              <div className="text-left self-center">
                <p>{attackingHealthPercentage}%</p>
              </div>
            )}
            {Number(defendingHealthPercentage) > 0 && (
              <div className="text-left self-center">
                <p>{defendingHealthPercentage}%</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export const BattleProgress = ({
  battleManager,
  ownArmySide,
  attackingHealth,
  attackerArmies,
  defendingHealth,
  defenderArmies,
  structure,
}: {
  battleManager: BattleManager;
  ownArmySide: string;
  attackingHealth: Health | undefined;
  attackerArmies: ArmyInfo[];
  defendingHealth: Health | undefined;
  defenderArmies: (ArmyInfo | undefined)[];
  structure: Structure | undefined;
}) => {
  const currentTimestamp = useUIStore((state) => state.nextBlockTimestamp);

  const playUnitSelectedOne = useUiSounds(soundSelector.unitSelected1).play;
  const playUnitSelectedTwo = useUiSounds(soundSelector.unitSelected2).play;
  const playUnitSelectedThree = useUiSounds(soundSelector.unitSelected3).play;
  const playBattleVictory = useUiSounds(soundSelector.battleVictory).play;
  const playBattleDefeat = useUiSounds(soundSelector.battleDefeat).play;

  const attackerName = `${attackerArmies.length > 0 ? "Attackers" : "Empty"} ${ownArmySide === "Attack" ? "" : ""}`;
  const defenderName = structure
    ? structure.isMercenary
      ? "Bandits"
      : `${structure!.name} ${ownArmySide === "Defence" ? "(⚔️)" : ""}`
    : defenderArmies?.length > 0
      ? `Defenders ${ownArmySide === "Defence" ? "(⚔️)" : ""}`
      : "Empty";

  const battleStatus = useMemo(() => {
    if (!!battleManager.battleEntityId) return battleManager.getWinner(currentTimestamp!, ownArmySide);
  }, [battleManager, currentTimestamp, ownArmySide]);

  useEffect(() => {
    if (battleStatus === BattleStatus.BattleStart) {
      const random = Math.random();
      if (random > 0.66) {
        playUnitSelectedOne();
      } else if (random > 0.33) {
        playUnitSelectedTwo();
      } else {
        playUnitSelectedThree();
      }
    }
    if (battleStatus === BattleStatus.UserLost) {
      playBattleDefeat();
    }
    if (battleStatus === BattleStatus.UserWon) {
      playBattleVictory();
    }
  }, [
    battleStatus,
    playUnitSelectedOne,
    playUnitSelectedTwo,
    playUnitSelectedThree,
    playBattleVictory,
    playBattleDefeat,
  ]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className="w-2/3 mx-auto"
      variants={{
        hidden: { y: "100%" },
        visible: { y: "0%", transition: { duration: 0.5 } },
      }}
    >
      <ProgressBar attackingHealth={attackingHealth} defendingHealth={defendingHealth} />
      <div className="mx-auto w-2/3 grid grid-cols-3 text-2xl bg-hex-bg px-4 py-2">
        <div className="text-left">
          <p>{attackerName}</p>
        </div>
        <div className="font-bold text-center">
          {currentTimestamp && (
            <DurationLeft battleManager={battleManager} currentTimestamp={currentTimestamp} structure={structure} />
          )}
          <div className="font-bold text-center">{battleStatus}</div>
        </div>
        <div className="text-right">
          <p>{defenderName}</p>
        </div>
      </div>
    </motion.div>
  );
};
