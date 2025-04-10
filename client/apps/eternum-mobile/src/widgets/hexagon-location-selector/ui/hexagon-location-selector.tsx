import { Button } from "@/shared/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/ui/drawer";
import { useEffect, useState } from "react";
import { HexLocation } from "../model/types";
import { HexInfo } from "./hex-info";
import { HexagonCanvas } from "./hexagon-canvas";

interface HexagonLocationSelectorProps {
  availableLocations: HexLocation[];
  occupiedLocations: HexLocation[];
  onSelect: (col: number, row: number) => void;
  initialSelectedLocation?: HexLocation | null;
  children?: React.ReactNode;
}

export function HexagonLocationSelector({
  availableLocations,
  occupiedLocations,
  onSelect,
  initialSelectedLocation = null,
  children,
}: HexagonLocationSelectorProps) {
  const [selectedLocation, setSelectedLocation] = useState<HexLocation | null>(initialSelectedLocation);
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 300 });
  const hexSize = 30;

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const width = Math.min(window.innerWidth - 40, 600);
      const height = Math.min(window.innerHeight - 200, 500);
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
    }
  };

  return (
    <Drawer>
      {children && <DrawerTrigger asChild>{children}</DrawerTrigger>}

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Select Hexagon Location</DrawerTitle>
          <DrawerDescription>
            Click on an available (grey) hexagon to select it. Occupied locations are shown in red.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col items-center justify-center flex-1">
          <HexInfo selectedLocation={selectedLocation} />

          <div className="w-full overflow-auto flex-1 flex items-center justify-center p-2">
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
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
