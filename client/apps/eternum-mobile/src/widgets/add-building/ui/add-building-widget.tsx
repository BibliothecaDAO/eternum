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
  ResourceIdToMiningType,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  BuildingType,
  BuildingTypeToString,
  findResourceById,
  getBuildingFromResource,
  isEconomyBuilding,
  ResourceMiningTypes,
} from "@bibliothecadao/types";
import { Warehouse, Wheat } from "lucide-react";
import { useState } from "react";
import { BuildingPreviewCard } from "./building-preview-card";

// Define building category enum
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

const BUILDING_IMAGES_PATH: Record<string, string> = {
  [BuildingType.ResourceLabor]: `/images/buildings/castleZero.png`,
  [BuildingType.ResourceAncientFragment]: "",
  [BuildingType.ResourceStone]: `/images/buildings/mine.png`,
  [BuildingType.ResourceCoal]: `/images/buildings/mine.png`,
  [BuildingType.ResourceWood]: `/images/buildings/lumber_mill.png`,
  [BuildingType.ResourceCopper]: `/images/buildings/forge.png`,
  [BuildingType.ResourceIronwood]: `/images/buildings/lumber_mill.png`,
  [BuildingType.ResourceObsidian]: `/images/buildings/mine.png`,
  [BuildingType.ResourceGold]: `/images/buildings/forge.png`,
  [BuildingType.ResourceSilver]: `/images/buildings/forge.png`,
  [BuildingType.ResourceMithral]: `/images/buildings/forge.png`,
  [BuildingType.ResourceAlchemicalSilver]: `/images/buildings/forge.png`,
  [BuildingType.ResourceColdIron]: `/images/buildings/forge.png`,
  [BuildingType.ResourceDeepCrystal]: `/images/buildings/mine.png`,
  [BuildingType.ResourceRuby]: `/images/buildings/mine.png`,
  [BuildingType.ResourceDiamonds]: `/images/buildings/mine.png`,
  [BuildingType.ResourceHartwood]: `/images/buildings/lumber_mill.png`,
  [BuildingType.ResourceIgnium]: `/images/buildings/forge.png`,
  [BuildingType.ResourceTwilightQuartz]: `/images/buildings/mine.png`,
  [BuildingType.ResourceTrueIce]: `/images/buildings/mine.png`,
  [BuildingType.ResourceAdamantine]: `/images/buildings/forge.png`,
  [BuildingType.ResourceSapphire]: `/images/buildings/mine.png`,
  [BuildingType.ResourceEtherealSilica]: `/images/buildings/mine.png`,
  [BuildingType.ResourceDragonhide]: `/images/buildings/dragonhide.png`,
  [BuildingType.ResourceWheat]: `/images/buildings/farm.png`,
  [BuildingType.ResourceFish]: `/images/buildings/fishing_village.png`,
  [BuildingType.ResourceKnightT1]: `/images/buildings/barracks.png`,
  [BuildingType.ResourceKnightT2]: `/images/buildings/barracks.png`,
  [BuildingType.ResourceKnightT3]: `/images/buildings/barracks.png`,
  [BuildingType.ResourcePaladinT1]: `/images/buildings/stable.png`,
  [BuildingType.ResourcePaladinT2]: `/images/buildings/stable.png`,
  [BuildingType.ResourcePaladinT3]: `/images/buildings/stable.png`,
  [BuildingType.ResourceDonkey]: `/images/buildings/market.png`,
  [BuildingType.ResourceCrossbowmanT1]: `/images/buildings/archery.png`,
  [BuildingType.ResourceCrossbowmanT2]: `/images/buildings/archery.png`,
  [BuildingType.ResourceCrossbowmanT3]: `/images/buildings/archery.png`,
  [BuildingType.WorkersHut]: `/images/buildings/workers_hut.png`,
  [BuildingType.Storehouse]: `/images/buildings/storehouse.png`,
  [ResourceMiningTypes.Forge]: `/images/buildings/forge.png`,
  [ResourceMiningTypes.Mine]: `/images/buildings/mine.png`,
  [ResourceMiningTypes.LumberMill]: `/images/buildings/lumber_mill.png`,
  [ResourceMiningTypes.Dragonhide]: `/images/buildings/dragonhide.png`,
};

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
    const buildings: Building[] = [];

    // Add resource buildings
    if (activeCategory === "all" || activeCategory === BuildingCategory.RESOURCE) {
      realm?.resources.forEach((resourceId) => {
        const resource = findResourceById(resourceId);
        if (!resource) return;

        const building = getBuildingFromResource(resourceId);
        const buildingCosts = getBuildingCosts(entityId, dojo.setup.components, building, useSimpleCost);

        if (!buildingCosts || buildingCosts.length === 0) return;

        const hasBalance = checkBalance(buildingCosts);
        const hasEnoughPopulation = hasEnoughPopulationForBuilding(
          realm,
          configManager.getBuildingCategoryConfig(building).population_cost,
        );

        // Make sure we have a boolean value
        const hasCapacity = realm?.hasCapacity || false;
        const canBuild = hasBalance && hasCapacity && hasEnoughPopulation;

        // Get image path from BUILDING_IMAGES_PATH using ResourceIdToMiningType
        const miningType = ResourceIdToMiningType[resourceId] || ResourceMiningTypes.Mine;
        const imagePath = BUILDING_IMAGES_PATH[miningType] || `/images/buildings/${resource.trait.toLowerCase()}.png`;

        buildings.push({
          id: resource.id.toString(),
          buildingId: building,
          resourceId: resourceId,
          name: resource.trait,
          image: imagePath,
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
          if (!buildingCosts || buildingCosts.length === 0) return;

          const hasBalance = checkBalance(buildingCosts);
          const hasEnoughPopulation = hasEnoughPopulationForBuilding(realm, building);

          // Make sure we have a boolean value
          const hasCapacity = realm?.hasCapacity || false;
          const canBuild =
            building === BuildingType.WorkersHut ? hasBalance : hasBalance && hasCapacity && hasEnoughPopulation;

          // Get image path from BUILDING_IMAGES_PATH
          const imagePath = BUILDING_IMAGES_PATH[building] || `/images/buildings/${buildingType.toLowerCase()}.png`;

          buildings.push({
            id: buildingType,
            buildingId: building,
            name: BuildingTypeToString[building],
            image: imagePath,
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
