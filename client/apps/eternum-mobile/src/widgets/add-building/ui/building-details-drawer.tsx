import { currencyIntlFormat } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { ResourceAmount } from "@/shared/ui/resource-amount";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { Clock, Users, Warehouse } from "lucide-react";

// Using the building category enum
enum BuildingCategory {
  RESOURCE = "resource",
  POPULATION = "population",
  STORAGE = "storage",
}

// Resource production interface
interface ResourceProduction {
  resourceId: string;
  rate: number; // per second
}

// Resource cost interface
interface ResourceCost {
  resourceId: string;
  amount: number;
}

// Building interface
interface Building {
  id: string;
  name: string;
  image: string;
  category: BuildingCategory;
  description: string;
  produces?: ResourceProduction;
  populationGrant?: number;
  storageCapacity?: number;
  populationCost: number;
  consumesResources?: ResourceProduction[];
  buildCosts: ResourceCost[];
}

interface BuildingDetailsDrawerProps {
  building: Building;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BuildingDetailsDrawer = ({ building, open, onOpenChange }: BuildingDetailsDrawerProps) => {
  const handleAddBuilding = () => {
    // Handle adding building logic here
    console.log("Adding building:", building);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-md overflow-hidden">
              <img src={building.image} alt={building.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-bold">{building.name}</DrawerTitle>
              <p className="text-sm text-white/70">{building.description}</p>
            </div>
          </div>
        </DrawerHeader>

        <div className="px-4 pb-1 space-y-5 overflow-y-auto">
          {/* Production section - only for resource buildings */}
          {building.category === BuildingCategory.RESOURCE && building.produces && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white/80">Production</h4>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <ResourceIcon resourceId={building.produces.resourceId} size={32} />
                <div className="flex-1">
                  <div className="flex items-baseline gap-1">
                    <span className="font-medium">Produces</span>
                    <span className="text-sm text-emerald-400">
                      {currencyIntlFormat(building.produces.rate * 3600)} / hour
                    </span>
                  </div>
                  <div className="text-xs text-white/60">{currencyIntlFormat(building.produces.rate)} per second</div>
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
                <div className="flex items-baseline gap-1">
                  <span className="font-medium">Required</span>
                  <span className="text-sm text-white/90">{building.populationCost} workers</span>
                </div>

                {building.category === BuildingCategory.POPULATION && building.populationGrant && (
                  <div className="text-xs text-emerald-400 mt-1">
                    Provides housing for {building.populationGrant} workers
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Storage capacity - only for storage buildings */}
          {building.category === BuildingCategory.STORAGE && building.storageCapacity && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white/80">Storage</h4>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <Warehouse className="h-6 w-6 text-amber-400" />
                <div className="flex-1">
                  <div className="flex items-baseline gap-1">
                    <span className="font-medium">Capacity</span>
                    <span className="text-sm text-white/90">+{building.storageCapacity} resources</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resource consumption - if any */}
          {building.consumesResources && building.consumesResources.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white/80">Resource Consumption</h4>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <Clock className="h-6 w-6 text-red-400" />
                <div className="flex-1">
                  <div className="font-medium">Consumes per second</div>
                  <div className="mt-2 space-y-1.5">
                    {building.consumesResources.map((resource) => (
                      <div key={resource.resourceId} className="flex items-center gap-2">
                        <ResourceIcon resourceId={resource.resourceId} size={20} />
                        <span className="text-xs text-red-400">{currencyIntlFormat(resource.rate)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Building costs */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white/80">Building Cost</h4>
            <div className="grid grid-cols-2 gap-2">
              {building.buildCosts.map((cost) => (
                <ResourceAmount key={cost.resourceId} resourceId={cost.resourceId} amount={cost.amount} />
              ))}
            </div>
          </div>
        </div>

        <DrawerFooter className="pt-2">
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleAddBuilding} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              Add Building
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
