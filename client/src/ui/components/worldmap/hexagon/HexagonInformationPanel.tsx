import { useState } from "react";
import { SelectWorldMapBuilding } from "@/ui/components/worldmap/hexagon/SelectWorldMapBuilding";
import useUIStore from "@/hooks/store/useUIStore";
import { EntityList } from "../../list/EntityList";
import { useEntities } from "@/hooks/helpers/useEntities";

const MilitaryPanel = () => <div className="p-2">Military</div>;

const CommercePanel = () => <div className="p-2">Commerce</div>;

const BuildPanel = ({ playerRealms }: { playerRealms: () => any }) => (
  <EntityList
    list={playerRealms()}
    title="Build"
    panel={({ entity }) => <SelectWorldMapBuilding entity_id={entity.entity_id} />}
  />
);

export const HexagonInformationPanel = () => {
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const clickedHex = useUIStore((state) => state.clickedHex);

  const { playerRealms } = useEntities();

  const panels = [
    { key: "combat", title: "Military", content: <MilitaryPanel /> },
    { key: "entities", title: "Commerce", content: <CommercePanel /> },
    { key: "build", title: "Build", content: <BuildPanel playerRealms={playerRealms} /> },
  ];

  const togglePanel = (key: string) => {
    setOpenPanel(openPanel === key ? null : key);
  };

  return (
    <>
      <div className="space-y-2">
        <div className="px-2">
          <div>{`x: ${clickedHex?.col}`}</div>
          <div>{`y: ${clickedHex?.row}`}</div>
        </div>
        {panels.map((panel) => (
          <div key={panel.key} className="border-b border-gray-200">
            <button
              className="w-full text-left px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none"
              onClick={() => togglePanel(panel.key)}
            >
              {panel.title}
            </button>
            {openPanel === panel.key && <div className="p-2 text-xs">{panel.content}</div>}
          </div>
        ))}
      </div>
    </>
  );
};

export default HexagonInformationPanel;
