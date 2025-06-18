import { useUIStore } from "@/hooks/store/use-ui-store";
import CircleButton from "@/ui/elements/circle-button";
import { BuildingThumbs } from "../../config";
export const HomeButton = () => {
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);

  const handleHomeClick = () => {
    setShowBlankOverlay(true);
  };

  return <CircleButton image={BuildingThumbs.home} onClick={() => handleHomeClick()} size="md"></CircleButton>;
};
