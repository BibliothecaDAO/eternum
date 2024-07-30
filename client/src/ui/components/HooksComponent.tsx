import { useEffect } from "react";
import { useFetchBlockchainData } from "../../hooks/store/useBlockchainStore";

import useUIStore from "@/hooks/store/useUIStore";
import { Hexagon } from "@/types";
import { useSetExistingStructures } from "@/hooks/store/_mapStore";
import { useComputePointsLeaderboards } from "@/hooks/store/useLeaderBoardStore";
import { useTravelPath } from "./worldmap/hexagon/useTravelPath";

export const HooksComponent = () => {
  useFetchBlockchainData();
  useSetExistingStructures();
  useComputePointsLeaderboards();
  useTravelPath();

  const setHexData = useUIStore((state) => state.setHexData);

  useEffect(() => {
    fetch("/jsons/hexData.json")
      .then((response) => response.json())
      .then((data) => setHexData(data as Hexagon[]));
  }, []);

  return <></>;
};
