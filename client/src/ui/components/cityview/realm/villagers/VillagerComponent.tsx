import { Villager } from "./types";
import { ReactComponent as Mars } from "../../../../../assets/icons/npc/mars.svg";
import { ReactComponent as Venus } from "../../../../../assets/icons/npc/venus.svg";
import { ReactComponent as Info } from "../../../../../assets/icons/common/info.svg";
import { getNpcImagePath } from "./utils";
import { InfoFromVillagerType } from "./panels/villagers/InfoFromVillagerType";
import { ButtonFromVillagerType } from "./panels/villagers/ButtonFromVillagerType";
import useNpcStore from "@/hooks/store/useNpcStore";

type VillagerComponentProps = {
  villager: Villager;
};

export const VillagerComponent = ({ villager }: VillagerComponentProps) => {
  const { setNpcInInfoPopup } = useNpcStore();
  const villagerInfo = InfoFromVillagerType(villager);
  const villagerButton = ButtonFromVillagerType({ villager });

  return (
    <>
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
              <button className="cursor-pointer" onClick={() => setNpcInInfoPopup(villager.npc)}>
                <Info className="ml-1.5 rounded-sm  p-0.5 w-5" />
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

          <div className="ml-auto mt-auto p-2">{villagerButton}</div>
        </div>
      </div>
    </>
  );
};
