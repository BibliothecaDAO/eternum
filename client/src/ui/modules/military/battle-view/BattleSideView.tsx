import { ClientComponents } from "@/dojo/createClientComponents";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, useArmyByArmyEntityId } from "@/hooks/helpers/useArmies";
import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import { Structure } from "@/hooks/helpers/useStructures";
import Button from "@/ui/elements/Button";
import { BattleSide, ID } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import React, { useState } from "react";
import { BattleHistory } from "./BattleHistory";
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

  const { getAddressNameFromEntity } = getEntitiesUtils();
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
      className={`flex col-span-5 -bottom-y bg-[#1b1a1a] mx-4 bg-hex-bg ${
        battleSide === BattleSide.Attack ? "flex-row " : "flex-row-reverse "
      }`}
    >
      <div className="flex flex-col bg-gold/10 border-x px-2 border-gold/20 mx-4">
        <EntityAvatar
          address={battleSide === BattleSide.Attack ? account.address : battleEntityId?.toString()}
          structure={structure}
          show={ownSideArmies.length > 0}
        />
        <div className="flex flex-col gap-1 mb-2 max-h-36 overflow-y-auto">
          {React.Children.toArray(
            ownSideArmies.map((army) => {
              if (!army) return;
              const addressName = getAddressNameFromEntity(army.entity_id);
              return (
                <div className="flex justify-around px-2 py-1 rounded bg-black/70 text-xs flex gap-2 border-gold/10 border">
                  <span className="self-center align-middle">{addressName}</span>
                  <span className="self-center align-middle">{army?.name}</span>
                  {army?.isMine && (
                    <div className="h-6 border px-1 rounded self-center">
                      <span className="align-middle self-center font-bold uppercase ">{army?.isMine ? "me" : ""}</span>
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>

        {Boolean(battleEntityId) && Boolean(ownArmyEntityId) && isActive && ownArmy.battle_id === 0 && (
          <div className="flex flex-col w-full">
            <Button
              onClick={() => joinBattle(battleSide, ownArmyEntityId!)}
              isLoading={loading}
              className="size-xs h-10 self-center"
              variant="primary"
            >
              Join Side
            </Button>
          </div>
        )}
      </div>
      {showBattleDetails && battleEntityId ? (
        <BattleHistory battleSide={battleSide} battleId={battleEntityId} />
      ) : (
        <TroopRow troops={ownSideTroopsUpdated} />
      )}
    </div>
  );
};
