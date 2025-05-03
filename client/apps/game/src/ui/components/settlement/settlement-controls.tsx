import Button from "@/ui/elements/button";
import { SettlementLocation } from "./settlement-types";

interface CoordinateInputProps {
  value: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  label: string;
}

/**
 * Coordinate input component
 */
const CoordinateInput = ({ value, onChange, placeholder, label }: CoordinateInputProps) => (
  <input
    type="text"
    value={value}
    onChange={onChange}
    className="w-24 mr-2 bg-black/50 border border-gold/30 rounded px-2 py-1 text-gold focus:border-gold focus:outline-none transition-colors duration-200"
    placeholder={placeholder}
    aria-label={label}
  />
);

interface SettlementControlsProps {
  customNormalizedCoords: { x: number | string; y: number | string };
  onCoordinateChange: (e: React.ChangeEvent<HTMLInputElement>, coord: "x" | "y") => void;
  onCenterCoordinates: () => void;
  onResetMapCenter: () => void;
}

/**
 * Settlement controls component - handles the coordinate inputs and map controls
 */
export const SettlementControls = ({
  customNormalizedCoords,
  onCoordinateChange,
  onCenterCoordinates,
  onResetMapCenter,
}: SettlementControlsProps) => {
  return (
    <div className="flex items-center justify-between w-full mb-2 bg-black/30 rounded-lg border border-gold/30 p-2 transition-all duration-300 hover:border-gold/50">
      <div className="flex items-center flex-wrap gap-2">
        <div className="text-gold">Center on:</div>
        <div className="flex items-center">
          <CoordinateInput
            value={customNormalizedCoords.x}
            onChange={(e) => onCoordinateChange(e, "x")}
            placeholder="X"
            label="X coordinate"
          />
          <CoordinateInput
            value={customNormalizedCoords.y}
            onChange={(e) => onCoordinateChange(e, "y")}
            placeholder="Y"
            label="Y coordinate"
          />
          <Button
            variant="secondary"
            onClick={onCenterCoordinates}
            className="mr-2 hover:bg-gold/20 transition-colors duration-200"
            aria-label="Go to coordinates"
          >
            Go
          </Button>
        </div>
      </div>
      <Button
        variant="secondary"
        onClick={onResetMapCenter}
        className="hover:bg-gold/20 transition-colors duration-200"
        aria-label="Reset map view"
      >
        <span className="flex items-center">
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Reset View
        </span>
      </Button>
    </div>
  );
};

interface SettlementInfoPanelProps {
  selectedLocation: SettlementLocation | null;
  selectedCoords: { x: number; y: number } | null;
}

/**
 * Settlement info panel component - displays information about the selected location
 */
export const SettlementInfoPanel = ({ selectedLocation, selectedCoords }: SettlementInfoPanelProps) => {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-gold/30  w-full transition-all duration-300 hover:border-gold/50">
      {selectedLocation ? (
        <div className="text-center w-full py-2">
          <div className="flex justify-center items-center gap-4 text-gold">
            <div className="flex flex-col items-center rounded-md hover:bg-black/50 transition-colors duration-200">
              <div className="text-xs text-gold/70 uppercase tracking-wider">X</div>
              <div className="text-xl font-bold">{selectedCoords?.x}</div>
            </div>
            <div className="flex flex-col items-center rounded-md hover:bg-black/50 transition-colors duration-200">
              <div className="text-xs text-gold/70 uppercase tracking-wider">Y</div>
              <div className="text-xl font-bold">{selectedCoords?.y}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-xl font-semibold text-gold flex items-center">
            <svg
              className="w-6 h-6 mr-2 text-gold/70 animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Click on the map to select a location for your realm
          </div>
        </div>
      )}
    </div>
  );
};

interface ConfirmButtonProps {
  selectedLocation: SettlementLocation | null;
  onConfirm: () => void;
}

/**
 * Confirm button component
 */
export const ConfirmButton = ({ selectedLocation, onConfirm }: ConfirmButtonProps) => {
  return (
    <Button
      disabled={!selectedLocation}
      className={`w-full transition-all duration-300  ${selectedLocation ? "animate-pulse" : ""}`}
      variant="gold"
      onClick={onConfirm}
    >
      {selectedLocation ? "Confirm Location" : "Select a Location First"}
    </Button>
  );
};
