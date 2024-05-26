import { useEffect } from "react";
import { useFetchBlockchainData } from "../../hooks/store/useBlockchainStore";
import { useComputeMarket } from "../../hooks/store/useMarketStore";
import useUIStore from "@/hooks/store/useUIStore";
import { Hexagon } from "@/types";
import { useSetExistingStructures } from "@/hooks/store/_mapStore";
import { useComputePointsLeaderboards } from "@/hooks/store/useLeaderBoardStore";

export const HooksComponent = () => {
  useFetchBlockchainData();
  useComputeMarket();
  useSetExistingStructures();
  useComputePointsLeaderboards();

  const setHexData = useUIStore((state) => state.setHexData);

  useEffect(() => {
    fetch("/jsons/hexData.json")
      .then((response) => response.json())
      .then((data) => setHexData(data as Hexagon[]));
  }, []);

  return <></>;
};
