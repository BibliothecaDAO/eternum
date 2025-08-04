import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import { currencyIntlFormat, generateHexPositions } from "@/shared/lib/utils";
import { useStore } from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { HexagonLocationSelector, HexLocation } from "@/widgets/hexagon-location-selector";
import {
  configManager,
  divideByPrecision,
  getBalance,
  getBuildingCosts,
  getConsumedBy,
  TileManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  BUILDINGS_CENTER,
  BuildingType,
  BuildingTypeToString,
  CapacityConfig,
  findResourceById,
} from "@bibliothecadao/types";
import { Clock, Loader2, Users, Warehouse } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";

// Building category enum
enum BuildingCategory {
  RESOURCE = "resource",
  ECONOMIC = "economic",
  MILITARY = "military",
}

// Building interface
interface Building {
  id: string;
  buildingId: BuildingType;
  resourceId?: number;
  name: string;
  image: string;
  category: BuildingCategory;
  canBuild: boolean;
  hasBalance: boolean;
  hasEnoughPopulation: boolean;
  militaryType?: string;
  tier?: number;
}

interface BuildingDetailsDrawerProps {
  building: Building;
  entityId: number;
  useSimpleCost: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BuildingDetailsDrawer = ({
  building,
  entityId,
  useSimpleCost,
  open,
  onOpenChange,
}: BuildingDetailsDrawerProps) => {
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const selectedRealm = useStore((state) => state.selectedRealm);
  const [selectedLocation, setSelectedLocation] = useState<HexLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHexSelectorOpen, setIsHexSelectorOpen] = useState(false);

  // Create and manage tile manager instance
  const tileManager = useMemo(() => {
    if (!selectedRealm) return null;
    return new TileManager(dojo.setup.components, dojo.setup.systemCalls, {
      col: selectedRealm.position.x,
      row: selectedRealm.position.y,
    });
  }, [selectedRealm, dojo.setup.components, dojo.setup.systemCalls]);

