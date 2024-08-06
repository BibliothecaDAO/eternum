import { useEffect } from "react";
import { useFetchBlockchainData } from "../../hooks/store/useBlockchainStore";

import { useSetExistingStructures } from "@/hooks/store/_mapStore";
import useUIStore from "@/hooks/store/useUIStore";
import { Hexagon } from "@/types";
import { useTravelPath } from "./worldmap/hexagon/useTravelPath";

export const HooksComponent = () => {
  useFetchBlockchainData();
  useTravelPath();
  useSetExistingStructures();

  const setHexData = useUIStore((state) => state.setHexData);

  useEffect(() => {
    fetch("/jsons/hexData.json")
      .then((response) => response.json())
      .then((data) => setHexData(data as Hexagon[]));
  }, []);

  return <></>;
};
