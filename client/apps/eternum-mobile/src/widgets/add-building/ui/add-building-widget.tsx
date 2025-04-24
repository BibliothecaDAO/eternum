import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Home, Warehouse, Wheat } from "lucide-react";
import { useState } from "react";
import { BuildingPreviewCard } from "./building-preview-card";

// Define building category enum
enum BuildingCategory {
  RESOURCE = "resource",
  POPULATION = "population",
  STORAGE = "storage",
}

// Define resource cost interface
interface ResourceCost {
  resourceId: string;
  amount: number;
}

// Define resource production interface
interface ResourceProduction {
  resourceId: string;
  rate: number; // per second
}

// Define building interface
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

// Mock data for buildings
const mockBuildings: Building[] = [
  {
    id: "farm",
    name: "Farm",
    image: "/images/buildings/farm.png",
    category: BuildingCategory.RESOURCE,
    description: "Produces food to feed your population",
    produces: {
      resourceId: "food",
      rate: 0.05,
    },
    populationCost: 5,
    consumesResources: [
      {
        resourceId: "water",
        rate: 0.01,
      },
    ],
    buildCosts: [
      {
        resourceId: "wood",
        amount: 100,
      },
      {
        resourceId: "stone",
        amount: 50,
      },
    ],
  },
  {
    id: "storehouse",
    name: "Storehouse",
    image: "/images/buildings/storehouse.png",
    category: BuildingCategory.STORAGE,
    description: "Increases your resource storage capacity",
    storageCapacity: 1000,
    populationCost: 2,
    buildCosts: [
      {
        resourceId: "wood",
        amount: 150,
      },
      {
        resourceId: "stone",
        amount: 75,
      },
    ],
  },
  {
    id: "workers-hut",
    name: "Workers Hut",
    image: "/images/buildings/workers-hut.png",
    category: BuildingCategory.POPULATION,
    description: "Provides housing for your workers",
    populationGrant: 10,
    populationCost: 0,
    buildCosts: [
      {
        resourceId: "wood",
        amount: 200,
      },
      {
        resourceId: "stone",
        amount: 100,
      },
      {
        resourceId: "food",
        amount: 50,
      },
    ],
  },
];

export const AddBuildingWidget = () => {
  const [activeCategory, setActiveCategory] = useState<BuildingCategory | "all">("all");

  const filteredBuildings =
    activeCategory === "all" ? mockBuildings : mockBuildings.filter((building) => building.category === activeCategory);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Add Building</h2>

      <Tabs defaultValue="all" onValueChange={(value) => setActiveCategory(value as BuildingCategory | "all")}>
        <TabsList className="grid grid-cols-4 bg-white/5">
          <TabsTrigger value="all" className="data-[state=active]:bg-white/10">
            All
          </TabsTrigger>
          <TabsTrigger value={BuildingCategory.RESOURCE} className="data-[state=active]:bg-white/10">
            <Wheat className="h-4 w-4 mr-1.5" />
            Resource
          </TabsTrigger>
          <TabsTrigger value={BuildingCategory.STORAGE} className="data-[state=active]:bg-white/10">
            <Warehouse className="h-4 w-4 mr-1.5" />
            Storage
          </TabsTrigger>
          <TabsTrigger value={BuildingCategory.POPULATION} className="data-[state=active]:bg-white/10">
            <Home className="h-4 w-4 mr-1.5" />
            Housing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="space-y-3">
            {filteredBuildings.map((building) => (
              <BuildingPreviewCard key={building.id} building={building} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value={BuildingCategory.RESOURCE} className="mt-4">
          <div className="space-y-3">
            {filteredBuildings.map((building) => (
              <BuildingPreviewCard key={building.id} building={building} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value={BuildingCategory.STORAGE} className="mt-4">
          <div className="space-y-3">
            {filteredBuildings.map((building) => (
              <BuildingPreviewCard key={building.id} building={building} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value={BuildingCategory.POPULATION} className="mt-4">
          <div className="space-y-3">
            {filteredBuildings.map((building) => (
              <BuildingPreviewCard key={building.id} building={building} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
