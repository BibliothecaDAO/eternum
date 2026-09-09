import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useBuildings } from "@bibliothecadao/react";
import { getProducedResource, RealmInfo as RealmInfoType, ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";
import { ProductionWorkflows } from "./production-workflows";

export const ProductionBody = ({
  realm,
  selectedResource,
  onSelectResource,
}: {
  realm: RealmInfoType;
  selectedResource: ResourcesIds | null;
  onSelectResource: (resource: ResourcesIds | null) => void;
}) => {
  const mode = useGameModeConfig();
  const buildings = useBuildings(realm.position.x, realm.position.y);
  const productionBuildings = buildings.filter((building) => building && getProducedResource(building.category));
  const producedResources = useMemo(
    () =>
      Array.from(
        new Set(
          productionBuildings
            .filter((building) => building.produced && building.produced.resource)
            .map((building) => building.produced.resource as ResourcesIds),
        ),
      ),
    [productionBuildings],
  );

  const realmDisplayName = useMemo(() => {
    return mode.structure.getName(realm.structure).name;
  }, [mode.structure, realm.structure]);

  return (
    <ProductionWorkflows
      realm={realm}
      realmDisplayName={realmDisplayName}
      producedResources={producedResources}
      productionBuildings={productionBuildings}
      selectedResource={selectedResource}
      onSelectResource={onSelectResource}
      realmEntityId={realm.entityId.toString()}
    />
  );
};
