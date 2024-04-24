import { SecondaryPopup } from "../../../../elements/SecondaryPopup";
import useNpcStore from "../../../../hooks/store/useNpcStore";
import { ReactComponent as Mars } from "../../../../assets/icons/npc/mars.svg";
import { ReactComponent as Venus } from "../../../../assets/icons/npc/venus.svg";
import { useEffect, useState } from "react";
import { Npc } from "./types";
import { getNpcImagePath } from "./utils";

type NpcPopupProps = {
  selectedNpc: Npc;
  onClose: () => void;
};

export const NpcPopup = ({ selectedNpc, onClose }: NpcPopupProps) => {
  const [backstory, setBackstory] = useState<string>("");
  const { loreMachineJsonRpcCall } = useNpcStore();

  const getBackstory = async () => {
    const response = await loreMachineJsonRpcCall("getNpcsBackstory", {
      npc_entity_ids: [Number(selectedNpc?.entityId)],
    });
    const backstory = response.backstories_with_entity_ids[0].backstory;
    setBackstory(backstory);
  };

  useEffect(() => {
    getBackstory();
  }, [selectedNpc]);

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Details</div>
        </div>
      </SecondaryPopup.Head>

      <SecondaryPopup.Body width={"400px"} height={"175px"}>
        <div className="flex flex-row h-full w-full p-2 text-xxs text-light-pink">
          <img src={getNpcImagePath(selectedNpc)} className="mr-2 h-full border border-gold" />
          <div className="flex flex-col w-full">
            <div>
              <div className="flex flex-row items-center">
                <p className="text-gold font-semibold text-xs"> {selectedNpc!.fullName}</p>
                <div className="p-1 text-xxs ml-auto mb-auto italic border rounded-br-md rounded-tl-md border-gray-gold">
                  {selectedNpc!.characteristics.role}
                </div>
              </div>
              <div className="flex flex-row items-center">
                {selectedNpc!.characteristics.sex == "male" ? (
                  <Mars className="fill-cyan-500 h-4" />
                ) : (
                  <Venus className="fill-pink-500 h-4" />
                )}
                <p className="capitalize ml-1"> {selectedNpc!.characteristics.sex},</p>
                <p className="ml-1">{selectedNpc!.characteristics.age} y.o.</p>
                <p className="ml-1 text-xl relative bottom-1.5">.</p>
                <p className="ml-1 capitalize">{selectedNpc!.characterTrait}</p>
              </div>
            </div>
            <div className="h-full mt-2 p-2 rounded-md bg-dark overflow-y-auto">{backstory}</div>
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
