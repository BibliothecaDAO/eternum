import CircleButton from "@/ui/design-system/molecules/circle-button";
import { BuildingThumbs } from "../../config";

export const HomeButton = () => {
  const handleHomeClick = () => {
    // Navigate to landing page
    window.location.href = "/";
  };

  return (
    <CircleButton
      image={BuildingThumbs.home}
      onClick={() => handleHomeClick()}
      size="md"
      tooltipLocation="bottom"
      label="Home"
    />
  );
};
