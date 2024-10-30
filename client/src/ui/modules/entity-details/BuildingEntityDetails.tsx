import { TileManager } from "@/dojo/modelManager/TileManager";
import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities, useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useGetRealm } from "@/hooks/helpers/useRealm";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import { useIsStructureImmune, useStructureByEntityId } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { soundSelector, useBuildingSound, useUiSounds } from "@/hooks/useUISound";
import { BUILDINGS_CENTER } from "@/three/scenes/constants";
import { ResourceMiningTypes } from "@/types";
import { BuildingInfo, ResourceInfo } from "@/ui/components/construction/SelectPreviewBuilding";
import { HintSection } from "@/ui/components/hints/HintModal";
import { RealmResourcesIO } from "@/ui/components/resources/RealmResourcesIO";
import Button from "@/ui/elements/Button";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import {
  ResourceIdToMiningType,
  copyPlayerAddressToClipboard,
  displayAddress,
  divideByPrecision,
  formatTime,
  getEntityIdFromKeys,
  toHexString,
} from "@/ui/utils/utils";
import {
  BuildingType,
  ID,
  LEVEL_DESCRIPTIONS,
  REALM_MAX_LEVEL,
  RealmLevels,
  ResourcesIds,
  StructureType,
  TickIds,
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
  const dojo = useDojo();

  const { getBalance } = getResourceBalance();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);

  const [isLoading, setIsLoading] = useState(false);

  const realm = useGetRealm(structureEntityId).realm;

  const setTooltip = useUIStore((state) => state.setTooltip);

  const structure = useStructureByEntityId(structureEntityId);
  if (!structure) return;

  const isImmune = useIsStructureImmune(Number(structure.created_at), nextBlockTimestamp!);

  const immunityEndTimestamp = useMemo(() => {
    return (
      Number(structure.created_at) + configManager.getBattleGraceTickCount() * configManager.getTick(TickIds.Armies)
    );
  }, [structure.created_at, configManager]);

  const timer = useMemo(() => {
    if (!nextBlockTimestamp) return 0;
    return immunityEndTimestamp - nextBlockTimestamp!;
  }, [nextBlockTimestamp]);

  const address = toHexString(structure?.owner.address);

  const getNextRealmLevel = useMemo(() => {
    const nextLevel = realm.level + 1;
    return nextLevel <= REALM_MAX_LEVEL ? nextLevel : null;
  }, [realm.level]);

  const checkBalance = useMemo(() => {
    if (!getNextRealmLevel) return false;

    const cost = configManager.realmUpgradeCosts[getNextRealmLevel];
    return Object.keys(cost).every((resourceId) => {
      const resourceCost = cost[Number(resourceId)];
      const balance = getBalance(structureEntityId, resourceCost.resource);
      return divideByPrecision(balance.balance) >= resourceCost.amount;
    });
  }, [getBalance, structureEntityId]);

  const levelUpRealm = async () => {
    setIsLoading(true);

    await dojo.setup.systemCalls.upgrade_realm({
      signer: dojo.account.account,
      realm_entity_id: realm.entityId,
    });
    setIsLoading(false);
  };

  return (
    <div className="w-full text-sm  p-3">
      <div className="flex justify-between">
        <h3 className="pb-2 text-4xl flex justify-between">
          {structure.name} <HintModalButton section={HintSection.Realm} />
        </h3>
        {isImmune && (
          <div
            onMouseEnter={() => {
              setTooltip({
                content: (
                  <>
                    This structure is currently immune to attacks.
                    <br />
                    During this period, you are also unable to attack other players.
                  </>
                ),
                position: "top",
              });
            }}
            onMouseLeave={() => setTooltip(null)}
            className="font-bold text-lg animate-pulse text-white"
          >
            Immune for: {formatTime(timer)}
          </div>
        )}
      </div>

      <div className="font-bold flex justify-between">
        <div>
          <div> {structure.ownerName}</div>
        </div>
        <div>
          <span
            className="ml-1 hover:text-white cursor-pointer"
            onClick={() => copyPlayerAddressToClipboard(structure.owner.address, structure.ownerName)}
          >
            {displayAddress(address)}
          </span>
        </div>
      </div>
      <hr />

      <div className="my-3">
        <div className="flex justify-between py-2 gap-4">
          <div>
            <div className="flex gap-4">
              <div className="text-2xl">{RealmLevels[realm.level]}</div>
              {getNextRealmLevel && (
                <div>
                  <Button variant="outline" disabled={!checkBalance} isLoading={isLoading} onClick={levelUpRealm}>
                    {checkBalance ? `Upgrade to ${RealmLevels[realm.level]}` : "Need Resources"}
                  </Button>
                </div>
              )}
            </div>
            {getNextRealmLevel && (
              <div>
                <p>
                  {" "}
                  Next Level: {RealmLevels[realm.level + 1]},{" "}
                  {LEVEL_DESCRIPTIONS[(realm.level + 1) as keyof typeof LEVEL_DESCRIPTIONS]}
                </p>
                <div className="my-4 font-semibold uppercase">Upgrade Cost to {RealmLevels[realm.level + 1]}</div>
                <div className="flex gap-2">
                  {configManager.realmUpgradeCosts[getNextRealmLevel]?.map((a) => {
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
              </div>
            )}
          </div>
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
