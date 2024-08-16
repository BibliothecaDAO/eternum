import { ClientComponents } from "@/dojo/createClientComponents";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, useArmyByArmyEntityId } from "@/hooks/helpers/useArmies";
import { Structure } from "@/hooks/helpers/useStructures";
import Button from "@/ui/elements/Button";
import { BattleSide, ID } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { useState } from "react";
import { BattleDetails } from "./BattleDetails";
import { EntityAvatar } from "./EntityAvatar";
import { TroopRow } from "./Troops";

export const BattleSideView = ({
  battleSide,
  battleEntityId,
  showBattleDetails,
  ownSideArmies,
  ownSideTroopsUpdated,
  ownArmyEntityId,
  structure,
  isActive,
}: {
  battleSide: BattleSide;
  battleEntityId: ID | undefined;
  showBattleDetails: boolean;
  ownSideArmies: (ArmyInfo | undefined)[];
  ownSideTroopsUpdated: ComponentValue<ClientComponents["Army"]["schema"]>["troops"] | undefined;
  ownArmyEntityId: ID | undefined;
  structure: Structure | undefined;
  isActive: boolean;
}) => {
  const {
    account: { account },
    setup: {
      systemCalls: { battle_join },
    },
  } = useDojo();

  const [loading, setLoading] = useState<boolean>(false);

  const ownArmy = useArmyByArmyEntityId(ownArmyEntityId || 0);

  const joinBattle = async (side: BattleSide, armyId: ID) => {
    if (ownArmyEntityId) {
      setLoading(true);
      await battle_join({
        signer: account,
        army_id: armyId,
        battle_id: battleEntityId!,
        battle_side: BigInt(side),
      });
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex col-span-5 -bottom-y px-4 bg-[#1b1a1a] bg-map ${
        battleSide === BattleSide.Attack ? "flex-row" : "flex-row-reverse"
      }`}
    >
      <div className="flex flex-col">
        <EntityAvatar
          address={battleSide === BattleSide.Attack ? account.address : battleEntityId?.toString()}
          structure={structure}
          show={ownSideArmies.length > 0}
        />

        {Boolean(battleEntityId) && Boolean(ownArmyEntityId) && isActive && ownArmy.battle_id === 0 && (
          <div className="flex flex-col w-full">
            <Button
              onClick={() => joinBattle(battleSide, ownArmyEntityId!)}
              isLoading={loading}
              className="size-xs h-10 w-20 self-center"
            >
              Join
            </Button>
          </div>
        )}
      </div>
      {showBattleDetails && battleEntityId ? (
        <BattleDetails armies={ownSideArmies} />
      ) : (
        <TroopRow troops={ownSideTroopsUpdated} />
      )}
    </div>
  );
};
