import { useNavigate } from "react-router-dom";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { resetBootstrap } from "@/init/bootstrap";
import { BuildingThumbs } from "../../config";

export const HomeButton = () => {
  const navigate = useNavigate();

  const handleHomeClick = () => {
    // Clean up game resources before navigating to landing
    resetBootstrap();
    // Navigate to landing page without page refresh
    navigate("/");
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
