import { useFetchBlockchainData } from "../../hooks/store/useBlockchainStore";
import { useSetExistingStructures } from "@/hooks/store/_mapStore";
import { useComputePointsLeaderboards } from "@/hooks/store/useLeaderBoardStore";
import { useTravelPath } from "./worldmap/hexagon/useTravelPath";
import { useHexPosition } from "@/hooks/helpers/useHexPosition";

export const HooksComponent = () => {
  useFetchBlockchainData();
  useSetExistingStructures();
  useComputePointsLeaderboards();
  useTravelPath();
  useHexPosition();

  return <></>;
};
