import { BuildingInfo, ResourceInfo } from "@/ui/components/construction/select-preview-building";
import Button from "@/ui/elements/button";
import { RealmDetails } from "@/ui/modules/entity-details/realm/realm-details";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  BUILDINGS_CENTER,
  BuildingType,
  ContractAddress,
  ID,
  ResourceIdToMiningType,
  ResourceMiningTypes,
  ResourcesIds,
  StructureType,
  TileManager,
  configManager,
  getEntityInfo,
} from "@bibliothecadao/eternum";
import { LeftView, soundSelector, useDojo, usePlayerStructures, useUIStore, useUiSounds } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { useCallback, useEffect, useMemo, useState } from "react";

export const BuildingEntityDetails = () => {
  const dojo = useDojo();
  const currentDefaultTick = useUIStore.getState().currentDefaultTick;

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
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);

  const { play: playDestroyStone } = useUiSounds(soundSelector.destroyStone);
  const { play: playDestroyWooden } = useUiSounds(soundSelector.destroyWooden);

  const playerStructures = usePlayerStructures();

  const selectedStructureInfo = getEntityInfo(
    structureEntityId,
    ContractAddress(dojo.account.account.address),
    currentDefaultTick,
    dojo.setup.components,
  );

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

  useEffect(() => {
    if (building) {
      setBuildingState({
        buildingType: BuildingType[building.category as keyof typeof BuildingType],
        resource: building.produced_resource_type as ResourcesIds,
        ownerEntityId: building.outer_entity_id,
      });
      setIsPaused(building.paused);
      setIsOwnedByPlayer(playerStructures.some((structure) => structure.entity_id === building.outer_entity_id));
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
    const tileManager = new TileManager(dojo.setup.components, dojo.network.provider, {
      col: selectedBuildingHex.outerCol,
      row: selectedBuildingHex.outerRow,
    });
    const action = !isPaused ? tileManager.pauseProduction : tileManager.resumeProduction;
    action(dojo.account.account, selectedBuildingHex.innerCol, selectedBuildingHex.innerRow).then(() => {
      setIsLoading(false);
    });
  }, [selectedBuildingHex, isPaused]);

  const handleDestroyBuilding = useCallback(() => {
    if (!showDestroyConfirm) {
      setShowDestroyConfirm(true);
      return;
    }

    const tileManager = new TileManager(dojo.setup.components, dojo.network.provider, {
      col: selectedBuildingHex.outerCol,
      row: selectedBuildingHex.outerRow,
    });
    tileManager.destroyBuilding(dojo.account.account, selectedBuildingHex.innerCol, selectedBuildingHex.innerRow);
    if (
      buildingState.buildingType === BuildingType.Resource &&
      (ResourceIdToMiningType[buildingState.resource!] === ResourceMiningTypes.Forge ||
        ResourceIdToMiningType[buildingState.resource!] === ResourceMiningTypes.Mine)
    ) {
      playDestroyStone();
    } else {
      playDestroyWooden();
    }
    setShowDestroyConfirm(false);
    setLeftNavigationView(LeftView.None);
  }, [selectedBuildingHex, buildingState, showDestroyConfirm]);

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
                {showDestroyConfirm ? "Confirm Destroy" : "Destroy"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
