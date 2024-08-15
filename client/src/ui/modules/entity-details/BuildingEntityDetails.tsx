import { TileManager } from "@/dojo/modelManager/TileManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities } from "@/hooks/helpers/useEntities";
import useUIStore from "@/hooks/store/useUIStore";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";
import { ResourceMiningTypes } from "@/types";
import { BuildingInfo, ResourceInfo } from "@/ui/components/construction/SelectPreviewBuilding";
import Button from "@/ui/elements/Button";
import { getEntityIdFromKeys, ResourceIdToMiningType } from "@/ui/utils/utils";
import { BuildingType, ID, ResourcesIds } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { useEffect, useState } from "react";
import { View } from "../navigation/LeftNavigationModule";

export const BuildingEntityDetails = () => {
  const dojo = useDojo();

  const [buildingType, setBuildingType] = useState<BuildingType | undefined>(undefined);
  const [resource, setResource] = useState<ResourcesIds | undefined>(undefined);
  const [ownerEntityId, setOwnerEntityId] = useState<ID | undefined>(undefined);
  const [canBeDestroyed, setCanBeDestroyed] = useState<boolean>(false);
  const { playerRealms } = useEntities();

  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);

  const { play: playDestroyStone } = useUiSounds(soundSelector.destroyStone);
  const { play: playDestroyWooden } = useUiSounds(soundSelector.destroyWooden);

  useEffect(() => {
    const building = getComponentValue(
      dojo.setup.components.Building,
      getEntityIdFromKeys(Object.values(selectedBuildingHex).map((v) => BigInt(v))),
    );

    if (building) {
      setBuildingType(BuildingType[building.category as keyof typeof BuildingType]);
      setResource(building.produced_resource_type as ResourcesIds);
      setOwnerEntityId(building.outer_entity_id);
      const canBeDestroyed = playerRealms().some((realm) => realm.entity_id === building.outer_entity_id);
      setCanBeDestroyed(canBeDestroyed);
    } else {
      setBuildingType(undefined);
      setResource(undefined);
      setOwnerEntityId(undefined);
      setCanBeDestroyed(false);
    }
  }, [selectedBuildingHex]);

  const destroyButton = canBeDestroyed && selectedBuildingHex && (
    <Button
      key="destroy-button"
      onClick={() => {
        const tileManager = new TileManager(dojo.setup, {
          col: selectedBuildingHex.outerCol,
          row: selectedBuildingHex.outerRow,
        });
        tileManager.destroyBuilding(selectedBuildingHex.innerCol, selectedBuildingHex.innerRow);
        if (
          buildingType === BuildingType.Resource &&
          (ResourceIdToMiningType[resource!] === ResourceMiningTypes.Forge ||
            ResourceIdToMiningType[resource!] === ResourceMiningTypes.Mine)
        ) {
          playDestroyStone();
        } else {
          playDestroyWooden();
        }
        setLeftNavigationView(View.None);
      }}
      variant="danger"
      className="mt-3"
      withoutSound
    >
      Destroy
    </Button>
  );

  return (
    <div>
      <div className="flex flex-col p-1 space-y-1 text-sm">
        {buildingType === BuildingType.Resource && resource !== undefined && (
          <ResourceInfo resourceId={resource} entityId={ownerEntityId} extraButtons={[destroyButton]} />
        )}
        {buildingType !== undefined && buildingType !== BuildingType.Resource && (
          <BuildingInfo buildingId={buildingType} entityId={ownerEntityId} extraButtons={[destroyButton]} />
        )}
      </div>
    </div>
  );
};
