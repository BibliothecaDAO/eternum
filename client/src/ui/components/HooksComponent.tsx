import { ClientConfigManager } from "@/dojo/modelManager/ClientConfigManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useStructureEntityId } from "@/hooks/helpers/useStructureEntityId";
import { useSubscriptionToHyperstructureEvents } from "@/hooks/store/useLeaderBoardStore";
import { useEffect } from "react";
import { useFetchBlockchainData } from "../../hooks/store/useBlockchainStore";

export const HooksComponent = () => {
  const dojo = useDojo();

  const config = ClientConfigManager.instance();

  useEffect(() => {
    config.setDojo(dojo);
  }, [dojo]);

  useFetchBlockchainData();
  useSubscriptionToHyperstructureEvents();
  useStructureEntityId();

  return <></>;
};
