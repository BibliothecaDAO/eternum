import { useResourceArrivals } from "@/features/resource-arrivals";
import { generateHexPositions } from "@/shared/lib/utils";
import { useStore } from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { ArrivedDonkeys } from "@/widgets/arrived-donkeys";
import { HexagonLocationSelector, HexLocation } from "@/widgets/hexagon-location-selector";
import { NearbyEnemies } from "@/widgets/nearby-enemies";
import { ResourcesCard } from "@/widgets/resources-card";
import { UpgradeCastle } from "@/widgets/upgrade-castle";
import { TileManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { BUILDINGS_CENTER } from "@bibliothecadao/types";
import { useCallback, useMemo, useState } from "react";
import { ProductionWidgetsSection } from "../components/production-widgets-section";
import { useRealmTabs } from "../realm-page";

export function OverviewTab() {
  const { switchTab } = useRealmTabs();
  const structureEntityId = useStore((state) => state.structureEntityId);
  const selectedRealm = useStore((state) => state.selectedRealm);
  const { summary } = useResourceArrivals(structureEntityId);
  const {
    setup: { components, systemCalls },
  } = useDojo();

  // Create and manage tile manager instance
  const tileManager = useMemo(() => {
    if (!selectedRealm) return null;
    return new TileManager(components, systemCalls, {
      col: selectedRealm.position.x,
      row: selectedRealm.position.y,
    });
  }, [selectedRealm, components, systemCalls]);

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

  // Get available locations based on realm position
  const dummyAvailableLocations = selectedRealm
    ? generateHexPositions({ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] }, 1)
    : [];

  // Get occupied locations from existing buildings
  const occupiedLocations: HexLocation[] = useMemo(() => {
    if (!tileManager) return [];
    return tileManager.existingBuildings().map((building) => {
      console.log("Mapping building:", building);
      return {
        col: building.col,
        row: building.row,
      };
    });
  }, [tileManager, selectedRealm]);

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
    console.log("Opening hex selector with occupied locations:", occupiedLocations);
    console.log("Current buildings:", tileManager?.existingBuildings());
    setIsHexSelectorOpen(true);
  }, [occupiedLocations, tileManager]);

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
            occupiedLocations={occupiedLocations}
            onSelect={handleHexSelect}
            initialSelectedLocation={selectedHexLocation}
            open={isHexSelectorOpen}
            onClose={closeHexSelector}
            center={[BUILDINGS_CENTER[0], BUILDINGS_CENTER[1]]}
          />
        </div>
      </div>
    </div>
  );
}
