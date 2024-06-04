import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyAndName, usePositionArmies } from "@/hooks/helpers/useArmies";
import { useStructuresPosition } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

const slideUp = {
  hidden: { y: "100%" },
  visible: { y: "0%", transition: { duration: 0.3 } },
};

const slideDown = {
  hidden: { y: "-100%" },
  visible: { y: "0%", transition: { duration: 0.3 } },
};

export const BattleView = () => {
  const clickedHex = useUIStore((state) => state.clickedHex);
  const { col: x, row: y } = clickedHex!.contractPos;
  const { formattedRealmAtPosition, formattedStructureAtPosition } = useStructuresPosition({ position: { x, y } });
  const { enemyArmies, userArmies, allArmies } = usePositionArmies({ position: { x, y } });

  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { create_army, army_buy_troops },
      components: { Protector, Army, Health },
    },
  } = useDojo();

  // get protector army if any
  const getProtector = useMemo(() => {
    const protector = getComponentValue(
      Protector,
      getEntityIdFromKeys([BigInt(formattedRealmAtPosition?.entity_id || 0n)]),
    );
    const protectorArmy = getComponentValue(Army, getEntityIdFromKeys([BigInt(protector?.army_id || 0n)]));
    const health = getComponentValue(Health, getEntityIdFromKeys([BigInt(protectorArmy?.entity_id || 0n)]));

    return { ...protectorArmy, ...health };
  }, [allArmies]);

  // if structure, use protector, else use first other army
  const getEnemy = useMemo(() => {
    return Object.keys(getProtector).length === 0 ? enemyArmies[0] : getProtector;
  }, [getProtector]);

  // get entity id
  const enemyEntityId = useMemo(() => {
    return Object.keys(getProtector).length !== 0 ? formattedRealmAtPosition?.entity_id : enemyArmies[0].entity_id;
  }, [getEnemy]);

  return (
    <div>
      <motion.div className="absolute top-0 flex w-full" variants={slideDown} initial="hidden" animate="visible">
        <div className="mx-auto bg-brown text-gold text-4xl p-4">Battle</div>
      </motion.div>
      <motion.div className="absolute bottom-0" variants={slideUp} initial="hidden" animate="visible">
        <BattleProgressBar
          attackingHealth={Number(userArmies[0]?.current || 0)}
          attacker="You"
          defendingHealth={Number(getEnemy?.current || 0)}
          defender={"defender"}
        />
        <div className="w-screen bg-brown h-64 grid grid-cols-12 py-8">
          <EntityAvatar />
          <TroopRow army={userArmies[0]} />
          <Actions attacker={BigInt(userArmies[0]?.entity_id)} defender={BigInt(enemyEntityId)} />
          <TroopRow army={getEnemy as ArmyAndName} />
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
  const attackingHealthPercentage = (attackingHealth / totalHealth) * 100;
  const defendingHealthPercentage = (defendingHealth / totalHealth) * 100;
  const slideUp = {
    hidden: { y: "100%" },
    visible: { y: "0%", transition: { duration: 0.5 } },
  };
  return (
    <motion.div initial="hidden" animate="visible" variants={slideUp}>
      <div className="mx-auto w-2/3 flex justify-between text-2xl">
        <div>{attacker}</div>
        <div>{defender}</div>
      </div>
      <div
        className="h-8 mb-2 mx-auto w-2/3 "
        style={{
          background: `linear-gradient(to right, red ${attackingHealthPercentage}%, blue ${defendingHealthPercentage}%)`,
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

  console.log(attacker, defender);

  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { create_army, army_buy_troops },
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

    await provider.battle_start({
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
        <Button onClick={() => setBattleView(false)}>exit view</Button>
      </div>
    </div>
  );
};

export const TroopRow = ({ army }: { army: ArmyAndName }) => {
  return (
    <div className="grid grid-cols-3 col-span-3 gap-2">
      <TroopCard count={army?.troops?.knight_count || 0} />
      <TroopCard count={army?.troops?.knight_count || 0} />
      <TroopCard count={army?.troops?.knight_count || 0} />
    </div>
  );
};

export const TroopCard = ({ count }: { count: number }) => {
  return (
    <div className="border border-gold p-2">
      <img className="h-24 object-cover" src="./images/icons/archer.png" alt="" />

      <div className="text-gold text-xl">{count}</div>
    </div>
  );
};
