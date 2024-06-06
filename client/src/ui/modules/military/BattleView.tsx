import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyAndName, getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { useBattleManager } from "@/hooks/helpers/useBattles";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { nameMapping } from "@/ui/components/military/ArmyManagementCard";
import Button from "@/ui/elements/Button";
import { currencyFormat, getEntityIdFromKeys } from "@/ui/utils/utils";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

export const BattleView = () => {
  const battleView = useUIStore((state) => state.battleView);
  const setBattleView = useUIStore((state) => state.setBattleView);
  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);

  const attackerArmy = getArmyByEntityId({ entity_id: battleView?.attackerId || 0n });
  const defenderArmy = getArmyByEntityId({ entity_id: battleView?.defenderId || 0n });

  const { updatedBattle } = useBattleManager(BigInt(defenderArmy?.battle_id || 0n));

  const battleAdjusted = useMemo(() => {
    return updatedBattle.getUpdatedBattle(currentDefaultTick);
  }, [currentDefaultTick]);

  const attackingHealth =
    battleAdjusted === undefined ? Number(attackerArmy?.current) : Number(battleAdjusted?.attack_army_health.current);
  const defendingHealth =
    battleAdjusted === undefined ? Number(defenderArmy?.current) : Number(battleAdjusted?.defence_army_health.current);

  return (
    <div>
      <motion.div
        className="absolute top-0 flex w-full"
        variants={{
          hidden: { y: "-100%", opacity: 0 },
          visible: { y: "0%", opacity: 1, transition: { duration: 0.3 } },
        }}
        initial="hidden"
        animate="visible"
        exit="hidden"
      >
        <div className="mx-auto bg-brown text-gold text-2xl  p-4 flex flex-col w-72 text-center">
          Battle
          <Button onClick={() => setBattleView(null)}>exit battle view</Button>
        </div>
      </motion.div>
      <motion.div
        className="absolute bottom-0"
        variants={{
          hidden: { y: "100%" },
          visible: { y: "0%", opacity: 1, transition: { duration: 0.5 } },
        }}
        initial="hidden"
        animate="visible"
        exit="hidden"
      >
        <BattleProgressBar
          attackingHealth={attackingHealth}
          lifetimeAttackingHealth={Number(attackerArmy?.lifetime)}
          attacker={attackerArmy.name}
          defendingHealth={defendingHealth}
          lifetimeDefendingHealth={Number(defenderArmy?.lifetime)}
          defender={defenderArmy?.name}
        />
        <div className="w-screen bg-brown/50 backdrop-blur-lg h-64 grid grid-cols-12 py-8 ">
          <EntityAvatar />
          <TroopRow army={attackerArmy} />

          <Actions
            battle={updatedBattle}
            attacker={BigInt(attackerArmy?.entity_id || "0")}
            defender={BigInt(defenderArmy?.entity_id || "0")}
            structure={BigInt(battleView?.structure || "0")}
            battleId={BigInt(defenderArmy?.battle_id || "0")}
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
          className="w-36 h-36 clip-angled border-gradient border-4  -mt-28"
          src="./images/avatars/6.png"
          alt=""
        />
        <Button className="w-full">Reinforce Army</Button>
      </div>
    </div>
  );
};

export const Actions = ({
  battle,
  attacker,
  defender,
  structure,
  battleId,
}: {
  battle: BattleManager;
  attacker: bigint;
  defender: bigint;
  structure: bigint;
  battleId: bigint;
}) => {
  const [loading, setLoading] = useState(false);
  const setBattleView = useUIStore((state) => state.setBattleView);
  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);

  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { battle_leave, battle_start },
      components: { Protector, Realm },
    },
  } = useDojo();

  const isActive = useMemo(() => battle.battleActive(), [battle]);

  const protector = useComponentValue(Protector, getEntityIdFromKeys([structure]))?.army_id;
  const isRealm = useComponentValue(Realm, getEntityIdFromKeys([structure]));

  const canClaimBecauseNotRealm = useMemo(() => {
    if (protector) {
      const updatedBattle = battle.getUpdatedBattle(currentDefaultTick);
      if (updatedBattle?.defence_army_health.current === 0n) {
        return !isRealm;
      }
    }
    return !isRealm && !protector;
  }, [isRealm, protector]);

  const handleRaid = async () => {
    setLoading(true);

    await provider.battle_pillage({
      signer: account,
      army_id: attacker,
      structure_id: structure,
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

  const handleBattleClaim = async () => {
    setLoading(true);

    await provider.battle_claim({
      signer: account,
      army_id: attacker,
      structure_id: structure,
    });

    setLoading(false);
  };

  const handleLeaveBattle = async () => {
    setLoading(true);

    await battle_leave({
      signer: account,
      army_id: attacker,
      battle_id: battleId,
    });

    setLoading(false);
    setBattleView(null);
  };

  return (
    <div className=" col-span-2 flex justify-center">
      <div className="flex flex-col">
        <Button isLoading={loading} onClick={handleRaid}>
          Raid
        </Button>

        {/* IF BATTLE HAS BEEN WON or NO ARMY ON STRUCTURE */}

        {canClaimBecauseNotRealm && (
          <Button isLoading={loading} onClick={handleBattleClaim}>
            Claim Structure
          </Button>
        )}

        {isActive ? (
          <Button isLoading={loading} onClick={handleLeaveBattle}>
            Leave Battle
          </Button>
        ) : (
          <Button isLoading={loading} onClick={handleBattleStart}>
            Battle
          </Button>
        )}
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
    <div
      className={` bg-gold/30 text-gold font-bold border-2 border-gradient p-2 clip-angled-sm hover:bg-gold/40 duration-300 ${className}`}
    >
      <img
        style={defending ? { transform: "scaleX(-1)" } : {}}
        className="h-28 object-cover mx-auto p-2"
        src={`/images/icons/${id}.png`}
        alt={nameMapping[id]}
      />
      <div> {nameMapping[id]}</div>
      <div>x {currencyFormat(count, 0)}</div>
    </div>
  );
};
