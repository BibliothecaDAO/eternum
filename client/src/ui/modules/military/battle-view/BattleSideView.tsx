import { ClientComponents } from "@/dojo/createClientComponents";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Structure } from "@/hooks/helpers/useStructures";
import Button from "@/ui/elements/Button";
import { BattleSide } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { useState } from "react";
import { BattleDetails } from "./BattleDetails";
import { EntityAvatar } from "./EntityAvatar";
import { TroopRow } from "./Troops";

export const BattleSideView = ({
  battleSide,
  battleId,
  showBattleDetails,
  ownSideArmies,
  ownSideTroopsUpdated,
  ownArmyEntityId,
  structure,
  isActive,
}: {
  battleSide: BattleSide;
  battleId: bigint | undefined;
  showBattleDetails: boolean;
  ownSideArmies: (ArmyInfo | undefined)[];
  ownSideTroopsUpdated: ComponentValue<ClientComponents["Army"]["schema"]>["troops"] | undefined;
  ownArmyEntityId: bigint | undefined;
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

  const joinBattle = async (side: BattleSide, armyId: bigint) => {
    if (ownArmyEntityId) {
      setLoading(true);
      await battle_join({
        signer: account,
        army_id: armyId,
        battle_id: battleId!,
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
          address={battleSide === BattleSide.Attack ? account.address : battleId?.toString()}
          structure={structure}
          show={ownSideArmies.length > 0}
        />

        {Boolean(battleId) && Boolean(ownArmyEntityId) && isActive && (
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
      {showBattleDetails && battleId ? (
        <BattleDetails armies={ownSideArmies} />
      ) : (
        <TroopRow troops={ownSideTroopsUpdated} />
      )}
    </div>
  );
};
