import { useEffect } from "react";
import { useFetchBlockchainData } from "../../hooks/store/useBlockchainStore";
import { useComputeMarket } from "../../hooks/store/useMarketStore";
import useUIStore from "@/hooks/store/useUIStore";
import { Hexagon } from "@/types";
import { useSetExistingStructures } from "@/hooks/store/_mapStore";

export const HooksComponent = () => {
  useFetchBlockchainData();
  useComputeMarket();
  useSetExistingStructures();

  const setHexData = useUIStore((state) => state.setHexData);

  useEffect(() => {
    fetch("/jsons/hexData.json")
      .then((response) => response.json())
      .then((data) => setHexData(data as Hexagon[]));
  }, []);

  return <></>;
};
