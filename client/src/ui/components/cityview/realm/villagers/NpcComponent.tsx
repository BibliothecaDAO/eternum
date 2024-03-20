import Avatar from "../../../../elements/Avatar";
import { Npc } from "./types";
import Button from "../../../../elements/Button";

type NpcComponentProps = {
  npc: Npc;
  extraButtons: (typeof Button)[];
};

export const NpcComponent = ({ npc, extraButtons }: NpcComponentProps) => {
  return (
    <>
      <div className="relative flex flex-col border rounded-md border-gray-gold text-xxs text-gray-gold">
        <div className="flex items-stretch content-around flex-row p-2">
          <div className="flex flex-col mr-5 p-2">
            <Avatar src="/images/npc/default-npc.svg" className="m-auto p-1 w-9 h-9 mr-5" />
          </div>
          <div className="flex flex-col text-gold text-xxs w-1/2">
            <p>
              <span>Name: </span> <span className="text-white">{npc.fullName}</span>
            </p>
            <p>
              <span>Age: </span> <span className="text-white">{npc.characteristics.age}</span>
            </p>
            <p>
              <span>Sex: </span> <span className="text-white">{npc.characteristics.sex}</span>
            </p>
            <p>
              <span>Role: </span> <span className="text-white">{npc.characteristics.role}</span>
            </p>
          </div>
          <div className="flex flex-col justify-between text-right">
            <div className="text-white/70">
              <p>Character Trait: {npc.characterTrait}</p>
            </div>
            {extraButtons.map((button) => button as any)}
          </div>
        </div>
      </div>
    </>
  );
};
