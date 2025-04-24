import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import { ProductionWidget } from "@/widgets/production-widget";
import { LaborBuilding } from "@/widgets/production-widget/model/types";
import { Building, getProducedResource, RealmInfo } from "@bibliothecadao/types";
import { useBuildings, useResourceManager } from "@bibliothecadao/react";
import { useMemo } from "react";

interface ProductionWidgetsSectionProps {
  selectedRealm: RealmInfo;
  isVertical?: boolean;
}

export function ProductionWidgetsSection({ selectedRealm, isVertical = false }: ProductionWidgetsSectionProps) {
  const buildings: Building[] = useBuildings(selectedRealm.position.x, selectedRealm.position.y);
  const resourceManager = useResourceManager(selectedRealm.entityId);
  const { currentBlockTimestamp } = getBlockTimestamp();

  // Memoize production buildings list
  const productionBuildings = useMemo(() => {
    return buildings.filter((building) => {
      const producedResource = getProducedResource(building.category);
      return producedResource !== undefined;
    });
  }, [buildings]);

  // Memoize buildings with production data
  const buildingsWithProduction = useMemo(() => {
    return productionBuildings
      .map((building) => {
        const producedResource = getProducedResource(building.category);
        if (!producedResource) return null;

        const isActive = resourceManager.isActive(producedResource);
        const timeLeft = resourceManager.timeUntilValueReached(currentBlockTimestamp, producedResource);

        const laborBuilding: LaborBuilding = {
          ...building,
          isActive,
          productionTimeLeft: timeLeft * 60, // Convert to seconds
        };

        return laborBuilding;
      })
      .filter((building): building is LaborBuilding => building !== null);
  }, [productionBuildings, resourceManager, currentBlockTimestamp]);

  return (
    <div className="overflow-x-auto">
      <div
        className={`grid ${
          isVertical ? "grid-cols-1 gap-4" : "grid-flow-col auto-cols-[80%] sm:auto-cols-[45%] gap-4 pb-4"
        }`}
      >
        {buildingsWithProduction.map((building) => (
          <ProductionWidget
            key={`${building.innerCol}-${building.innerRow}`}
            building={building}
            resourceManager={resourceManager}
            realm={selectedRealm}
          />
        ))}
      </div>
    </div>
  );
}
