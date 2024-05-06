import { useEffect } from "react";
import { useFetchBlockchainData } from "../../hooks/store/useBlockchainStore";
import { useComputeMarket } from "../../hooks/store/useMarketStore";
import { useRefreshHyperstructure } from "../../hooks/store/useRefreshHyperstructure";
import useRealmStore from "../../hooks/store/useRealmStore";
import useUIStore from "@/hooks/store/useUIStore";
import { Hexagon } from "@/types";

export const HooksComponent = () => {
  useFetchBlockchainData();
  useComputeMarket();
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const { refreshAllHyperstructures } = useRefreshHyperstructure();
  useEffect(() => {
    refreshAllHyperstructures();
  }, [realmEntityIds]);

  const setHexData = useUIStore((state) => state.setHexData);

  useEffect(() => {
    fetch("/jsons/hexData.json")
      .then((response) => response.json())
      .then((data) => setHexData(data as Hexagon[]));
  }, []);

  return <></>;
};
