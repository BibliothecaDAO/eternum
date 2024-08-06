import { useHexPosition } from "@/hooks/helpers/useHexPosition";
import { useSubscriptionToHyperstructureEvents } from "@/hooks/store/useLeaderBoardStore";
import { useFetchBlockchainData } from "../../hooks/store/useBlockchainStore";

export const HooksComponent = () => {
  useFetchBlockchainData();
  useSubscriptionToHyperstructureEvents();
  useHexPosition();

  return <></>;
};
