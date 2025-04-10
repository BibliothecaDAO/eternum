import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { useEffect, useState } from "react";
import { HexLocation } from "../model/types";
import { HexInfo } from "./hex-info";
import { HexagonCanvas } from "./hexagon-canvas";

interface HexagonLocationSelectorProps {
  availableLocations: HexLocation[];
  occupiedLocations: HexLocation[];
  onSelect: (col: number, row: number) => void;
  initialSelectedLocation?: HexLocation | null;
  open: boolean;
  onClose: () => void;
}

export function HexagonLocationSelector({
  availableLocations,
  occupiedLocations,
  onSelect,
  initialSelectedLocation = null,
  open,
  onClose,
}: HexagonLocationSelectorProps) {
  const [selectedLocation, setSelectedLocation] = useState<HexLocation | null>(initialSelectedLocation);
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 300 });
  const hexSize = 20;

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const width = Math.min(window.innerWidth - 40, 600);
      const height = Math.min(window.innerWidth - 40, 600);
      setCanvasSize({ width, height });
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Handle hexagon click
  const handleHexClick = (col: number, row: number) => {
    console.log(`Hex clicked: col=${col}, row=${row}`);

    // Check if the hex is occupied
    const isOccupied = occupiedLocations.some((loc) => loc.col === col && loc.row === row);

    // Don't allow selection of occupied hexes
    if (isOccupied) {
      console.log("This location is occupied and cannot be selected");
      return;
    }

    const newLocation = { col, row };

    // Is this hex already selected? If so, deselect it
    if (selectedLocation && selectedLocation.col === col && selectedLocation.row === row) {
      setSelectedLocation(null);
    } else {
      setSelectedLocation(newLocation);
    }
  };

  // Handle the confirm button click
  const handleConfirm = () => {
    if (selectedLocation) {
      onSelect(selectedLocation.col, selectedLocation.row);
      onClose();
    }
  };

  // Handle cancel
  const handleCancel = () => {
    onClose();
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Select Hexagon Location</DrawerTitle>
          <DrawerDescription className="flex flex-col gap-1">
            <p>Click on an available (grey) hexagon to select it. Occupied locations are shown in red.</p>
            <p className="text-xs text-muted-foreground italic">Drag the canvas to explore more locations if needed.</p>
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col items-center justify-center flex-1 p-4">
          <HexInfo selectedLocation={selectedLocation} />

          <div className="w-full overflow-hidden flex-1 flex items-center justify-center p-2 relative">
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background via-transparent to-background opacity-25 z-10" />
            <HexagonCanvas
              width={canvasSize.width}
              height={canvasSize.height}
              hexSize={hexSize}
              availableLocations={availableLocations}
              occupiedLocations={occupiedLocations}
              selectedLocation={selectedLocation}
              onHexClick={handleHexClick}
            />
          </div>
        </div>

        <DrawerFooter className="pt-2">
          <Button onClick={handleConfirm} disabled={!selectedLocation} className="w-full">
            Confirm Selection
          </Button>
          <Button variant="outline" className="w-full" onClick={handleCancel}>
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
