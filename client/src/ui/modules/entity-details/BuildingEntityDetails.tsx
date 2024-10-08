import { TileManager } from "@/dojo/modelManager/TileManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities } from "@/hooks/helpers/useEntities";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import { getStructureByEntityId, isStructureImmune } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import { BUILDINGS_CENTER } from "@/three/scenes/constants";
import { ResourceMiningTypes } from "@/types";
import { BuildingInfo, ResourceInfo } from "@/ui/components/construction/SelectPreviewBuilding";
import { RealmResourcesIO } from "@/ui/components/resources/RealmResourcesIO";
import Button from "@/ui/elements/Button";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import {
  ResourceIdToMiningType,
  copyPlayerAddressToClipboard,
  displayAddress,
  formatTime,
  getEntityIdFromKeys,
  toHexString,
} from "@/ui/utils/utils";
import {
  BuildingType,
  EternumGlobalConfig,
  LEVEL_DESCRIPTIONS,
  REALM_UPGRADE_COSTS,
  RealmLevels,
  StructureType,
  scaleResources,
  type ID,
  type ResourcesIds,
} from "@bibliothecadao/eternum";
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

  const isCastleSelected =
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
            {buildingState.buildingType === BuildingType.Resource && buildingState.resource != null && (
              <ResourceInfo
                isPaused={isPaused}
                resourceId={buildingState.resource}
                entityId={buildingState.ownerEntityId}
              />
            )}
            {buildingState.buildingType != null && buildingState.buildingType !== BuildingType.Resource && (
              <BuildingInfo
                isPaused={isPaused}
                buildingId={buildingState.buildingType}
                entityId={buildingState.ownerEntityId}
                hintModal
              />
            )}
          </div>
          {buildingState.buildingType != null && selectedBuildingHex && isOwnedByPlayer && (
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
  const { getBalance } = getResourceBalance();

  const setTooltip = useUIStore((state) => state.setTooltip);

  const dojo = useDojo();
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);

  const structure = getStructureByEntityId(structureEntityId);
  if (!structure) return;

  const isImmune = isStructureImmune(Number(structure.created_at), nextBlockTimestamp!);

  const immunityEndTimestamp =
    Number(structure.created_at) +
    dojo.setup.configManager.getBattleGraceTickCount() * EternumGlobalConfig.tick.armiesTickIntervalInSeconds;

  const timer = useMemo(() => {
    if (!nextBlockTimestamp) return 0;
    return immunityEndTimestamp - nextBlockTimestamp;
  }, [nextBlockTimestamp]);

  const realmLevel =
    useComponentValue(dojo.setup.components.Realm, getEntityIdFromKeys([BigInt(structureEntityId)]))?.level ?? 0;

  const getNextRealmLevel = useMemo(() => {
    const nextLevel = realmLevel + 1;
    return nextLevel <= RealmLevels.Empire ? nextLevel : null;
  }, [realmLevel]);

  const checkBalance = useMemo(() => {
    const cost = scaleResources(
      REALM_UPGRADE_COSTS[getNextRealmLevel as keyof typeof REALM_UPGRADE_COSTS],
      EternumGlobalConfig.resources.resourceMultiplier,
    );

    return Object.keys(cost).every((resourceId) => {
      const resourceCost = cost[Number(resourceId)];
      const balance = getBalance(structureEntityId, resourceCost.resource);
      return balance.balance / EternumGlobalConfig.resources.resourcePrecision >= resourceCost.amount;
    });
  }, [getBalance, structureEntityId]);

  return (
    <div className="w-full text-sm  p-3">
      <div className="flex justify-between">
        <h3 className="pb-2 text-4xl">{structure.name}</h3>
        {isImmune && <div>Immune for: {formatTime(timer)}</div>}
      </div>

      <div className="font-bold flex justify-between">
        <div>
          <div> {structure.ownerName}</div>
        </div>
        <div>
          <span
            className="ml-1 hover:text-white cursor-pointer"
            onClick={() => {
              copyPlayerAddressToClipboard(structure.owner.address, structure.ownerName);
            }}
          >
            {displayAddress(toHexString(structure?.owner.address))}
          </span>
        </div>
      </div>
      <hr />

      <div className="my-3">
        <div className="flex justify-between py-2 gap-4">
          <div>
            <div className="text-2xl">{RealmLevels[realmLevel]}</div>
            {getNextRealmLevel && (
              <div>
                Next Level {RealmLevels[realmLevel + 1]}:{" "}
                {LEVEL_DESCRIPTIONS[(realmLevel + 1) as keyof typeof LEVEL_DESCRIPTIONS]}
              </div>
            )}
          </div>

          {getNextRealmLevel && (
            <div>
              <div className="mb-1 text-right font-semibold">Upgrade to {RealmLevels[realmLevel + 1]}</div>
              <Button
                variant="outline"
                disabled={!checkBalance}
                onMouseEnter={() => {
                  setTooltip({
                    content: (
                      <div className="flex gap-2">
                        {" "}
                        {scaleResources(
                          REALM_UPGRADE_COSTS[(realmLevel + 1) as keyof typeof REALM_UPGRADE_COSTS],
                          EternumGlobalConfig.resources.resourceMultiplier,
                        )?.map((a) => {
                          return (
                            <ResourceCost
                              key={a.resource}
                              className="!text-gold"
                              type="vertical"
                              size="xs"
                              resourceId={a.resource}
                              amount={a.amount}
                            />
                          );
                        })}
                      </div>
                    ),
                    position: "right",
                  });
                }}
                onMouseLeave={() => {
                  setTooltip(null);
                }}
              >
                {checkBalance ? "Upgrade" : "Need Resources"}
              </Button>
            </div>
          )}
        </div>

        <hr />

        <div className="my-3">
          {structure && structure.category === StructureType[StructureType.Realm] && (
            <RealmResourcesIO size="md" titleClassName="uppercase" realmEntityId={structure.entity_id} />
          )}
        </div>
      </div>
    </div>
  );
};
