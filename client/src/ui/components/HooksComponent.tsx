import { useHexPosition } from "@/hooks/helpers/useHexPosition";
import { useSubscriptionToHyperstructureEvents } from "@/hooks/store/useLeaderBoardStore";
import { useFetchBlockchainData } from "../../hooks/store/useBlockchainStore";
import { useAccountChange } from "@/hooks/helpers/useAccountChange";

export const HooksComponent = () => {
  useFetchBlockchainData();
  useSubscriptionToHyperstructureEvents();
  useHexPosition();
  useAccountChange();

  return <></>;
};
