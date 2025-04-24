import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Home, Plus, Warehouse, Wheat } from "lucide-react";
import { useState } from "react";
import { BuildingDetailsDrawer } from "./building-details-drawer";

// Using the building category enum from add-building-widget.tsx
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

interface BuildingPreviewCardProps {
  building: Building;
}

export const BuildingPreviewCard = ({ building }: BuildingPreviewCardProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const getBuildingIcon = () => {
    switch (building.category) {
      case BuildingCategory.RESOURCE:
        return <Wheat className="h-4 w-4 text-amber-400" />;
      case BuildingCategory.STORAGE:
        return <Warehouse className="h-4 w-4 text-blue-400" />;
      case BuildingCategory.POPULATION:
        return <Home className="h-4 w-4 text-green-400" />;
      default:
        return null;
    }
  };

  return (
    <>
      <Card className="w-full transition-all duration-200 hover:bg-white/5 cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md overflow-hidden">
              <img src={building.image} alt={building.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                {getBuildingIcon()}
                <h3 className="font-semibold text-white">{building.name}</h3>
              </div>
              <p className="text-xs text-white/70 mt-0.5 line-clamp-1">{building.description}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setIsOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <BuildingDetailsDrawer building={building} open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
};
