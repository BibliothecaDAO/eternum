import useUIStore from "@/hooks/store/useUIStore";
import { ArmiesAtLocation, Battle } from "../../military/Battle";

export const HexagonInformationPanel = () => {
  const clickedHex = useUIStore((state) => state.clickedHex);
  const { col: x, row: y } = clickedHex!.contractPos;

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

        <ArmiesAtLocation />
        <Battle />
      </div>
    </>
  );
};

export default HexagonInformationPanel;
