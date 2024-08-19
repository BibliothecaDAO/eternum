import { useSubscriptionToHyperstructureEvents } from "@/hooks/store/useLeaderBoardStore";
import { useFetchBlockchainData } from "../../hooks/store/useBlockchainStore";
import { useStructureEntityId } from "@/hooks/helpers/useStructureEntityId";

export const HooksComponent = () => {
  useFetchBlockchainData();
  useSubscriptionToHyperstructureEvents();
  useStructureEntityId();

  return <></>;
};
