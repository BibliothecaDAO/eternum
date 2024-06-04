import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyAndName } from "@/hooks/helpers/useArmies";
import { useBattles } from "@/hooks/helpers/useBattles";
import useUIStore from "@/hooks/store/useUIStore";
import { nameMapping } from "@/ui/components/military/ArmyManagementCard";
import Button from "@/ui/elements/Button";
import { currencyFormat } from "@/ui/utils/utils";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { motion } from "framer-motion";
import { useState } from "react";

const slideUp = {
  hidden: { y: "100%" },
  visible: { y: "0%", opacity: 1, transition: { duration: 0.5 } },
};

const slideDown = {
  hidden: { y: "-100%", opacity: 0 },
  visible: { y: "0%", opacity: 1, transition: { duration: 0.3 } },
};

export const BattleView = () => {
  const battleView = useUIStore((state) => state.battleView);

  const { useBattleByEntityId } = useBattles();
  const { battle, attackerArmy, defenderArmy } = useBattleByEntityId(
    battleView?.attackerId || 0n,
    battleView?.defenderId || 0n,
  )!;
  console.log(defenderArmy);
  return (
    <div>
      <motion.div
        className="absolute top-0 flex w-full"
        variants={slideDown}
        initial="hidden"
        animate="visible"
        exit="hidden"
      >
        <div className="mx-auto bg-brown text-gold text-4xl p-4">{battle ? "Battle" : "Attack"}</div>
      </motion.div>
      <motion.div className="absolute bottom-0" variants={slideUp} initial="hidden" animate="visible" exit="hidden">
        <BattleProgressBar
          attackingHealth={Number(
            battle?.attack_army_health.current !== undefined
              ? battle?.attack_army_health.current
              : attackerArmy.current || attackerArmy.current,
          )}
          attacker={attackerArmy.name}
          defendingHealth={Number(
            battle?.defence_army_health.current !== undefined
              ? battle?.defence_army_health.current
              : defenderArmy.current || defenderArmy.current,
          )}
          defender={defenderArmy.name}
        />
        <div className="w-screen bg-brown h-64 grid grid-cols-12 py-8">
          <EntityAvatar />
          <TroopRow army={attackerArmy} />
          <Actions
            attacker={BigInt(attackerArmy?.entity_id || "0")}
            defender={BigInt(defenderArmy?.entity_id || "0")}
          />
          <TroopRow army={defenderArmy as ArmyAndName} defending />
          <EntityAvatar />
        </div>
      </motion.div>
    </div>
  );
};

export const BattleProgressBar = ({
  attackingHealth,
  attacker,
  defendingHealth,
  defender,
}: {
  attackingHealth: number;
  attacker: string;
  defendingHealth: number;
  defender: string;
}) => {
  const totalHealth = attackingHealth + defendingHealth;
  const attackingHealthPercentage = ((attackingHealth / totalHealth) * 100).toFixed(2);
  const defendingHealthPercentage = ((defendingHealth / totalHealth) * 100).toFixed(2);

  const gradient =
    attackingHealthPercentage > defendingHealthPercentage
      ? `linear-gradient(to right, #582C4D ${attackingHealthPercentage}%, rgba(0,0,0,0) ${defendingHealthPercentage}%)`
      : `linear-gradient(to left, #582C4D ${defendingHealthPercentage}%, rgba(0,0,0,0) ${attackingHealthPercentage}%)`;
  const slideUp = {
    hidden: { y: "100%" },
    visible: { y: "0%", transition: { duration: 0.5 } },
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={slideUp}>
      <div className="mx-auto w-2/3 flex justify-between text-2xl">
        <div>
          {attacker} {Math.round(attackingHealthPercentage)}% {attackingHealth}
        </div>
        <div>
          {defender} {Math.round(defendingHealthPercentage)}% {defendingHealth}
        </div>
      </div>
      <div
        className="h-8 mb-2 mx-auto w-2/3 clip-angled-sm "
        style={{
          background: gradient,
          backgroundColor: "#6B7FD7",
        }}
      ></div>
    </motion.div>
  );
};

export const EntityAvatar = () => {
  const slideUp = {
    hidden: { y: "100%" },
    visible: { y: "0%", transition: { duration: 0.6 } },
  };
  return (
    <div className="col-span-2 flex">
      {" "}
      <div className="mx-auto flex flex-col gap-4">
        <motion.img
          initial="hidden"
          animate="visible"
          variants={slideUp}
          className="w-36 h-36 rounded-full  -mt-28"
          src="./images/avatars/6.png"
          alt=""
        />
        <Button className="w-full">Reinforce Army</Button>
      </div>
    </div>
  );
};

export const Actions = ({ attacker, defender }: { attacker: bigint; defender: bigint }) => {
  const [loading, setLoading] = useState(false);
  const setBattleView = useUIStore((state) => state.setBattleView);

  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { create_army, army_buy_troops, battle_start },
      components: { Protector, Army, Health },
    },
  } = useDojo();

  const handleRaid = async () => {
    setLoading(true);

    await provider.battle_pillage({
      signer: account,
      army_id: attacker,
      structure_id: defender,
    });

    setLoading(false);
  };

  const handleBattleStart = async () => {
    setLoading(true);

    await battle_start({
      signer: account,
      attacking_army_id: attacker,
      defending_army_id: defender,
    });

    setLoading(false);
  };

  return (
    <div className=" col-span-2 flex justify-center">
      <div className="flex flex-col">
        <Button onClick={handleRaid}>Raid</Button>
        <Button onClick={handleBattleStart}>Battle</Button>
        <Button onClick={() => setBattleView(null)}>exit view</Button>
      </div>
    </div>
  );
};

export const TroopRow = ({ army, defending = false }: { army: ArmyAndName; defending?: boolean }) => {
  return (
    <div className=" grid-cols-3 col-span-3 gap-2 flex">
      <TroopCard
        defending={defending}
        className={`${defending ? "order-last" : ""} w-1/3`}
        id={ResourcesIds.Crossbowmen}
        count={army?.troops?.crossbowman_count || 0}
      />

      <TroopCard
        defending={defending}
        className={`w-1/3`}
        id={ResourcesIds.Paladin}
        count={army?.troops?.paladin_count || 0}
      />
      <TroopCard
        defending={defending}
        className={`${defending ? "order-first" : ""} w-1/3`}
        id={ResourcesIds.Knight}
        count={army?.troops?.knight_count || 0}
      />
    </div>
  );
};

export const TroopCard = ({
  count,
  id,
  className,
  defending = false,
}: {
  count: number;
  id: ResourcesIds;
  className?: string;
  defending?: boolean;
}) => {
  return (
    <div className={` bg-gold/20 p-2 clip-angled-sm ${className}`}>
      <img
        style={defending ? { transform: "scaleX(-1)" } : {}}
        className="h-28 object-cover mx-auto p-2"
        src={`/images/icons/${id}.png`}
        alt={nameMapping[id]}
      />
      <div className="text-gold text"> {nameMapping[id]}</div>
      <div className="text-gold text-xl">x {currencyFormat(count, 0)}</div>
    </div>
  );
};
