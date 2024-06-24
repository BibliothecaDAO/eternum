import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Realm, Structure } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { BattleSide, Troops } from "@bibliothecadao/eternum";
import { useState } from "react";
import { BattleDetails } from "./BattleDetails";
import { EntityAvatar } from "./EntityAvatar";
import { SelectActiveArmy } from "./SelectActiveArmy";
import { TroopRow } from "./Troops";

export const BattleSideView = ({
  battleSide,
  battleId,
  showBattleDetails,
  ownSideArmies,
  ownSideTroopsUpdated,
  userArmiesAtPosition,
  opposingSideArmies,
  structure,
}: {
  battleSide: BattleSide;
  battleId: bigint | undefined;
  showBattleDetails: boolean;
  ownSideArmies: ArmyInfo[];
  ownSideTroopsUpdated: Troops | undefined;
  userArmiesAtPosition: ArmyInfo[] | undefined;
  opposingSideArmies: ArmyInfo[];
  structure: Structure | undefined;
}) => {
  const {
    account: { account },
    setup: {
      systemCalls: { battle_join },
    },
  } = useDojo();

  const selectedEntity = useUIStore((state) => state.selectedEntity);

  const [localSelectedUnit, setLocalSelectedUnit] = useState<bigint | undefined>(selectedEntity?.id);
  const [loading, setLoading] = useState<boolean>(false);

  const joinBattle = async (side: BattleSide, armyId: bigint) => {
    if (localSelectedUnit) {
      setLoading(true);
      await battle_join({
        signer: account,
        army_id: armyId,
        battle_id: battleId!,
        battle_side: BigInt(side),
      });
      setLoading(false);
    } else {
      setLocalSelectedUnit(0n);
    }
  };

  return (
    <div className={`flex w-[70vw] ${battleSide === BattleSide.Attack ? "flex-row" : "flex-row-reverse"}`}>
      <div>
        <EntityAvatar structure={structure} show={ownSideArmies.length > 0} />
        {Boolean(battleId) &&
          opposingSideArmies.length > 0 &&
          userArmiesAtPosition &&
          userArmiesAtPosition.length > 0 && (
            <div className="flex w-full">
              <SelectActiveArmy
                setLocalSelectedUnit={setLocalSelectedUnit}
                userAttackingArmies={userArmiesAtPosition}
                localSelectedUnit={localSelectedUnit}
              />
              <Button
                onClick={() => joinBattle(battleSide, localSelectedUnit!)}
                isLoading={loading}
                className="size-xs"
              >
                Join
              </Button>
            </div>
          )}
      </div>
      {showBattleDetails && battleId ? (
        <BattleDetails armies={ownSideArmies} battleId={battleId} />
      ) : (
        <TroopRow troops={ownSideTroopsUpdated} />
      )}
    </div>
  );
};
