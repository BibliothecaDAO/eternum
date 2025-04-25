import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  configManager,
  divideByPrecision,
  getBalance,
  getBuildingCosts,
  getEntityIdFromKeys,
  getRealmInfo,
  hasEnoughPopulationForBuilding,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  BuildingType,
  BuildingTypeToString,
  findResourceById,
  getBuildingFromResource,
  isEconomyBuilding,
} from "@bibliothecadao/types";
import { Warehouse, Wheat } from "lucide-react";
import { useState } from "react";
import { BuildingPreviewCard } from "./building-preview-card";

// Define building category enum
enum BuildingCategory {
  RESOURCE = "resource",
  ECONOMIC = "economic",
}

export const AddBuildingWidget = ({ entityId }: { entityId: number }) => {
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const [activeCategory, setActiveCategory] = useState<BuildingCategory | "all">("all");
  const [useSimpleCost, setUseSimpleCost] = useState(false);

  const realm = getRealmInfo(getEntityIdFromKeys([BigInt(entityId)]), dojo.setup.components);

  const buildingTypes = Object.keys(BuildingType).filter(
    (key) =>
      isNaN(Number(key)) &&
      key !== "Resource" &&
      key !== "Castle" &&
      key !== "Bank" &&
      key !== "FragmentMine" &&
      key !== "None" &&
      key !== "Settlement" &&
      key !== "Hyperstructure",
  );

  const checkBalance = (cost: any) =>
    Object.keys(cost).every((resourceId) => {
      const resourceCost = cost[Number(resourceId)];
      const balance = getBalance(entityId, resourceCost.resource, currentDefaultTick, dojo.setup.components);
      return divideByPrecision(balance.balance) >= resourceCost.amount;
    });

  // Filter buildings based on the selected category
  const getFilteredBuildings = () => {
    const buildings = [];

    // Add resource buildings
    if (activeCategory === "all" || activeCategory === BuildingCategory.RESOURCE) {
      realm?.resources.forEach((resourceId) => {
        const resource = findResourceById(resourceId);
        if (!resource) return;

        const building = getBuildingFromResource(resourceId);
        const buildingCosts = getBuildingCosts(entityId, dojo.setup.components, building, useSimpleCost);

        if (!buildingCosts) return;

        const hasBalance = checkBalance(buildingCosts);
        const hasEnoughPopulation = hasEnoughPopulationForBuilding(
          realm,
          configManager.getBuildingCategoryConfig(building).population_cost,
        );

        const canBuild = hasBalance && realm?.hasCapacity && hasEnoughPopulation;

        buildings.push({
          id: resource.id.toString(),
          buildingId: building,
          resourceId: resourceId,
          name: resource.trait,
          image: `/images/resources/${resource.trait.toLowerCase()}.png`,
          category: BuildingCategory.RESOURCE,
          canBuild,
          hasBalance,
          hasEnoughPopulation,
        });
      });
    }

    // Add economic buildings
    if (activeCategory === "all" || activeCategory === BuildingCategory.ECONOMIC) {
      buildingTypes
        .filter((a) => isEconomyBuilding(BuildingType[a as keyof typeof BuildingType]))
        .sort((a, b) => {
          const buildingA = BuildingType[a as keyof typeof BuildingType];
          const buildingB = BuildingType[b as keyof typeof BuildingType];

          if (buildingA === BuildingType.ResourceWheat) return -1;
          if (buildingB === BuildingType.ResourceWheat) return 1;
          if (buildingA === BuildingType.ResourceFish) return -1;
          if (buildingB === BuildingType.ResourceFish) return 1;
          return 0;
        })
        .forEach((buildingType) => {
          const building = BuildingType[buildingType as keyof typeof BuildingType];
          const buildingCosts = getBuildingCosts(entityId, dojo.setup.components, building, useSimpleCost);

          if (!buildingCosts) return;

          const hasBalance = checkBalance(buildingCosts);
          const hasEnoughPopulation = hasEnoughPopulationForBuilding(realm, building);
          const canBuild =
            building === BuildingType.WorkersHut ? hasBalance : hasBalance && realm?.hasCapacity && hasEnoughPopulation;

          buildings.push({
            id: buildingType,
            buildingId: building,
            name: BuildingTypeToString[building],
            image: `/images/buildings/${buildingType.toLowerCase()}.png`,
            category: BuildingCategory.ECONOMIC,
            canBuild,
            hasBalance,
            hasEnoughPopulation,
          });
        });
    }

    return buildings;
  };

  const filteredBuildings = getFilteredBuildings();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Add Building</h2>

        {/* Simple/Standard cost toggle */}
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center cursor-pointer">
            <span className={`mr-2 text-xs ${useSimpleCost ? "text-white/50" : ""}`}>Standard</span>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={useSimpleCost}
                onChange={() => setUseSimpleCost(!useSimpleCost)}
              />
              <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-white/30"></div>
            </div>
            <span className={`ml-2 text-xs ${useSimpleCost ? "" : "text-white/50"}`}>Simple</span>
          </label>
        </div>
      </div>

      <Tabs defaultValue="all" onValueChange={(value) => setActiveCategory(value as BuildingCategory | "all")}>
        <TabsList className="grid grid-cols-3 bg-white/5">
          <TabsTrigger value="all" className="data-[state=active]:bg-white/10">
            All
          </TabsTrigger>
          <TabsTrigger value={BuildingCategory.RESOURCE} className="data-[state=active]:bg-white/10">
            <Wheat className="h-4 w-4 mr-1.5" />
            Resources
          </TabsTrigger>
          <TabsTrigger value={BuildingCategory.ECONOMIC} className="data-[state=active]:bg-white/10">
            <Warehouse className="h-4 w-4 mr-1.5" />
            Economic
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="space-y-3">
            {filteredBuildings.map((building) => (
              <BuildingPreviewCard
                key={building.id}
                building={building}
                entityId={entityId}
                useSimpleCost={useSimpleCost}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value={BuildingCategory.RESOURCE} className="mt-4">
          <div className="space-y-3">
            {filteredBuildings.map((building) => (
              <BuildingPreviewCard
                key={building.id}
                building={building}
                entityId={entityId}
                useSimpleCost={useSimpleCost}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value={BuildingCategory.ECONOMIC} className="mt-4">
          <div className="space-y-3">
            {filteredBuildings.map((building) => (
              <BuildingPreviewCard
                key={building.id}
                building={building}
                entityId={entityId}
                useSimpleCost={useSimpleCost}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
