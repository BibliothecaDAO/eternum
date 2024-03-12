import { useDojo } from "../../../../DojoContext";
import Avatar from "../../../../elements/Avatar";
import Button from "../../../../elements/Button";
import { useState } from "react";
import { NpcPopup } from "./NpcPopup";

type npcProps = {
  id: number;
  name: string;
  image: string;
  age: number;
  sex: string;
  role: string;
  hungriness: string;
  happiness: string;
  belligerent: string;
  description: string;
};

type NpcComponentProps = {
  npc: npcProps;
};

export const NpcListComponent = ({ npc }: NpcComponentProps) => {
  const [showNpcStats, setShowNpcStats] = useState(false);

  return (
    <div className="relative flex flex-col border rounded-md border-gray-gold text-xxs text-gray-gold">
      {npc && (
        <>
          <div className="flex flex-row">
            <div className="flex flex-col mr-10">
              <Button
                className="object-left-top !px-[6px] !py-[2px] text-xxs border-gray-gold !text-gray-gold text-white/70 self-start"
                variant="success"
                onClick={() => setShowNpcStats(true)}
              >
                Popup
              </Button>
              <Avatar src={npc.image} className="mt-2 ml-2 p-1 w-9 h-9 mr-5" />
            </div>
            <div className="flex flex-col text-gold text-xxs mt-2 w-1/2">
              <p>
                {" "}
                <span>Name: </span> <span className="text-white">{npc.name}</span>{" "}
              </p>
              <p>
                {" "}
                <span>Age: </span> <span className="text-white">{npc.age}</span>{" "}
              </p>
              <p>
                {" "}
                <span>Sex: </span> <span className="text-white">{npc.sex}</span>{" "}
              </p>
              <p>
                {" "}
                <span>Role: </span> <span className="text-white">{npc.role}</span>{" "}
              </p>
            </div>
            <div className="flex flex-col text-gold text-xxs mt-2 w-1/2">
              <p>
                {" "}
                <span>Hungriness: </span> <span className="text-white">{npc.hungriness}</span>{" "}
              </p>
              <p>
                {" "}
                <span>Happiness: </span> <span className="text-white">{npc.happiness}</span>{" "}
              </p>
              <p>
                {" "}
                <span>Belligerent: </span> <span className="text-white">{npc.belligerent}</span>{" "}
              </p>
            </div>
          </div>
          <div className="mt-3 text-white/70 p-2">
            <p>{npc.description}</p>
          </div>
        </>
      )}
    </div>
  );
};
