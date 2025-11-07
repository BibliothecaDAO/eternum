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
    <div className="p-4 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-brown/30">
      <div className="text-center mb-4">
        <h6 className="text-gold text-lg font-bold mb-1">SPAWN DIRECTION</h6>
        <p className="text-gold/60 text-sm">Select where your army will deploy</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingAnimation />
        </div>
      ) : availableDirections.length > 0 ? (
        <div className="grid grid-cols-3 gap-4 mx-auto w-full max-w-[320px]">
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
          <div className="flex items-center justify-center text-5xl lg:text-6xl drop-shadow-lg filter brightness-110">
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
        <div className="text-center p-4 bg-gradient-to-r from-danger/15 to-danger/10 border-2 border-danger/40 rounded-xl shadow-lg">
          <div className="p-2 rounded-full bg-danger/20 w-fit mx-auto mb-2">
            <AlertTriangle className="w-6 h-6 text-danger" />
          </div>
          <p className="text-danger font-semibold">No adjacent tiles available</p>
          <p className="text-danger/80 text-sm mt-1">All surrounding tiles are occupied</p>
        </div>
      )}
    </div>
  );
};
