import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { AlertTriangle, Home, Plus, Warehouse } from "lucide-react";
import { useState } from "react";
import { BuildingDetailsDrawer } from "./building-details-drawer";

// Building category enum
enum BuildingCategory {
  RESOURCE = "resource",
  ECONOMIC = "economic",
}

// Building interface with new structure
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

interface BuildingPreviewCardProps {
  building: Building;
  entityId: number;
  useSimpleCost: boolean;
}

export const BuildingPreviewCard = ({ building, entityId, useSimpleCost }: BuildingPreviewCardProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const getBuildingIcon = () => {
    if (building.resourceId) {
      return <ResourceIcon resourceId={building.resourceId} />;
    }
    switch (building.category) {
      case BuildingCategory.ECONOMIC:
        if (building.buildingId === BuildingType.ResourceWheat) {
          return <ResourceIcon resourceId={ResourcesIds.Wheat} />;
        }
        if (building.buildingId === BuildingType.ResourceFish) {
          return <ResourceIcon resourceId={ResourcesIds.Fish} />;
        }
        if (building.buildingId === BuildingType.ResourceDonkey) {
          return <ResourceIcon resourceId={ResourcesIds.Donkey} />;
        }
        return building.buildingId === BuildingType.WorkersHut ? (
          <Home className="h-4 w-4 text-green-400" />
        ) : (
          <Warehouse className="h-4 w-4 text-blue-400" />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Card className={`w-full transition-all duration-200 hover:bg-white/5 ${!building.canBuild ? "opacity-60" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md overflow-hidden flex items-center justify-center">
              {building.hasBalance && building.hasEnoughPopulation ? (
                <img src={building.image} alt={building.name} className="w-full h-full object-cover" />
              ) : (
                <div className="relative w-full h-full">
                  <img src={building.image} alt={building.name} className="w-full h-full object-cover opacity-40" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {!building.hasBalance && <AlertTriangle className="h-6 w-6 text-amber-500" />}
                    {!building.hasEnoughPopulation && building.hasBalance && <Home className="h-6 w-6 text-red-500" />}
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                {getBuildingIcon()}
                <h3 className="font-semibold text-white">{building.name}</h3>
              </div>
              <p className="text-xs text-white/70 mt-0.5 line-clamp-1">
                {!building.hasBalance
                  ? "Not enough resources"
                  : !building.hasEnoughPopulation
                    ? "Not enough population"
                    : building.category === BuildingCategory.RESOURCE
                      ? "Resource production"
                      : building.buildingId === BuildingType.WorkersHut
                        ? "Provides housing"
                        : "Economic building"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={!building.canBuild}
              onClick={() => setIsOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <BuildingDetailsDrawer
        building={building}
        entityId={entityId}
        useSimpleCost={useSimpleCost}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
};
