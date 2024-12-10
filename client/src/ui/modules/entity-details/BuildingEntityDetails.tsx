import { TileManager } from "@/dojo/modelManager/TileManager";
import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities, useEntitiesUtils } from "@/hooks/helpers/useEntities";
import useUIStore from "@/hooks/store/useUIStore";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import { BUILDINGS_CENTER } from "@/three/scenes/constants";
import { ResourceMiningTypes } from "@/types";
import { BuildingInfo, ResourceInfo } from "@/ui/components/construction/SelectPreviewBuilding";
import Button from "@/ui/elements/Button";
import { getEntityIdFromKeys, ResourceIdToMiningType } from "@/ui/utils/utils";
import { BuildingType, ID, ResourcesIds, StructureType } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LeftView } from "../navigation/LeftNavigationModule";
import { RealmDetails } from "./realm/RealmDetails";

export const BuildingEntityDetails = () => {
  const dojo = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [buildingState, setBuildingState] = useState<{
    buildingType: BuildingType | undefined;
    resource: ResourcesIds | undefined;
    ownerEntityId: ID | undefined;
  }>({
    buildingType: undefined,
    resource: undefined,
    ownerEntityId: undefined,
  });
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isOwnedByPlayer, setIsOwnedByPlayer] = useState<boolean>(false);

  const { getEntityInfo } = useEntitiesUtils();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);

  const { play: playDestroyStone } = useUiSounds(soundSelector.destroyStone);
  const { play: playDestroyWooden } = useUiSounds(soundSelector.destroyWooden);

  const { playerStructures } = useEntities();

  const selectedStructureInfo = getEntityInfo(structureEntityId);

  const isCastleSelected = useMemo(
    () =>
      selectedBuildingHex.innerCol === BUILDINGS_CENTER[0] &&
      selectedBuildingHex.innerRow === BUILDINGS_CENTER[1] &&
      selectedStructureInfo?.structureCategory === StructureType[StructureType.Realm],
    [selectedBuildingHex.innerCol, selectedBuildingHex.innerRow],
  );

  const building = useComponentValue(
    dojo.setup.components.Building,
    getEntityIdFromKeys(Object.values(selectedBuildingHex).map((v) => BigInt(v))),
  );

  const structures = playerStructures();

  useEffect(() => {
    if (building) {
      setBuildingState({
        buildingType: BuildingType[building.category as keyof typeof BuildingType],
        resource: building.produced_resource_type as ResourcesIds,
        ownerEntityId: building.outer_entity_id,
      });
      setIsPaused(building.paused);
      setIsOwnedByPlayer(structures.some((structure) => structure.entity_id === building.outer_entity_id));
    } else {
      setBuildingState({
        buildingType: undefined,
        resource: undefined,
        ownerEntityId: undefined,
      });
      setIsOwnedByPlayer(false);
    }
  }, [selectedBuildingHex, building, dojo.account.account.address]);

  const handlePauseResumeProduction = useCallback(() => {
    setIsLoading(true);
    const tileManager = new TileManager(dojo.setup, {
      col: selectedBuildingHex.outerCol,
      row: selectedBuildingHex.outerRow,
    });
    const action = !isPaused ? tileManager.pauseProduction : tileManager.resumeProduction;
    action(selectedBuildingHex.innerCol, selectedBuildingHex.innerRow).then(() => {
      setIsLoading(false);
    });
  }, [selectedBuildingHex, isPaused]);

  const handleDestroyBuilding = useCallback(() => {
    const tileManager = new TileManager(dojo.setup, {
      col: selectedBuildingHex.outerCol,
      row: selectedBuildingHex.outerRow,
    });
    tileManager.destroyBuilding(selectedBuildingHex.innerCol, selectedBuildingHex.innerRow);
    if (
      buildingState.buildingType === BuildingType.Resource &&
      (ResourceIdToMiningType[buildingState.resource!] === ResourceMiningTypes.Forge ||
        ResourceIdToMiningType[buildingState.resource!] === ResourceMiningTypes.Mine)
    ) {
      playDestroyStone();
    } else {
      playDestroyWooden();
    }
    setLeftNavigationView(LeftView.None);
  }, [selectedBuildingHex, buildingState]);

  const canDestroyBuilding = useMemo(() => {
    if (buildingState.buildingType !== BuildingType.WorkersHut) return true;

    const realmId = getComponentValue(
      dojo.setup.components.EntityOwner,
      getEntityIdFromKeys([BigInt(structureEntityId)]),
    );

    const populationImpact = configManager.getBuildingPopConfig(buildingState.buildingType).capacity;

    const population = getComponentValue(
      dojo.setup.components.Population,
      getEntityIdFromKeys([BigInt(realmId?.entity_owner_id || 0)]),
    );
    return (population?.capacity || 0) - (population?.population || 0) >= populationImpact;
  }, [buildingState.buildingType, buildingState.ownerEntityId]);

  return (
    <div className="building-entity-details-selector flex flex-col h-full">
      {isCastleSelected ? (
        <div className="flex-grow w-full space-y-1 text-sm">
          <RealmDetails />
        </div>
      ) : (
        <>
          <div className="flex-grow w-full space-y-1 text-sm">
            {buildingState.buildingType === BuildingType.Resource && buildingState.resource && (
              <ResourceInfo
                isPaused={isPaused}
                resourceId={buildingState.resource}
                entityId={buildingState.ownerEntityId}
                hintModal
              />
            )}
            {buildingState.buildingType && buildingState.buildingType !== BuildingType.Resource && (
              <BuildingInfo
                isPaused={isPaused}
                buildingId={buildingState.buildingType}
                entityId={buildingState.ownerEntityId}
                hintModal
              />
            )}
          </div>
          {buildingState.buildingType && selectedBuildingHex && isOwnedByPlayer && (
            <div className="flex justify-center space-x-3">
              <Button
                className="mb-4"
                onClick={handlePauseResumeProduction}
                isLoading={isLoading}
                variant="outline"
                withoutSound
              >
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button
                disabled={!canDestroyBuilding}
                className="mb-4"
                onClick={handleDestroyBuilding}
                variant="danger"
                withoutSound
              >
                Destroy
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
