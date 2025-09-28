import Button from "@/ui/design-system/atoms/button";
import clsx from "clsx";
import { Direction } from "@bibliothecadao/types";

interface DirectionButtonProps {
  direction: Direction;
  label: string;
  availableDirections: Direction[];
  selectedDirection: Direction | null;
  onSelect: (direction: Direction) => void;
}

export const DirectionButton = ({
  direction,
  label,
  availableDirections,
  selectedDirection,
  onSelect,
}: DirectionButtonProps) => {
  const isAvailable = availableDirections.includes(direction);
  const isSelected = selectedDirection === direction;

  return (
    <Button
      variant={isSelected ? "gold" : isAvailable ? "outline" : "secondary"}
      size="md"
      onClick={() => isAvailable && onSelect(direction)}
      disabled={!isAvailable}
      className={clsx(
        "aspect-square text-2xl lg:text-3xl font-bold transition-all duration-300 transform rounded-xl",
        "min-h-[56px] lg:min-h-[64px]",
        "min-w-[56px] lg:min-w-[64px]",
        isSelected
          ? "ring-2 ring-gold/60 shadow-xl shadow-gold/30 scale-110 bg-gradient-to-br from-gold/25 to-gold/15"
          : isAvailable
            ? "hover:bg-gold/15 hover:border-gold/60 hover:scale-105 hover:shadow-lg cursor-pointer hover:-translate-y-0.5"
            : "cursor-not-allowed opacity-40",
        "border-2 backdrop-blur-sm",
      )}
    >
      <span className="drop-shadow-md">{label}</span>
    </Button>
  );
};
