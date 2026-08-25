import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@bibliothecadao/eternum";

import clsx from "clsx";
import CircleButton from "./circle-button";
export const ViewOnMapIcon = ({
  position,
  hideTooltip = false,
  className,
}: {
  position: PositionInterface;
  hideTooltip?: boolean;
  className?: string;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const navigateToMapView = useNavigateToMapView();

  return (
    <CircleButton
      image="/image-icons/world.png"
      size="md"
      className={clsx(" fill-gold hover:fill-gold/50 hover:animate-pulse duration-300 transition-all", className)}
      onClick={() => {
        setTooltip(null);
        navigateToMapView(position);
      }}
      onMouseEnter={() => {
        if (hideTooltip) return;
        setTooltip({
          content: "View on Map",
          position: "bottom",
        });
      }}
      onMouseLeave={() => {
        setTooltip(null);
      }}
    />
  );
};
