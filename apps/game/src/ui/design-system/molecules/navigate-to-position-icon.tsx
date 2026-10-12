import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { Position } from "@bibliothecadao/eternum";

export const NavigateToPositionIcon = ({
  position,
  hideTooltip = false,
  className = "",
  tooltipContent = "Navigate to Position",
}: {
  position: Position;
  hideTooltip?: boolean;
  className?: string;
  tooltipContent?: string;
}) => {
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  const setNavigationTarget = useUIStore((state) => state.setNavigationTarget);

  return (
    <CircleButton
      image="/image-icons/compass.png"
      size="md"
      className={` fill-gold hover:fill-gold/50 transition-all duration-300 ${className}`}
      onClick={() => {
        const { x, y } = position.getNormalized();
        setNavigationTarget({
          col: x,
          row: y,
        });
      }}
      onMouseEnter={() => {
        if (hideTooltip) return;
        setTooltip({
          content: tooltipContent,
          position: "bottom",
        });
      }}
      onMouseLeave={() => {
        setTooltip(null);
      }}
    />
  );
};
