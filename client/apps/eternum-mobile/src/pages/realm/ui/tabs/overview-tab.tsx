import { useResourceArrivals } from "@/features/resource-arrivals";
import { useStore } from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { ArrivedDonkeys } from "@/widgets/arrived-donkeys";
import { HexagonLocationSelector, HexLocation } from "@/widgets/hexagon-location-selector";
import { NearbyEnemies } from "@/widgets/nearby-enemies";
import { ResourcesCard } from "@/widgets/resources-card";
import { UpgradeCastle } from "@/widgets/upgrade-castle";
import { useCallback, useState } from "react";
import { ProductionWidgetsSection } from "../components/production-widgets-section";
import { useRealmTabs } from "../realm-page";

export function OverviewTab() {
  const { switchTab } = useRealmTabs();
  const structureEntityId = useStore((state) => state.structureEntityId);
  const selectedRealm = useStore((state) => state.selectedRealm);
  const { summary } = useResourceArrivals(structureEntityId);

  // Hexagon selector example state
  const [selectedHexLocation, setSelectedHexLocation] = useState<HexLocation | null>(null);
  const [isHexSelectorOpen, setIsHexSelectorOpen] = useState(false);

  // Generate a larger grid of hexagons for the example
  const generateHexGrid = (radius: number): HexLocation[] => {
    const result: HexLocation[] = [];

    for (let q = -radius; q <= radius; q++) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);

      for (let r = r1; r <= r2; r++) {
        result.push({ col: q, row: r });
      }
    }

    return result;
  };

  // Dummy data for the hexagon grid
  const dummyAvailableLocations = [
    { col: 1, row: 1 },
    { col: 0, row: 1 },
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: -1, row: 0 },
    { col: 0, row: -1 },
    { col: 1, row: -1 },
  ];

  const dummyOccupiedLocations: HexLocation[] = [
    { col: 1, row: -1 },
    { col: 0, row: 0 },
  ];

  const handleHexSelect = useCallback((col: number, row: number) => {
    console.log(`Selected hex at column: ${col}, row: ${row}`);
    setSelectedHexLocation({ col, row });
  }, []);

  const handleViewEnemies = useCallback(() => {
    switchTab("military");
  }, [switchTab]);

  const handleClaimDonkeys = useCallback(() => {
    switchTab("claim");
  }, [switchTab, summary.readyArrivals]);

  const openHexSelector = useCallback(() => {
    setIsHexSelectorOpen(true);
  }, []);

  const closeHexSelector = useCallback(() => {
    setIsHexSelectorOpen(false);
  }, []);

  return (
    <div className="space-y-4">
      <ResourcesCard entityId={structureEntityId} />

      {selectedRealm && <ProductionWidgetsSection selectedRealm={selectedRealm} />}

      <UpgradeCastle realmEntityId={structureEntityId} />

      <div className="grid grid-cols-2 gap-4">
        <NearbyEnemies onView={handleViewEnemies} />
        <ArrivedDonkeys
          onClaim={handleClaimDonkeys}
          readyCount={summary.readyArrivals}
          pendingCount={summary.pendingArrivals}
        />
      </div>

      {/* Example usage of hexagon location selector */}
      <div className="mt-4">
        <h3 className="text-lg font-medium mb-2">Hexagon Location Example</h3>
        <div className="flex flex-col items-start gap-2">
          <div className="px-4 py-2 bg-secondary rounded-md w-full">
            {selectedHexLocation
              ? `Selected location: Column ${selectedHexLocation.col}, Row ${selectedHexLocation.row}`
              : "No location selected"}
          </div>

          <Button onClick={openHexSelector} className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
            Select Hexagon Location
          </Button>

          <HexagonLocationSelector
            availableLocations={dummyAvailableLocations}
            occupiedLocations={dummyOccupiedLocations}
            onSelect={handleHexSelect}
            initialSelectedLocation={selectedHexLocation}
            open={isHexSelectorOpen}
            onClose={closeHexSelector}
          />
        </div>
      </div>
    </div>
  );
}
