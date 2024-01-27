import { SecondaryPopup } from "../../../../elements/SecondaryPopup";

interface NpcPopupProps {
  onClose: () => void;
  npc: any;
}

export const NpcPopup = ({ onClose, npc }: NpcPopupProps) => {
    return (
      <SecondaryPopup name="NpcStats-popup">
        <SecondaryPopup.Head onClose={onClose}>
          <div className="flex items-center space-x-1">
            <div className="mr-0.5">Npc stats</div>
          </div>
        </SecondaryPopup.Head>
        <SecondaryPopup.Body width={"476px"}>
            <div className="flex flex-col p-2 text-white">
                {npc && (<>   
                    <div className="flex flex-row">    
                        <div className="flex flex-col text-gold text-xxs mt-2">
                            <p> <span className="text-white">Just in case we need a popup</span> </p>
                        </div>
                    </div>
                </>)}
            </div>
        </SecondaryPopup.Body>
      </SecondaryPopup>
    );
  };