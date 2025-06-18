import Button from "@/ui/design-system/atoms/button";
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
    <div className="w-full rounded-lg p-4 transition-colors duration-300 hover:border-gold/50 panel-wood">
      {/* Heading */}
      <h4 className="text-gold mb-3">Center on coordinates</h4>

      {/* Inputs & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {/* Coordinate inputs */}
        <div className="flex gap-2">
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
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 self-start sm:self-auto">
          <Button variant="secondary" onClick={onCenterCoordinates} aria-label="Go to coordinates">
            Go
          </Button>
          <Button variant="danger" onClick={onResetMapCenter} aria-label="Reset map view">
            Reset
          </Button>
        </div>
      </div>
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
