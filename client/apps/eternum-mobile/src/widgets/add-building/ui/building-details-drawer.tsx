import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import { currencyIntlFormat } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { configManager, divideByPrecision, getBalance, getBuildingCosts, getConsumedBy } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { BuildingType, CapacityConfig, findResourceById } from "@bibliothecadao/types";
import { Clock, Users, Warehouse } from "lucide-react";
import React, { useMemo } from "react";

// Building category enum
enum BuildingCategory {
  RESOURCE = "resource",
  ECONOMIC = "economic",
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

  const handleAddBuilding = () => {
    // Handle adding building logic here
    console.log("Adding building:", building);
    onOpenChange(false);
  };

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
            <div className="w-16 h-16 rounded-md overflow-hidden bg-white/10 flex items-center justify-center">
              <img src={building.image} alt={building.name} className="w-full h-full object-cover" />
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
              <Users className="h-6 w-6 text-blue-400" />
              <div className="flex-1">
                {population !== 0 && (
                  <div className="flex items-baseline gap-1">
                    <span className="font-medium">Required</span>
                    <span className="text-sm text-white/90">{population} slots</span>
                  </div>
                )}

                {capacity !== 0 && <div className="text-xs text-emerald-400 mt-1">+{capacity} max population</div>}
              </div>
            </div>
          </div>

          {/* Storage capacity - only for storage buildings */}
          {extraStorehouseCapacityKg !== 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white/80">Storage</h4>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <Warehouse className="h-6 w-6 text-amber-400" />
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
                <Clock className="h-6 w-6 text-red-400" />
                <div className="flex-1">
                  <div className="font-medium">Consumes per second</div>
                  <div className="mt-2 flex gap-3 items-center">
                    {ongoingCost.map((costItem, index) => {
                      if (!costItem || costItem.resource === undefined) return null;
                      const balance = getBalance(
                        entityId,
                        costItem.resource,
                        currentDefaultTick,
                        dojo.setup.components,
                      );
                      return (
                        <div key={`ongoing-cost-${index}`} className="flex items-center gap-0.5">
                          <ResourceIcon resourceId={costItem.resource} size={24} />
                          <span className="text-xs text-red-400">
                            {currencyIntlFormat(divideByPrecision(costItem.amount))}
                          </span>
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
        </div>

        <DrawerFooter className="pt-2">
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleAddBuilding}
              disabled={!building.canBuild}
              className={`flex-1 ${building.canBuild ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-600/30"}`}
            >
              Add Building
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
