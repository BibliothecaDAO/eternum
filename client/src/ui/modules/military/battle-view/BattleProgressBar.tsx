import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Structure } from "@/hooks/helpers/useStructures";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

export const BattleProgressBar = ({
  ownArmySide,
  attackingHealth,
  attackerArmies,
  defendingHealth,
  defenderArmies,
  structure,
  durationLeft,
}: {
  ownArmySide: string;
  attackingHealth: { current: number; lifetime: number } | undefined;
  attackerArmies: ArmyInfo[];
  defendingHealth: { current: number; lifetime: number } | undefined;
  defenderArmies: ArmyInfo[];
  structure: Structure | undefined;
  durationLeft?: Date;
}) => {
  const [time, setTime] = useState<Date | undefined>(durationLeft);

  const attackerName = `${attackerArmies.length > 0 ? "Attackers" : "Empty"} ${ownArmySide === "Attack" ? "(⚔️)" : ""}`;
  const defenderName = structure
    ? `${structure!.name} ${ownArmySide === "Defence" ? "(⚔️)" : ""}`
    : defenderArmies?.length > 0
      ? `Defenders ${ownArmySide === "Defence" ? "(⚔️)" : ""}`
      : "Empty";

  const totalHealth = useMemo(
    () => (attackingHealth?.current || 0) + (defendingHealth?.current || 0),
    [attackingHealth, defendingHealth],
  );

  const attackingHealthPercentage = useMemo(
    () => (((attackingHealth?.current || 0) / totalHealth) * 100).toFixed(2),
    [attackingHealth, totalHealth],
  );
  const defendingHealthPercentage = useMemo(
    () => (((defendingHealth?.current || 0) / totalHealth) * 100).toFixed(2),
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
    if (
      ownArmySide === "" ||
      time ||
      defenderArmies.length === 0 ||
      defenderArmies[0] === undefined ||
      attackerArmies.length === 0 ||
      attackerArmies[0] === undefined ||
      BigInt(defenderArmies[0].battle_id) === 0n
    )
      return;
    return ownArmySide === "Attack"
      ? Number(attackingHealthPercentage) === 100
        ? "You Won"
        : Number(attackingHealthPercentage) === 0
          ? "You Lost"
          : undefined
      : Number(defendingHealthPercentage) === 100
        ? "You Won"
        : Number(defendingHealthPercentage) === 0
          ? "You Lost"
          : undefined;
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
      <div className="mx-auto w-2/3 grid grid-cols-3 text-2xl text-gold backdrop-blur-lg bg-[#1b1a1a] px-8 py-2  ornate-borders-top-y">
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
      <div
        className="relative h-8  mx-auto w-2/3 ornate-borders-y animate-slowPulse"
        style={{ background: gradient }}
      ></div>
    </motion.div>
  );
};
