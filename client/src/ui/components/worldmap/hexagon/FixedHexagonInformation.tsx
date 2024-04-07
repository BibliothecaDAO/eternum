import useUIStore from "../../../../hooks/store/useUIStore";
import { getColRowFromUIPosition } from "../../../utils/utils";

export const FixedHexagonInformation = () => {
  const { hexData, highlightPositions } = useUIStore();
  const colRow = getColRowFromUIPosition(highlightPositions[0]?.[0], -highlightPositions[0]?.[1]);

  const biome = hexData?.find((hex) => hex.col === colRow.col && hex.row === colRow.row)?.biome;
  return (
    <div>
      <div className="relative">
        <div className="flex space-x-2 z-10 top-1 left-1 absolute text-xs">
          <div className="rounded  px-2 bg-brown">x: {colRow.col}</div>
          <div className="rounded  px-2 bg-brown">y: {colRow.row}</div>
        </div>
        {biome && <img src={`/images/biomes/${biome?.toLowerCase()}.png`} className="w-full rounded" />}

        <div className="text-xl px-2 uppercase absolute bottom-2 left-2 bg-brown rounded">{biome}</div>
      </div>
    </div>
  );
};
