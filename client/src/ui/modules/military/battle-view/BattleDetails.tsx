import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { useRealm } from "@/hooks/helpers/useRealm";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import React, { useState } from "react";

export const BattleDetails = ({ battleId, armies }: { battleId: bigint; armies: ArmyInfo[] | undefined }) => {
  const {
    account: { account },
    setup: {
      systemCalls: { battle_leave },
    },
  } = useDojo();

  const setBattleView = useUIStore((state) => state.setBattleView);
  const [loading, setLoading] = useState<boolean>(false);

  const handleLeaveBattle = async (armyEntityId: bigint) => {
    setLoading(true);
    await battle_leave({
      signer: account,
      army_id: armyEntityId,
      battle_id: battleId,
    });

    setLoading(false);
    setBattleView(null);
  };

  const { getAddressName } = useRealm();
  return (
    <div className="w-full">
      <div className="p-2 w-full grid grid-cols-3 text-gold border-gold/20 border-gradient clip-angled p-2">
        <div key={0} className="mb-4 tile h-[2vh] text-left border border-gold/20">
          Army
        </div>
        <div key={1} className="mb-4 tile h-[2vh] text-left border border-gold/20">
          Owner
        </div>
        <div key={2} className="mb-4 tile h-[2vh] text-left border border-gold/20"></div>
        {armies &&
          armies.map((army, index) => (
            <React.Fragment key={index}>
              <div key={`${index}_name`} className="tile h-[2vh] text-left mb-2">
                {army.name}
              </div>
              <div key={`${index}_player_address`} className="tile h-[2vh] text-left mb-2">
                {getAddressName(String(army.address))}
              </div>
              {army.isMine && BigInt(army.protectee_id || 0) === 0n ? (
                <Button
                  key={`${index}_button`}
                  isLoading={loading}
                  className="tile h-[2vh] text-left mb-2"
                  onClick={() => handleLeaveBattle(BigInt(army!.entity_id))}
                >
                  leave
                </Button>
              ) : (
                <div key={`${index}_leave`}></div>
              )}
            </React.Fragment>
          ))}
      </div>
    </div>
  );
};
