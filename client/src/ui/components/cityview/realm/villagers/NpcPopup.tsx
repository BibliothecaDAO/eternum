import Avatar from "../../../../elements/Avatar";
import { SecondaryPopup } from "../../../../elements/SecondaryPopup";
import { Npc } from "./types";

interface NpcPopupProps {
  onClose: () => void;
  npc: Npc | undefined;
}

export const NpcPopup = ({ onClose, npc }: NpcPopupProps) => {
  return (
    npc && (
      <SecondaryPopup name="NpcStats-popup">
        <SecondaryPopup.Head onClose={onClose}>
          <div className="flex items-center space-x-1">
            <div className="mr-0.5">{npc.fullName}</div>
          </div>
        </SecondaryPopup.Head>
        <SecondaryPopup.Body width={"350px"} height={"100%"}>
          {npc && (
            <>
              <div className="relative flex flex-col text-xxs text-gray-gold p-1">
                <div className="relative flex flex-row text-xxs text-gray-gold">
                  <div className="flex flex-col">
                    <Avatar src="/images/npc/default-npc.svg" className="mt-4 ml-2 p-1 w-9 h-9 mr-10" />
                  </div>
                  <div className="flex flex-col text-gold text-xxs mt-2 w-1/2">
                    <p>
                      {" "}
                      <span>Age: </span> <span className="text-white">{npc.characteristics.age}</span>{" "}
                    </p>
                    <p>
                      {" "}
                      <span>Sex: </span> <span className="text-white">{npc.characteristics.sex}</span>{" "}
                    </p>
                    <p>
                      {" "}
                      <span>Role: </span> <span className="text-white">{npc.characteristics.role}</span>{" "}
                    </p>
                  </div>
                  <div className="flex flex-col text-gold text-xxs mt-2 w-1/2">
                    <p>
                      {" "}
                      <span>Character trait: </span> <span className="text-white">{npc.characterTrait}</span>{" "}
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-white/70 p-2">
                  <p>Decription: Lorem Ipsum</p>
                </div>
              </div>
            </>
          )}
        </SecondaryPopup.Body>
      </SecondaryPopup>
    )
  );
};
