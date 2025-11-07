import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { Direction } from "@bibliothecadao/types";
import { AlertTriangle } from "lucide-react";

import { DirectionButton } from "./direction-button";

interface DirectionSelectionProps {
  availableDirections: Direction[];
  selectedDirection: Direction | null;
  isLoading: boolean;
  onSelect: (direction: Direction) => void;
}

export const DirectionSelection = ({
  availableDirections,
  selectedDirection,
  isLoading,
  onSelect,
}: DirectionSelectionProps) => {
  return (
    <div className="flex-1 p-1.5 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-gold/20">
      {isLoading ? (
        <div className="flex justify-center py-4">
          <LoadingAnimation />
        </div>
      ) : availableDirections.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5 mx-auto w-full max-w-[180px]">
          <DirectionButton
            direction={Direction.SOUTH_WEST}
            label="↖"
            availableDirections={availableDirections}
            selectedDirection={selectedDirection}
            onSelect={onSelect}
          />
          <div />
          <DirectionButton
            direction={Direction.SOUTH_EAST}
            label="↗"
            availableDirections={availableDirections}
            selectedDirection={selectedDirection}
            onSelect={onSelect}
          />
          <DirectionButton
            direction={Direction.WEST}
            label="←"
            availableDirections={availableDirections}
            selectedDirection={selectedDirection}
            onSelect={onSelect}
          />
          <div className="flex items-center justify-center text-4xl drop-shadow-xl filter brightness-110">
            🏰
          </div>
          <DirectionButton
            direction={Direction.EAST}
            label="→"
            availableDirections={availableDirections}
            selectedDirection={selectedDirection}
            onSelect={onSelect}
          />
          <DirectionButton
            direction={Direction.NORTH_WEST}
            label="↙"
            availableDirections={availableDirections}
            selectedDirection={selectedDirection}
            onSelect={onSelect}
          />
          <div />
          <DirectionButton
            direction={Direction.NORTH_EAST}
            label="↘"
            availableDirections={availableDirections}
            selectedDirection={selectedDirection}
            onSelect={onSelect}
          />
        </div>
      ) : (
        <div className="text-center p-2 bg-danger/10 border-l-2 border-danger rounded">
          <div className="p-1 rounded-full bg-danger/20 w-fit mx-auto mb-1">
            <AlertTriangle className="w-4 h-4 text-danger" />
          </div>
          <p className="text-danger font-bold text-xxs">No adjacent tiles</p>
        </div>
      )}
    </div>
  );
};
