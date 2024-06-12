import { currencyFormat } from "@/ui/utils/utils";
import { motion } from "framer-motion";

export const BattleProgressBar = ({
	attackingHealth,
	lifetimeAttackingHealth,
	attacker,
	defendingHealth,
	lifetimeDefendingHealth,
	defender,
  }: {
	attackingHealth: number;
	lifetimeAttackingHealth: number;
	attacker: string;
	defendingHealth: number;
	lifetimeDefendingHealth: number;
	defender: string;
  }) => {
	const totalHealth = attackingHealth + defendingHealth;
	const attackingHealthPercentage = ((attackingHealth / totalHealth) * 100).toFixed(2);
	const defendingHealthPercentage = ((defendingHealth / totalHealth) * 100).toFixed(2);
  
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
			  Health ❤️: {currencyFormat(attackingHealth, 0)}/{currencyFormat(lifetimeAttackingHealth, 0)}
			</p>
		  </div>
		  <div>
			<p>{defender}</p>
			<p>
			  Health ❤️: {currencyFormat(defendingHealth, 0)}/{currencyFormat(lifetimeDefendingHealth, 0)}
			</p>
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
  
  