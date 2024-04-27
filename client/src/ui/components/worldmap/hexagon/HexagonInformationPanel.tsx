import { useState } from "react";
import { SelectWorldMapBuilding } from "@/ui/components/worldmap/hexagon/SelectWorldMapBuilding";
import useUIStore from "@/hooks/store/useUIStore";
import { EntityList } from "../../list/EntityList";
import { useEntities } from "@/hooks/helpers/useEntities";
import { Battle } from "../../military/Battle";

const CommercePanel = () => <div className="p-2">Commerce</div>;

const BuildPanel = ({ playerRealms }: { playerRealms: () => any }) => (
  <EntityList
    list={playerRealms()}
    title="Build for"
    panel={({ entity }) => <SelectWorldMapBuilding entityId={entity.entity_id} />}
  />
);

export const HexagonInformationPanel = () => {
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const clickedHex = useUIStore((state) => state.clickedHex);

  const { playerRealms } = useEntities();

  const panels = [
    { key: "build", title: "Improve Location", content: <BuildPanel playerRealms={playerRealms} /> },
    { key: "combat", title: "Battles at Location", content: <Battle /> },
    // { key: "entities", title: "Commerce", content: <CommercePanel /> },
  ];

  const togglePanel = (key: string) => {
    setOpenPanel(openPanel === key ? null : key);
  };

  return (
    <>
      <div className="space-y-2">
        {/* <div className="p-2">
          <h5>Coordinates</h5>
          <div className="p-2 font-bold flex  space-x-2 justify-between">
            <div>{`x: ${clickedHex?.col.toLocaleString()}`}</div>
            <div>{`y: ${clickedHex?.row.toLocaleString()}`}</div>
          </div>
        </div> */}

        {panels.map((panel) => (
          <div key={panel.key} className="border-b border-gray-200">
            <button
              className="w-full text-left px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none font-bold h5"
              onClick={() => togglePanel(panel.key)}
            >
              {panel.title}
            </button>
            {openPanel === panel.key && <div className="">{panel.content}</div>}
          </div>
        ))}
      </div>
    </>
  );
};

export default HexagonInformationPanel;
