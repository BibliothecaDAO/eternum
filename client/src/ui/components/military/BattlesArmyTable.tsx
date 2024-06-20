import { ClientComponents } from "@/dojo/createClientComponents";
import { useDojo } from "@/hooks/context/DojoContext";
import { ExtraBattleInfo, useBattleManager, useBattles } from "@/hooks/helpers/useBattles";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat } from "@/ui/utils/utils";
import { findResourceById } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { InventoryResources } from "../resources/InventoryResources";

export const BattlesArmyTable = () => {
  const {
    account: { account },
  } = useDojo();

  const { playerBattles } = useBattles();

  const battles = playerBattles(BigInt(account.address));

  return (
    <div className="p-2">
      <div className="flex flex-col gap-4">
        {battles.map(({ battleEntityId, ownArmy }) => {
          return <BattleChip battleEntityId={battleEntityId} ownArmy={ownArmy} />;
        })}
      </div>
    </div>
  );
};

type BattleChipProps = {
  battleEntityId: bigint;
  ownArmy: ClientComponents["Army"]["schema"];
};

const BattleChip = ({ battleEntityId, ownArmy }: BattleChipProps) => {
  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);

  const { updatedBattle } = useBattleManager(battleEntityId);
  const { getExtraBattleInformation } = useBattles();

  const extraInfo = useMemo(() => {
    const extraInfo = getExtraBattleInformation(BigInt(ownArmy.entity_id));
    return extraInfo;
  }, [ownArmy]);

  const currentBattle = useMemo(() => {
    return updatedBattle.getUpdatedBattle(currentDefaultTick);
  }, [currentDefaultTick]);

  const extendedBattle = useMemo(() => {
    if (!extraInfo) return;
    return formatBattle(currentBattle, extraInfo, ownArmy);
  }, [currentDefaultTick]);

  return (
    extendedBattle && (
      <div className=" items-center text-xs p-2 hover:bg-gold/20 clip-angled-sm bg-gold/20 border-gray-300 rounded-md">
        <div className=" text-xl w-full flex justify-between"></div>
        <div className="flex flex-row justify-between items-center">
          <ArmyCard armyName={extendedBattle.ownArmyEntityName} army={extendedBattle.ownArmy} position={"start"} />
          VS.
          <ArmyCard
            armyName={extendedBattle.opponentArmyEntityName}
            army={extendedBattle.opponentArmy}
            position={"end"}
          />
        </div>
      </div>
    )
  );
};

const ArmyCard = ({ army, position, armyName }: any) => {
  return (
    <div className={`flex flex-col mt-2 items-${position} justify-between w-[20vw] mx-3`}>
      <div className="text-xl pb-4">{armyName}</div>
      <div className="flex items-end flex-wrap mb-2 pl-2">
        <span className="pr-1">❤️ </span>
        <span>{Number((army.current || 0).toString()) / 1000}</span>
      </div>
      <TroopsCard army={army} />
      <InventoryResources entityId={BigInt(army.entity_id)} max={3} className="flex text-xs" />
    </div>
  );
};

const TroopsCard = ({ army }: any) => {
  const {
    troops: { crossbowman_count, paladin_count, knight_count },
  } = army;
  const troopCounts = { 250: crossbowman_count, 251: paladin_count, 252: knight_count };
  return (
    <div className="flex pb-2">
      {Object.entries(troopCounts).map(([troopId, count]) => (
        <div key={troopId} className="flex items-center ">
          <ResourceIcon
            isLabor={false}
            withTooltip={false}
            resource={findResourceById(parseInt(troopId))?.trait || ""}
            size="sm"
            className="self-center"
          />
          <div className="text-xs font-bold">{currencyFormat(count, 0)}</div>
        </div>
      ))}
    </div>
  );
};

const formatBattle = (currentBattle: any, extraInfo: ExtraBattleInfo, ownArmy: ClientComponents["Army"]["schema"]) => {
  if (currentBattle.attack_army.battle_side === extraInfo.opponentArmy.battle_side) {
    currentBattle.opponentArmy = { ...currentBattle.attack_army_health, ...extraInfo.opponentArmy };

    currentBattle.ownArmy = { ...currentBattle.defence_army_health, ...ownArmy };
  } else {
    currentBattle.opponentArmy = { ...currentBattle.defence_army_health, ...extraInfo.opponentArmy };
    currentBattle.ownArmy = { ...currentBattle.attack_army_health, ...ownArmy };
  }

  return {
    ...currentBattle,
    x: extraInfo.x,
    y: extraInfo.y,
    opponentArmyEntityName: extraInfo.opponentArmyEntityName,
    ownArmyEntityName: extraInfo.ownArmyEntityName,
  };
};
