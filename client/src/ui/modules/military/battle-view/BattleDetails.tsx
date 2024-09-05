import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { useRealm } from "@/hooks/helpers/useRealm";
import React from "react";

export const BattleDetails = ({ armies }: { armies: (ArmyInfo | undefined)[] | undefined }) => {
  const { getAddressName } = useRealm();
  return (
    <div className="w-full">
      <div className="w-full grid grid-cols-2 text-gold border-gold/20 border-gradient  p-2">
        <div key={0} className="mb-4 tile h-6 text-left border border-gold/20">
          Army
        </div>
        <div key={1} className="mb-4 tile h-6 text-left border border-gold/20">
          Owner
        </div>
        {armies &&
          armies.map(
            (army, index) =>
              army && (
                <React.Fragment key={index}>
                  <div key={`${index}_name`} className="tile h-[2vh] text-left mb-2">
                    {army?.name}
                  </div>
                  <div key={`${index}_player_address`} className="tile h-[2vh] text-left mb-2">
                    {army?.owner ? getAddressName(army.owner.address) : "Bandits"}
                  </div>
                </React.Fragment>
              ),
          )}
      </div>
    </div>
  );
};
