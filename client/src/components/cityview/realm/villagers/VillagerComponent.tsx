import { Npc, Villager } from "./types";
import { ReactComponent as Mars } from "../../../../assets/icons/npc/mars.svg";
import { ReactComponent as Venus } from "../../../../assets/icons/npc/venus.svg";
import { ReactComponent as Info } from "../../../../assets/icons/npc/info.svg";
import { getNpcImagePath } from "./utils";
import { useState } from "react";
import { getVillagerTypeInfo } from "./panels/villagers/GetVillagerTypeInfo";
import { getVillagerButtons } from "./panels/villagers/GetVillagerButtons";
import { TravelNpcPopup } from "./panels/villagers/TravelNpcPopup";

type VillagerComponentProps = {
  villager: Villager;
  setNpcDisplayedInPopup: (state: Npc | undefined) => void;
};

export const VillagerComponent = ({ villager, setNpcDisplayedInPopup }: VillagerComponentProps) => {
  const [showTravel, setShowTravel] = useState(false);
  const villagerInfo = getVillagerTypeInfo(villager);
  const buttons = getVillagerButtons({ villager, setNpcDisplayedInPopup, setShowTravel });

  const onClose = (): void => {
    setShowTravel(false);
  };

  return (
    <>
      {showTravel && <TravelNpcPopup npc={villager.npc} onClose={onClose} />}

      <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-light-pink">
        <div className="flex items-center">
          <div className="p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0 rounded-br-md border-gray-gold">
            {villager.npc.characteristics.role}
          </div>

          <>{villagerInfo}</>
        </div>

        <div className="flex w-full mt-2">
          <img src={getNpcImagePath(villager.npc)} className="h-10 w-10 border border-gold" />

          <div className="flex flex-col mt-auto ml-2">
            <div className="flex flex-row items-center">
              <p className="text-gold font-semibold text-xs"> {villager.npc.fullName}</p>
              <button className="cursor-pointer" onClick={() => setNpcDisplayedInPopup(villager.npc)}>
                <Info className="ml-1.5 rounded-sm  p-0.5 bg-gold" />
              </button>
            </div>

            <div className="flex flex-row items-center">
              {villager.npc.characteristics.sex == "male" ? (
                <Mars className="fill-cyan-500 h-4" />
              ) : (
                <Venus className="fill-pink-500 h-4" />
              )}
              <p className="capitalize ml-1"> {villager.npc.characteristics.sex},</p>
              <p className="ml-1">{villager.npc.characteristics.age} y.o.</p>
              <p className="ml-1 text-xl relative bottom-1.5">.</p>
              <p className="ml-1 capitalize mr-auto">{villager.npc.characterTrait}</p>
            </div>
          </div>

          <div className="ml-auto mt-auto p-2">{buttons.map((button: any) => button as any)}</div>
        </div>
      </div>
    </>
  );
};
