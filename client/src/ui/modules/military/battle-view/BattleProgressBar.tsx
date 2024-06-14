import { currencyFormat } from "@/ui/utils/utils";
import { motion } from "framer-motion";

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
  const totalHealth = attackingHealth.current + (defendingHealth?.current || 0);
  const attackingHealthPercentage = ((attackingHealth.current / totalHealth) * 100).toFixed(2);
  const defendingHealthPercentage = (((defendingHealth?.current || 0) / totalHealth) * 100).toFixed(2);

  const gradient =
    attackingHealthPercentage > defendingHealthPercentage
      ? `linear-gradient(to right, #582C4D ${attackingHealthPercentage}%, rgba(0,0,0,0) ${defendingHealthPercentage}%)`
      : `linear-gradient(to left, #582C4D ${defendingHealthPercentage}%, rgba(0,0,0,0) ${attackingHealthPercentage}%)`;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { y: "100%" },
        visible: { y: "0%", transition: { duration: 0.5 } },
      }}
    >
      <div className="mx-auto w-2/3 flex justify-between text-2xl text-white">
        <div>
          <p>{attacker}</p>
          <p>
            Health ❤️: {currencyFormat(attackingHealth.current, 0)}/{currencyFormat(attackingHealth.lifetime, 0)}
          </p>
        </div>
        <div>
          <p>{defender}</p>
          {defendingHealth && (
            <p>
              Health ❤️: {currencyFormat(defendingHealth.current, 0)}/{currencyFormat(defendingHealth.lifetime, 0)}
            </p>
          )}
        </div>
      </div>
      <div
        className="h-8 mb-2 mx-auto w-2/3 clip-angled-sm "
        style={{
          background: gradient,
        }}
      ></div>
    </motion.div>
  );
};
