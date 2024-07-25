import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Structure } from "@/hooks/helpers/useStructures";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import { Health } from "@/types";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

export const BattleProgressBar = ({
  battleManager,
  ownArmySide,
  attackingHealth,
  attackerArmies,
  defendingHealth,
  defenderArmies,
  structure,
}: {
  battleManager: BattleManager | undefined;
  ownArmySide: string;
  attackingHealth: Health | undefined;
  attackerArmies: ArmyInfo[];
  defendingHealth: Health | undefined;
  defenderArmies: (ArmyInfo | undefined)[];
  structure: Structure | undefined;
}) => {
  const currentTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const durationLeft = useMemo(() => {
    if (!battleManager) return undefined;
    return battleManager!.getTimeLeft(currentTimestamp!);
  }, [attackingHealth, currentTimestamp, defendingHealth]);

  const [time, setTime] = useState<Date | undefined>(durationLeft);

  const attackerName = `${attackerArmies.length > 0 ? "Attackers" : "Empty"} ${ownArmySide === "Attack" ? "(⚔️)" : ""}`;
  const defenderName = structure
    ? structure.isMercenary
      ? "Bandits"
      : `${structure!.name} ${ownArmySide === "Defence" ? "(⚔️)" : ""}`
    : defenderArmies?.length > 0
    ? `Defenders ${ownArmySide === "Defence" ? "(⚔️)" : ""}`
    : "Empty";

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

  useEffect(() => {
    if (!time) return;
    if (time.getTime() === 0) return;
    const timer = setInterval(() => {
      const date = new Date(0);
      date.setSeconds(time.getTime() / 1000 - 1);
      setTime(date);
    }, 1000);
    return () => clearInterval(timer);
  }, [time]);

  useEffect(() => {
    setTime(durationLeft);
  }, [durationLeft]);

  const gradient = useMemo(() => {
    const attackPercentage = parseFloat(attackingHealthPercentage);
    const defendPercentage = parseFloat(defendingHealthPercentage);
    return `linear-gradient(to right, #582C4D ${attackPercentage}%, #582C4D ${attackPercentage}%, #6B7FD7 ${attackPercentage}%, #6B7FD7 ${
      attackPercentage + defendPercentage
    }%)`;
  }, [attackingHealthPercentage, defendingHealthPercentage]);

  const battleStatus = useMemo(() => {
    if (time) return;
    if (ownArmySide === "") return "Battle ended";
  }, [time]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className=""
      variants={{
        hidden: { y: "100%" },
        visible: { y: "0%", transition: { duration: 0.5 } },
      }}
    >
      <div className="mx-auto w-2/3 grid grid-cols-3 text-2xl text-gold backdrop-blur-lg bg-[#1b1a1a] px-8 py-2  -top-y">
        <div className="text-left">
          <p>{attackerName}</p>
        </div>
        <div className="font-bold text-center">
          {time ? `${time.toISOString().substring(11, 19)} left` : battleStatus}
        </div>
        <div className="text-right">
          <p>{defenderName}</p>
        </div>
      </div>
      {!isNaN(Number(attackingHealthPercentage)) && !isNaN(Number(defendingHealthPercentage)) && (
        <div className="relative h-8  mx-auto w-2/3 -y animate-slowPulse" style={{ background: gradient }}></div>
      )}
    </motion.div>
  );
};
