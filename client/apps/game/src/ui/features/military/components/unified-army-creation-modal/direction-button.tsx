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
      onClick={() => isAvailable && onSelect(direction)}
      disabled={!isAvailable}
      className={clsx(
        "aspect-square text-xl font-extrabold transition-all duration-200 transform rounded-lg p-0",
        "min-h-[32px] min-w-[32px]",
        isSelected
          ? "ring-2 ring-gold shadow-xl shadow-gold/40 scale-110 bg-gradient-to-br from-gold/25 to-gold/15"
          : isAvailable
            ? "hover:bg-gold/15 hover:border-gold/60 hover:scale-105 hover:shadow-md cursor-pointer"
            : "cursor-not-allowed opacity-30",
        "border-2 backdrop-blur-sm",
      )}
    >
      <span className="drop-shadow-md">{label}</span>
    </Button>
  );
};
