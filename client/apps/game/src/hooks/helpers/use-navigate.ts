import { Position } from "@/types/position";
import { ACCOUNT_CHANGE_EVENT } from "@/ui/modules/onboarding/steps";
import { type Position as PositionType } from "@bibliothecadao/eternum";
import { useQuery } from "@bibliothecadao/react";
import { useUIStore } from "../store/use-ui-store";

export const useNavigateToHexView = () => {
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  const { handleUrlChange } = useQuery();

  return (position: PositionType) => {
    const url = new Position(position).toHexLocationUrl();

    setIsLoadingScreenEnabled(true);
    showBlankOverlay(false);
    handleUrlChange(url);
    window.dispatchEvent(new Event(ACCOUNT_CHANGE_EVENT));
  };
};
