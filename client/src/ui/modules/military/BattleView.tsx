import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyAndName, usePositionArmies } from "@/hooks/helpers/useArmies";
import { useStructuresPosition } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { nameMapping } from "@/ui/components/military/ArmyManagementCard";
import Button from "@/ui/elements/Button";
import { currencyFormat } from "@/ui/utils/utils";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

const slideUp = {
  hidden: { y: "100%" },
  visible: { y: "0%", opacity: 1, transition: { duration: 0.5 } },
};

const slideDown = {
  hidden: { y: "-100%", opacity: 0 },
  visible: { y: "0%", opacity: 1, transition: { duration: 0.3 } },
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
          <TroopRow army={getEnemy as ArmyAndName} defending />
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
        className="h-8 mb-2 mx-auto w-2/3 clip-angled-sm "
        style={{
          background: `linear-gradient(to right, #582C4D ${attackingHealthPercentage}%, #6B7FD7 ${defendingHealthPercentage}%)`,
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
