import { currencyFormat } from "@/ui/utils/utils";
import { motion } from "framer-motion";
import { useMemo } from "react";

export const BattleProgressBar = ({
  attackingHealth,
  attacker,
  defendingHealth,
  defender,
}: {
  attackingHealth: { current: number; lifetime: number };
  attacker: string;
  defendingHealth: { current: number; lifetime: number } | undefined;
  defender: string;
}) => {
  const totalHealth = useMemo(
    () => attackingHealth.current + (defendingHealth?.current || 0),
    [attackingHealth, defendingHealth],
  );
  const attackingHealthPercentage = useMemo(
    () => ((attackingHealth.current / totalHealth) * 100).toFixed(2),
    [attackingHealth, totalHealth],
  );
  const defendingHealthPercentage = useMemo(
    () => (((defendingHealth?.current || 0) / totalHealth) * 100).toFixed(2),
    [defendingHealth, totalHealth],
  );

  const gradient = useMemo(
    () =>
      `linear-gradient(to right, #582C4D ${attackingHealthPercentage}%, rgba(0,0,0,0) ${attackingHealthPercentage}%, rgba(0,0,0,0) ${defendingHealthPercentage}%, #6B7FD7 ${defendingHealthPercentage}%)`,
    [attackingHealthPercentage, defendingHealthPercentage],
  );

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
      <div className="mx-auto w-2/3 flex justify-between text-2xl text-white backdrop-blur-lg bg-brown/20 p-3">
        <div>
          <p>{attacker}</p>
        </div>
        <div className="text-right">
          <p>{defender}</p>
        </div>
      </div>
      <div className="relative h-8 mb-2 mx-auto w-2/3" style={{ background: gradient }}>
        <div className="absolute left-0 top-0 h-full flex items-center justify-center w-full font-bold">
          <div className="flex justify-between w-full px-2 text-white/60">
            <span>
              {currencyFormat(attackingHealth.current, 0)}/{currencyFormat(attackingHealth.lifetime, 0)} hp
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
