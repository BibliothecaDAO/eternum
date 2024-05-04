import { useMemo, useState } from "react";
import { SelectWorldMapBuilding } from "@/ui/components/worldmap/hexagon/SelectWorldMapBuilding";
import useUIStore from "@/hooks/store/useUIStore";
import { EntityList } from "../../list/EntityList";
import { useEntities } from "@/hooks/helpers/useEntities";
import { ArmiesAtLocation, Battle } from "../../military/Battle";
import { PositionArmyList } from "../../military/ArmyList";
import { useHexPosition } from "@/hooks/helpers/useHexPosition";

const BuildPanel = ({ playerRealms }: { playerRealms: () => any }) => (
  <EntityList
    list={playerRealms()}
    title="Build for"
    panel={({ entity }) => <SelectWorldMapBuilding entityId={entity.entity_id} />}
  />
);

export const HexagonInformationPanel = () => {
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const { playerRealms } = useEntities();
  const clickedHex = useUIStore((state) => state.clickedHex);
  const { col: x, row: y } = clickedHex!.contractPos;
  const panels = [
    { key: "build", title: "Build", content: <BuildPanel playerRealms={playerRealms} /> },
    { key: "combat", title: "Combat", content: <Battle /> },
  ];

  const togglePanel = (key: string) => {
    setOpenPanel(openPanel === key ? null : key);
  };

  // const { getBiome } = useHexPosition();

  // const biome = useMemo(() => {
  //   return getBiome({ x, y });
  // }, [getBiome]);

  return (
    <>
      <div className="p-2">
        <div className="p-2 flex justify-between">
          <h5>Coordinates</h5>
          <div className=" font-bold flex  space-x-2 justify-between self-center ">
            <div>{`x: ${x?.toLocaleString()}`}</div>
            <div>{`y: ${y?.toLocaleString()}`}</div>
          </div>
        </div>

        <div>
          <h5>Biome</h5>
          {/* {biome && <img src={`/images/biomes/${biome?.toLowerCase()}.png`} className="w-full rounded" />} */}
        </div>

        <ArmiesAtLocation />
        <Battle />

        {/* {panels.map((panel) => (
          <div key={panel.key} className="border-gray-200">
            <button
              className="w-full text-left px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none font-bold h5"
              onClick={() => togglePanel(panel.key)}
            >
              {panel.title}
            </button>
            {openPanel === panel.key && <div className="">{panel.content}</div>}
          </div>
        ))} */}
      </div>
    </>
  );
};

export default HexagonInformationPanel;
