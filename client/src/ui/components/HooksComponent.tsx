import { useEffect } from "react";
import { useFetchBlockchainData } from "../../hooks/store/useBlockchainStore";
import { useComputeMarket } from "../../hooks/store/useMarketStore";
import useRealmStore from "../../hooks/store/useRealmStore";
import useUIStore from "@/hooks/store/useUIStore";
import { Hexagon } from "@/types";

export const HooksComponent = () => {
  useFetchBlockchainData();
  useComputeMarket();

  const setHexData = useUIStore((state) => state.setHexData);

  useEffect(() => {
    fetch("/jsons/hexData.json")
      .then((response) => response.json())
      .then((data) => setHexData(data as Hexagon[]));
  }, []);

  return <></>;
};
