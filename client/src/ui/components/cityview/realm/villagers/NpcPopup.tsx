import { SecondaryPopup } from "../../../../elements/SecondaryPopup"; // Assuming this handles styling and layout

export const NpcPopup = ({ onClose, npc }) => {
    // const [selectedNpc, setSelectedNpc] = useState(null);

    // const handleNpcChange = (npcId) => {
    //     const npc = npcs.find(n => n.id === npcId);
    //     setSelectedNpc(npc);
    // };

    return (
      <SecondaryPopup name="NpcStats-popup">
        <SecondaryPopup.Head onClose={onClose}>
          <div className="flex items-center space-x-1">
            <div className="mr-0.5">Npc stats</div>
          </div>
        </SecondaryPopup.Head>
        <SecondaryPopup.Body width={"476px"}>
            <div className="flex flex-col p-2 text-white">

                {/* Dropdown for selecting NPC
                <NpcListSelect
                    options={npcs.map(npc => ({ id: npc.id, label: npc.name }))}
                    selectedValue={selectedNpc ? selectedNpc.id : 'none'}
                    onChange={handleNpcChange}
                    className="w-full mb-4"
                /> */}
            
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