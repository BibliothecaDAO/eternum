import { useUIStore } from "@/hooks/store/use-ui-store";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { BuildingThumbs } from "../../config";
export const HomeButton = () => {
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);

  const handleHomeClick = () => {
    setShowBlankOverlay(true);
  };

  return <CircleButton image={BuildingThumbs.home} onClick={() => handleHomeClick()} size="md"></CircleButton>;
};
