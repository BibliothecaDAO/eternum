import { TileManager } from "@/dojo/modelManager/TileManager";
import { useDojo } from "@/hooks/context/DojoContext";
import useUIStore from "@/hooks/store/useUIStore";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import { ResourceMiningTypes } from "@/types";
import { BuildingInfo, ResourceInfo } from "@/ui/components/construction/SelectPreviewBuilding";
import Button from "@/ui/elements/Button";
import { getEntityIdFromKeys, ResourceIdToMiningType } from "@/ui/utils/utils";
import { BuildingType, ID, ResourcesIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { useCallback, useEffect, useState } from "react";
import { View } from "../navigation/LeftNavigationModule";
import { useEntities } from "@/hooks/helpers/useEntities";

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
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);

  const { play: playDestroyStone } = useUiSounds(soundSelector.destroyStone);
  const { play: playDestroyWooden } = useUiSounds(soundSelector.destroyWooden);

  const { playerStructures } = useEntities();

  const building = useComponentValue(
    dojo.setup.components.Building,
    getEntityIdFromKeys(Object.values(selectedBuildingHex).map((v) => BigInt(v))),
  );

  useEffect(() => {
    const structures = playerStructures();
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
    setLeftNavigationView(View.None);
  }, [selectedBuildingHex, buildingState]);
  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow w-full space-y-1 text-sm">
        {buildingState.buildingType === BuildingType.Resource && buildingState.resource !== undefined && (
          <ResourceInfo
            isPaused={isPaused}
            resourceId={buildingState.resource}
            entityId={buildingState.ownerEntityId}
          />
        )}
        {buildingState.buildingType !== undefined && buildingState.buildingType !== BuildingType.Resource && (
          <BuildingInfo
            isPaused={isPaused}
            buildingId={buildingState.buildingType}
            entityId={buildingState.ownerEntityId}
            hintModal
          />
        )}
      </div>
      {buildingState.buildingType !== undefined && selectedBuildingHex && isOwnedByPlayer && (
        <div className="flex justify-center space-x-3 mb-4">
          <Button onClick={handlePauseResumeProduction} isLoading={isLoading} variant="outline" withoutSound>
            {isPaused ? "Resume" : "Pause"}
          </Button>
          <Button onClick={handleDestroyBuilding} variant="danger" withoutSound>
            Destroy
          </Button>
        </div>
      )}
    </div>
  );
};
