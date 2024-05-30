import useUIStore from "@/hooks/store/useUIStore";
import { ArmiesAtLocation, Battle } from "../../military/Battle";

export const HexagonInformationPanel = () => {
  const clickedHex = useUIStore((state) => state.clickedHex);

  return (
    <>
      <div className="p-2">
        {clickedHex && (
          <>
            <div className="p-2 flex justify-between">
              <h5>Coordinates</h5>
              <div className=" font-bold flex  space-x-2 justify-between self-center ">
                <div>{`x: ${clickedHex!.contractPos.col?.toLocaleString()}`}</div>
                <div>{`y: ${clickedHex!.contractPos.row?.toLocaleString()}`}</div>
              </div>
            </div>

            <Battle />
            <ArmiesAtLocation />
          </>
        )}
      </div>
    </>
  );
};

export default HexagonInformationPanel;
