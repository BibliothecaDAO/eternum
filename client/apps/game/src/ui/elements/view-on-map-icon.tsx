import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@/types/position";
import clsx from "clsx";

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
    <img
      src="/image-icons/world.png"
      className={clsx(
        "h-5 w-5 fill-gold hover:fill-gold/50 hover:animate-pulse duration-300 transition-all",
        className,
      )}
      onClick={() => {
        setTooltip(null);
        navigateToMapView(position);
      }}
      onMouseEnter={() => {
        if (hideTooltip) return;
        setTooltip({
          content: "View on Map",
          position: "top",
        });
      }}
      onMouseLeave={() => {
        setTooltip(null);
      }}
    />
  );
};
