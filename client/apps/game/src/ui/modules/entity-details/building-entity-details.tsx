import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { BuildingInfo, ResourceInfo } from "@/ui/features/settlement/construction/select-preview-building";
import { ProductionModal } from "@/ui/features/settlement/production/production-modal";
import Button from "@/ui/elements/button";
import { RealmVillageDetails } from "@/ui/modules/entity-details/realm/realm-details";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import { ResourceIdToMiningType, TileManager, configManager, getEntityInfo } from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import {
  BUILDINGS_CENTER,
  BuildingType,
  ContractAddress,
  ID,
  ResourceMiningTypes,
  ResourcesIds,
  StructureType,
  getProducedResource,
} from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { PauseIcon, PlayIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);

  const toggleModal = useUIStore((state) => state.toggleModal);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);

  const resourceManager = useResourceManager(structureEntityId);

  const { play: playDestroyStone } = useUiSounds(soundSelector.destroyStone);
  const { play: playDestroyWooden } = useUiSounds(soundSelector.destroyWooden);

  const playerStructures = useUIStore((state) => state.playerStructures);

  const selectedStructureInfo = getEntityInfo(
    structureEntityId,
    ContractAddress(dojo.account.account.address),
    dojo.setup.components,
  );

  const isCastleSelected = useMemo(
    () =>
      selectedBuildingHex.innerCol === BUILDINGS_CENTER[0] &&
      selectedBuildingHex.innerRow === BUILDINGS_CENTER[1] &&
      (selectedStructureInfo?.structureCategory === StructureType.Realm ||
        selectedStructureInfo?.structureCategory === StructureType.Village),
    [selectedBuildingHex.innerCol, selectedBuildingHex.innerRow],
  );

  const building = useComponentValue(
    dojo.setup.components.Building,
    getEntityIdFromKeys(Object.values(selectedBuildingHex).map((v) => BigInt(v))),
  );

  useEffect(() => {
    if (building) {
      setBuildingState({
        buildingType: building.category as BuildingType,
        resource: getProducedResource(building.category as BuildingType),
        ownerEntityId: building.outer_entity_id,
      });
      setIsPaused(building.paused);
      setIsOwnedByPlayer(playerStructures.some((structure) => structure.entityId === building.outer_entity_id));
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
    const tileManager = new TileManager(dojo.setup.components, dojo.setup.systemCalls, {
      col: selectedBuildingHex.outerCol,
      row: selectedBuildingHex.outerRow,
    });

    const action = !isPaused ? tileManager.pauseProduction : tileManager.resumeProduction;
    action(dojo.account.account, structureEntityId, selectedBuildingHex.innerCol, selectedBuildingHex.innerRow).then(
      () => {
        setIsLoading(false);
      },
    );
  }, [selectedBuildingHex, isPaused]);

  const handleDestroyBuilding = useCallback(() => {
    if (!showDestroyConfirm) {
      setShowDestroyConfirm(true);
      return;
    }

    const tileManager = new TileManager(dojo.setup.components, dojo.setup.systemCalls, {
      col: selectedBuildingHex.outerCol,
      row: selectedBuildingHex.outerRow,
    });
    tileManager.destroyBuilding(
      dojo.account.account,
      structureEntityId,
      selectedBuildingHex.innerCol,
      selectedBuildingHex.innerRow,
    );
    if (
      buildingState.resource &&
      (ResourceIdToMiningType[buildingState.resource] === ResourceMiningTypes.Forge ||
        ResourceIdToMiningType[buildingState.resource] === ResourceMiningTypes.Mine)
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

    const structure = getComponentValue(
      dojo.setup.components.Structure,
      getEntityIdFromKeys([BigInt(structureEntityId)]),
    );

    const populationImpact = configManager.getBuildingCategoryConfig(buildingState.buildingType).capacity_grant;

    const population = getComponentValue(
      dojo.setup.components.StructureBuildings,
      getEntityIdFromKeys([BigInt(structure?.entity_id || 0)]),
    );
    return (population?.population.max || 0) - (population?.population.current || 0) >= populationImpact;
  }, [buildingState.buildingType, buildingState.ownerEntityId]);

  const productionEndsAt = useMemo(() => {
    if (!buildingState.resource) return 0;
    return resourceManager.getProductionEndsAt(buildingState.resource || 0);
  }, [resourceManager, buildingState.resource]);

  const isActive = useMemo(() => {
    if (!buildingState.resource) return false;
    return resourceManager.isActive(buildingState.resource || 0);
  }, [resourceManager, buildingState.resource]);

  console.log(productionEndsAt, isActive);

  return (
    <div className="building-entity-details-selector flex flex-col h-full">
      {isCastleSelected ? (
        <div className="flex-grow w-full space-y-1 text-sm">
          <RealmVillageDetails />
        </div>
      ) : (
        <>
          <div className="flex-grow w-full space-y-1 text-sm">
            {buildingState.resource && buildingState.buildingType && (
              <ResourceInfo
                isPaused={isPaused}
                resourceId={buildingState.resource}
                buildingId={buildingState.buildingType}
                entityId={buildingState.ownerEntityId}
                hintModal
              />
            )}
            {buildingState?.buildingType && !buildingState.resource && (
              <BuildingInfo
                isPaused={isPaused}
                buildingId={buildingState.buildingType}
                entityId={buildingState.ownerEntityId}
                hintModal
              />
            )}
          </div>
          {buildingState.buildingType && selectedBuildingHex && isOwnedByPlayer && (
            <div className="flex justify-between space-x-3 px-4 mb-4">
              {buildingState.buildingType !== BuildingType.ResourceFish &&
                buildingState.buildingType !== BuildingType.ResourceWheat && (
                  <Button
                    onClick={() => {
                      toggleModal(<ProductionModal preSelectedResource={buildingState.resource} />);
                    }}
                    isLoading={isLoading}
                    variant="gold"
                    withoutSound
                  >
                    <div className="flex items-center gap-2">
                      <PlusIcon className="w-4 h-4" />
                      Add Production
                    </div>
                  </Button>
                )}

              <div className="flex items-center gap-2">
                <Button onClick={handlePauseResumeProduction} isLoading={isLoading} variant="secondary" withoutSound>
                  {isPaused ? <PlayIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />}
                  {/* {isPaused ? "Resume" : "Pause"} */}
                </Button>
                <Button disabled={!canDestroyBuilding} onClick={handleDestroyBuilding} variant="danger" withoutSound>
                  {showDestroyConfirm ? "Confirm Destroy" : <Trash2Icon className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
