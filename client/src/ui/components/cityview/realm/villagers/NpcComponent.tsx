import Button from "../../../../elements/Button";
import { Npc } from "./types";
import { ReactComponent as Mars } from "../../../../assets/icons/npc/mars.svg";
import { ReactComponent as Venus } from "../../../../assets/icons/npc/venus.svg";
import { ReactComponent as Info } from "../../../../assets/icons/npc/info.svg";
import { getNpcImagePath } from "./utils";

type NpcComponentProps = {
  npc: Npc;
  extraButtons: (typeof Button)[];
  getDisplayedInfo: JSX.Element;
  setSelectedNpc: (state: Npc) => void;
};

export const NpcComponent = ({ npc, extraButtons, getDisplayedInfo, setSelectedNpc }: NpcComponentProps) => {
  return (
    <>
      <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-light-pink">
        <div className="flex items-center">
          <div className="p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0 rounded-br-md border-gray-gold">
            {npc.characteristics.role}
          </div>

          <>{getDisplayedInfo}</>
        </div>

        <div className="flex w-full mt-2">
          <img src={getNpcImagePath(npc)} className="h-10 w-10 border border-gold" />

          <div className="flex flex-col mt-auto ml-2">
            <div className="flex flex-row items-center">
              <p className="text-gold font-semibold text-xs"> {npc.fullName}</p>
              <button className="cursor-pointer" onClick={() => setSelectedNpc(npc)}>
                <Info className="ml-1.5 rounded-sm  p-0.5 bg-gold" />
              </button>
            </div>

            <div className="flex flex-row items-center">
              {npc.characteristics.sex == "male" ? (
                <Mars className="fill-cyan-500 h-4" />
              ) : (
                <Venus className="fill-pink-500 h-4" />
              )}
              <p className="capitalize ml-1"> {npc.characteristics.sex},</p>
              <p className="ml-1">{npc.characteristics.age} y.o.</p>
              <p className="ml-1 text-xl relative bottom-1.5">.</p>
              <p className="ml-1 capitalize mr-auto">{npc.characterTrait}</p>
            </div>
          </div>

          <div className="ml-auto mt-auto p-2">{extraButtons.map((button) => button as any)}</div>
        </div>
      </div>
    </>
  );
};
