import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Realm, Structure } from "@/hooks/helpers/useStructures";
import { currencyFormat } from "@/ui/utils/utils";
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
      <div className="mx-auto w-2/3 flex justify-between text-2xl text-gold backdrop-blur-lg bg-[#1b1a1a] px-8 py-2  ornate-borders-top-y">
        <div>
          <p>{attackerName}</p>
        </div>
        {time && <div className="font-bold">{time.toISOString().substring(11, 19)} left</div>}
        <div className="text-right">
          <p>{defenderName}</p>
        </div>
      </div>
      <div className="relative h-8  mx-auto w-2/3 ornate-borders-y animate-slowPulse" style={{ background: gradient }}>
        <div className="absolute left-0 top-0 h-full flex items-center justify-center w-full font-bold">
          <div className="flex justify-between w-full px-8 py-3 text-gold">
            <span>
              {currencyFormat(attackingHealth?.current || 0, 0)}/{currencyFormat(attackingHealth?.lifetime || 0, 0)} hp
            </span>
            {defendingHealth && (
              <span>
                {currencyFormat(defendingHealth.current, 0)}/{currencyFormat(defendingHealth.lifetime, 0)} hp
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
