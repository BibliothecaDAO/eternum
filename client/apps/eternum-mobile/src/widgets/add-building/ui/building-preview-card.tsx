import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ResourceAmount } from "@/shared/ui/resource-amount";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { AlertTriangle, Home, Plus, Shield, Warehouse, X } from "lucide-react";
import { useState } from "react";
import { BuildingDetailsDrawer } from "./building-details-drawer";

// Building category enum
enum BuildingCategory {
  RESOURCE = "resource",
  ECONOMIC = "economic",
  MILITARY = "military",
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
  militaryType?: string;
  tier?: number;
  missingResources?: Array<{
    resourceId: number;
    needed: number;
    available: number;
    missing: number;
  }>;
}

interface BuildingPreviewCardProps {
  building: Building;
  entityId: number;
  useSimpleCost: boolean;
}

export const BuildingPreviewCard = ({ building, entityId, useSimpleCost }: BuildingPreviewCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showMissingResources, setShowMissingResources] = useState(false);

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
      case BuildingCategory.MILITARY:
        return <Shield className="h-4 w-4 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <>
      <Card
        className={`w-full transition-all duration-200 hover:bg-white/5 ${!building.canBuild ? "opacity-60" : ""} ${!building.hasBalance && building.missingResources && building.missingResources.length > 0 ? "cursor-pointer" : ""}`}
        onClick={() => {
          if (!building.hasBalance && building.missingResources && building.missingResources.length > 0) {
            setShowMissingResources(!showMissingResources);
          }
        }}
      >
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
                  ? building.missingResources && building.missingResources.length > 0
                    ? "Click to see missing resources"
                    : "Not enough resources"
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
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Missing Resources Section */}
          {showMissingResources && building.missingResources && building.missingResources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white">Missing Resources:</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMissingResources(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {building.missingResources.map((resource, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <ResourceAmount
                      resourceId={resource.resourceId}
                      amount={resource.missing}
                      size="sm"
                      className="text-red-400"
                    />
                    <span className="text-white/50">
                      {resource.available} / {resource.needed}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