  // Get available locations based on realm position
  const availableLocations = useMemo(() => {
    return generateHexPositions(
      { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] },
      (tileManager?.getRealmLevel(entityId) as number) + 1 || 1,
    );
  }, []);

  // Get occupied locations from existing buildings
  const occupiedLocations: HexLocation[] = useMemo(() => {
    if (!tileManager) return [];
    return tileManager.existingBuildings().map((building) => ({
      col: building.col,
      row: building.row,
      title: findResourceById(building.resource ?? 0)?.trait ?? BuildingTypeToString[building.category as BuildingType],
    }));
  }, [tileManager]);

  const handleAddBuilding = async () => {
    if (!selectedLocation) {
      setError("Please select a location for the building");
      return;
    }

    if (!tileManager) {
      setError("Invalid realm position");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await tileManager.placeBuilding(
        dojo.account.account,
        entityId,
        building.buildingId,
        { col: selectedLocation.col, row: selectedLocation.row },
        useSimpleCost,
      );

      onOpenChange(false);
    } catch (err) {
      console.error("Error placing building:", err);
      setError("Failed to place building. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleHexSelect = useCallback((col: number, row: number) => {
    setSelectedLocation({ col, row });
    setIsHexSelectorOpen(false);
  }, []);

  // Get the produced resource for this building
  const resourceProduced = building.resourceId || configManager.getResourceBuildingProduced(building.buildingId);
  const resourceProducedName = resourceProduced ? findResourceById(resourceProduced)?.trait : undefined;

  // Get building costs
  const buildingCost = getBuildingCosts(entityId, dojo.setup.components, building.buildingId, useSimpleCost) || [];

  // Get population and capacity information
  const buildingPopCapacityConfig = configManager.getBuildingCategoryConfig(building.buildingId);
  const population = buildingPopCapacityConfig.population_cost;
  const capacity = buildingPopCapacityConfig.capacity_grant;

  // Get storehouse capacity if applicable
  const extraStorehouseCapacityKg =
    building.buildingId === BuildingType.Storehouse ? configManager.getCapacityConfigKg(CapacityConfig.Storehouse) : 0;

  // Get ongoing resource costs
  let ongoingCost: any[] = [];
  if (resourceProduced !== undefined) {
    const costs = useSimpleCost
      ? configManager.simpleSystemResourceInputs[resourceProduced]
      : configManager.complexSystemResourceInputs[resourceProduced];
    if (costs) {
      ongoingCost = Object.values(costs);
    }
  }

  // Get production rate per tick
  const perTick =
    resourceProduced !== undefined ? divideByPrecision(configManager.getResourceOutputs(resourceProduced)) || 0 : 0;

  // Get resources that consume this resource
  const usedIn = useMemo(() => {
    return getConsumedBy(resourceProduced || 0);
  }, [resourceProduced]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-16 h-16 overflow-hidden rounded-md bg-white/10">
              <img src={building.image} alt={building.name} className="object-cover w-full h-full" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-bold">{building.name}</DrawerTitle>
              <p className="text-sm text-white/70">
                {building.category === BuildingCategory.RESOURCE ? "Resource Building" : "Economic Building"}
              </p>
            </div>
          </div>
        </DrawerHeader>

        <div className="px-4 pb-1 space-y-5 overflow-y-auto">
          {/* Location Selection */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white/80">Location</h4>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="font-medium">Selected Location</span>
                  <span className="text-sm text-white/90">
                    {selectedLocation
                      ? `Column ${selectedLocation.col}, Row ${selectedLocation.row}`
                      : "No location selected"}
                  </span>
                </div>
                <Button onClick={() => setIsHexSelectorOpen(true)} className="mt-2" variant="outline" size="sm">
                  Select Location
                </Button>
              </div>
            </div>
          </div>

          {/* Production section - for resource buildings */}
          {resourceProducedName && perTick !== 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white/80">Production</h4>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                {resourceProduced !== undefined && <ResourceIcon resourceId={resourceProduced} size={32} />}
                <div className="flex-1">
                  <div className="flex items-baseline gap-1">
                    <span className="font-medium">Produces</span>
                    <span className="text-sm text-emerald-400">{currencyIntlFormat(perTick * 3600)} / hour</span>
                  </div>
                  <div className="text-xs text-white/60">{currencyIntlFormat(perTick)} per second</div>
                </div>
              </div>
            </div>
          )}

          {/* Population section */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white/80">Population</h4>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
              <Users className="w-6 h-6 text-blue-400" />
              <div className="flex-1">
                {population !== 0 && (
                  <div className="flex items-baseline gap-1">
                    <span className="font-medium">Required</span>
                    <span className="text-sm text-white/90">{population} slots</span>
                  </div>
                )}

                {capacity !== 0 && <div className="mt-1 text-xs text-emerald-400">+{capacity} max population</div>}
              </div>
            </div>
          </div>

          {/* Storage capacity - only for storage buildings */}
          {extraStorehouseCapacityKg !== 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white/80">Storage</h4>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <Warehouse className="w-6 h-6 text-amber-400" />
                <div className="flex-1">
                  <div className="flex items-baseline gap-1">
                    <span className="font-medium">Capacity</span>
                    <span className="text-sm text-emerald-400 ">+{extraStorehouseCapacityKg.toLocaleString()} kg</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resource consumption - if any */}
          {Array.isArray(ongoingCost) && ongoingCost.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white/80">Resource Consumption</h4>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <Clock className="w-6 h-6 text-red-400" />
                <div className="flex-1">
                  <div className="font-medium">Consumes per second</div>
                  <div className="flex items-center gap-3 mt-2">
                    {ongoingCost.map((costItem, index) => {
                      if (!costItem || costItem.resource === undefined) return null;
                      return (
                        <div key={`ongoing-cost-${index}`} className="flex items-center gap-0.5">
                          <ResourceIcon resourceId={costItem.resource} size={24} />
                          <span className="text-xs text-red-400">{currencyIntlFormat(costItem.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resources that consume this resource */}
          {usedIn.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white/80">Consumed By</h4>
              <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-white/5">
                {React.Children.toArray(
                  usedIn.map(
                    (resourceId) =>
                      resourceId !== undefined && (
                        <div className="flex items-center gap-1">
                          <ResourceIcon resourceId={resourceId} size={20} />
                          <span className="text-xs">{findResourceById(resourceId)?.trait}</span>
                        </div>
                      ),
                  ),
                )}
              </div>
            </div>
          )}

          {/* Building costs */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white/80">Building Cost</h4>
            <div className="grid grid-cols-2 gap-2">
              {buildingCost.map((cost, index) => {
                const balance = getBalance(entityId, cost.resource, currentDefaultTick, dojo.setup.components);
                const hasEnough = divideByPrecision(balance.balance) >= cost.amount;

                return (
                  <div
                    key={`cost-${index}`}
                    className={`p-2 rounded-md bg-white/5 ${!hasEnough ? "border border-red-500/50" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <ResourceIcon resourceId={cost.resource} size={24} />
                      <div className="flex-1">
                        <div className="text-xs">{findResourceById(cost.resource)?.trait}</div>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-sm font-medium ${!hasEnough ? "text-red-400" : ""}`}>
                            {currencyIntlFormat(cost.amount)}
                          </span>
                          <span className="text-xs text-white/50">
                            / {currencyIntlFormat(divideByPrecision(balance.balance))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && <div className="p-3 text-sm text-red-400 rounded-lg bg-red-500/10">{error}</div>}
        </div>

        <DrawerFooter className="pt-2">
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleAddBuilding}
              disabled={!building.canBuild || !selectedLocation || isLoading || !tileManager}
              className={`flex-1 ${building.canBuild ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-600/30"}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Placing Building...
                </>
              ) : (
                "Add Building"
              )}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>

      <HexagonLocationSelector
        availableLocations={availableLocations}
        occupiedLocations={occupiedLocations}
        onSelect={handleHexSelect}
        initialSelectedLocation={selectedLocation}
        open={isHexSelectorOpen}
        onClose={() => setIsHexSelectorOpen(false)}
        center={[BUILDINGS_CENTER[0], BUILDINGS_CENTER[1]]}
        showCoordinates={false}
      />
    </Drawer>
  );
};
