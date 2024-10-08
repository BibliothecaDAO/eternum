import { TileManager } from "@/dojo/modelManager/TileManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities } from "@/hooks/helpers/useEntities";
import { getStructureByEntityId, isStructureImmune } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import { BUILDINGS_CENTER } from "@/three/scenes/constants";
import { ResourceMiningTypes } from "@/types";
import { BuildingInfo, ResourceInfo } from "@/ui/components/construction/SelectPreviewBuilding";
import { RealmResourcesIO } from "@/ui/components/resources/RealmResourcesIO";
import Button from "@/ui/elements/Button";
import { Headline } from "@/ui/elements/Headline";
import {
  ResourceIdToMiningType,
  copyPlayerAddressToClipboard,
  displayAddress,
  formatTime,
  getEntityIdFromKeys,
  toHexString,
} from "@/ui/utils/utils";
import { BuildingType, EternumGlobalConfig, ID, ResourcesIds, StructureType } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "../navigation/LeftNavigationModule";

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

  let isCastleSelected =
    selectedBuildingHex.innerCol === BUILDINGS_CENTER[0] && selectedBuildingHex.innerRow === BUILDINGS_CENTER[1];

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
    setLeftNavigationView(View.None);
  }, [selectedBuildingHex, buildingState]);
  return (
    <div className="flex flex-col h-full">
      {isCastleSelected ? (
        <CastleDetails />
      ) : (
        <>
          <div className="flex-grow w-full space-y-1 text-sm">
            {buildingState.buildingType === BuildingType.Resource && buildingState.resource && (
              <ResourceInfo
                isPaused={isPaused}
                resourceId={buildingState.resource}
                entityId={buildingState.ownerEntityId}
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
              <Button className="mb-4" onClick={handleDestroyBuilding} variant="danger" withoutSound>
                Destroy
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const CastleDetails = () => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);

  const structure = getStructureByEntityId(structureEntityId);
  if (!structure) return;

  const isImmune = isStructureImmune(Number(structure.created_at), nextBlockTimestamp!);

  const immunityEndTimestamp =
    Number(structure.created_at) +
    EternumGlobalConfig.battle.graceTickCount * EternumGlobalConfig.tick.armiesTickIntervalInSeconds;

  const timer = useMemo(() => {
    if (!nextBlockTimestamp) return 0;
    return immunityEndTimestamp - nextBlockTimestamp!;
  }, [nextBlockTimestamp]);

  const address = toHexString(structure?.owner.address);

  return (
    <div className="w-full text-sm  p-2">
      <Headline className="pb-2">{structure.name}</Headline>
      <div className="space-y-2">
        <div className="text-xl">Lord: {structure.ownerName}</div>
        <div>
          Address:
          <span
            className="ml-1 hover:text-white cursor-pointer"
            onClick={() => copyPlayerAddressToClipboard(structure.owner.address, structure.ownerName)}
          >
            {displayAddress(address)}
          </span>
        </div>
        {isImmune && <div>Immune for: {formatTime(timer)}</div>}
        {structure && structure.category === StructureType[StructureType.Realm] && (
          <RealmResourcesIO size="md" titleClassName="uppercase" realmEntityId={structure.entity_id} />
        )}
      </div>
    </div>
  );
};
