import { useState } from "react";
import { SelectWorldMapBuilding } from "@/ui/components/worldmap/hexagon/SelectWorldMapBuilding";
import useUIStore from "@/hooks/store/useUIStore";

export const HexagonInformationPanel = () => {
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const clickedHex = useUIStore((state) => state.clickedHex);

  const panels = [
    { key: "combat", title: "Military", content: <div className="p-2">Military</div> },
    { key: "entities", title: "Commerce", content: <div className="p-2">Commerce</div> },
    { key: "build", title: "Build", content: <SelectWorldMapBuilding /> },
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
