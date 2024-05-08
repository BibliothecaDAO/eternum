import { ReactComponent as Mars } from "../../../../../assets/icons/npc/mars.svg";
import { ReactComponent as Venus } from "../../../../../assets/icons/npc/venus.svg";
import { useEffect, useState } from "react";
import { getNpcImagePath } from "./utils";
import useNpcStore from "@/hooks/store/useNpcStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";

type NpcPopupProps = {
  onClose: () => void;
};

export const InfoNpcPopup = ({ onClose }: NpcPopupProps) => {
  const [backstory, setBackstory] = useState<string>("");
  const { loreMachineJsonRpcCall, npcInInfoPopup } = useNpcStore();

  const getBackstory = async () => {
    const response = await loreMachineJsonRpcCall("getNpcsBackstory", {
      npc_entity_ids: [Number(npcInInfoPopup?.entityId)],
    });
    const backstory = response.backstories_with_entity_ids[0].backstory;
    setBackstory(backstory);
  };

  useEffect(() => {
    if (npcInInfoPopup !== null) getBackstory();
  }, [npcInInfoPopup]);
  return (
    <OSWindow onClick={onClose} show={npcInInfoPopup !== null} title="Details">
      <div style={{ height: "175px" }} className="h-10 flex flex-row h-full w-full p-2 text-xxs text-light-pink">
        <img src={getNpcImagePath(npcInInfoPopup)} className="mr-2 h-full border border-gold" />
        <div className="flex flex-col w-full">
          <div>
            <div className="flex flex-row items-center">
              <p className="text-gold font-semibold text-xs"> {npcInInfoPopup!.fullName}</p>
              <div className="p-1 text-xxs ml-auto mb-auto italic border rounded-br-md rounded-tl-md border-gray-gold">
                {npcInInfoPopup!.characteristics.role}
              </div>
            </div>
            <div className="flex flex-row items-center">
              {npcInInfoPopup!.characteristics.sex == "male" ? (
                <Mars className="fill-cyan-500 h-4" />
              ) : (
                <Venus className="fill-pink-500 h-4" />
              )}
              <p className="capitalize ml-1"> {npcInInfoPopup!.characteristics.sex},</p>
              <p className="ml-1">{npcInInfoPopup!.characteristics.age} y.o.</p>
              <p className="ml-1 text-xl relative bottom-1.5">.</p>
              <p className="ml-1 capitalize">{npcInInfoPopup!.characterTrait}</p>
            </div>
          </div>
          <div className="h-full mt-2 p-2 rounded-md bg-dark overflow-y-auto">{backstory}</div>
        </div>
      </div>
    </OSWindow>
  );
};
