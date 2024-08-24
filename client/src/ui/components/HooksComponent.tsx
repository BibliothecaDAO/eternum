import { useStructureEntityId } from "@/hooks/helpers/useStructureEntityId";
import { useSubscriptionToHyperstructureEvents } from "@/hooks/store/useLeaderBoardStore";
import { useFetchBlockchainData } from "../../hooks/store/useBlockchainStore";

import { ClientConfigManager } from "@/dojo/modelManager/ClientConfigManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEffect } from "react";

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
