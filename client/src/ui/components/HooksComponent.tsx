import { useFetchBlockchainData } from "../../hooks/store/useBlockchainStore";
import { useComputePointsLeaderboards } from "@/hooks/store/useLeaderBoardStore";
import { useHexPosition } from "@/hooks/helpers/useHexPosition";

export const HooksComponent = () => {
  useFetchBlockchainData();
  useComputePointsLeaderboards();
  useHexPosition();

  return <></>;
};
