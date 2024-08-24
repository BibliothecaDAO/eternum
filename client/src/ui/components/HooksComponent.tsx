import { useStructureEntityId } from "@/hooks/helpers/useStructureEntityId";
import { useFetchBlockchainData } from "@/hooks/store/useBlockchainStore";
import { useSubscriptionToHyperstructureEvents } from "@/hooks/store/useLeaderBoardStore";

export const HooksComponent = () => {
  useFetchBlockchainData();
  useSubscriptionToHyperstructureEvents();
  useStructureEntityId();

  return <></>;
};
