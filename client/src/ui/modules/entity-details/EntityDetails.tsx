import { ArmyInfo, useOwnArmiesByPosition } from "@/hooks/helpers/useArmies";
import useUIStore from "@/hooks/store/useUIStore";
import { HintSection } from "@/ui/components/hints/HintModal";
import { ArmyChip } from "@/ui/components/military/ArmyChip";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { Tabs } from "@/ui/elements/tab";
import { ID, Position } from "@bibliothecadao/eternum";
import { useMemo, useState, useEffect } from "react";
import { Battles } from "./Battles";
import { Entities } from "./Entities";
import { useDojo } from "@/hooks/context/DojoContext";
import { BuildingInfo, ResourceInfo } from "@/ui/components/construction/SelectPreviewBuilding";
import { BuildingType, ResourcesIds } from "@bibliothecadao/eternum";
import Button from "@/ui/elements/Button";
import { TileManager } from "@/dojo/modelManager/TileManager";
import { getEntityIdFromKeys, ResourceIdToMiningType } from "@/ui/utils/utils";
import { ResourceMiningTypes } from "@/types";
import { getComponentValue } from "@dojoengine/recs";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useLocation } from "wouter";

export const EntityDetails = () => {
  const [location, _] = useLocation();
  const isWorldView = useMemo(() => {
    return location === "/map";
  }, [location]);
  return <div>{isWorldView ? <CombatEntityDetails /> : <BuildingEntityDetails />}</div>;
};

export const BuildingEntityDetails = () => {
  // check right click on building
  const dojo = useDojo();

  const [buildingType, setBuildingType] = useState<BuildingType | undefined>(undefined);
  const [resource, setResource] = useState<ResourcesIds | undefined>(undefined);
  const [ownerEntityId, setOwnerEntityId] = useState<ID | undefined>(undefined);
  const [canBeDestroyed, setCanBeDestroyed] = useState<boolean>(false);
  const { playerRealms } = useEntities();

  // const selectedBuildingEntityId = useUIStore((state) => state.selectedBuildingEntityId);
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  console.log({ selectedBuildingHex });

  useEffect(() => {
    const building = getComponentValue(
      dojo.setup.components.Building,
      getEntityIdFromKeys(Object.values(selectedBuildingHex).map((v) => BigInt(v))),
    );

    console.log({ building });

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

  const name = "Hello";

  const destroyButton = canBeDestroyed && selectedBuildingHex && (
    <Button
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
          // playDestroyStone();
        } else {
          // playDestroyWooden();
        }
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

export const CombatEntityDetails = () => {
  const selectedHex = useUIStore((state) => state.selectedHex);
  const [selectedTab, setSelectedTab] = useState(0);

  const hexPosition = useMemo(() => {
    return { x: selectedHex.col, y: selectedHex.row };
  }, [selectedHex]);

  const ownArmiesAtPosition = useOwnArmiesByPosition({
    position: { x: selectedHex.col, y: selectedHex.row },
    inBattle: false,
  });

  const userArmies = useMemo(
    () => ownArmiesAtPosition.filter((army) => army.health.current > 0),
    [ownArmiesAtPosition],
  );

  const [ownArmySelected, setOwnArmySelected] = useState<{ id: ID; position: Position } | undefined>({
    id: userArmies?.[0]?.entity_id || 0,
    position: {
      x: selectedHex.col,
      y: selectedHex.row,
    },
  });

  const ownArmy = useMemo(() => {
    if (!ownArmySelected) {
      return;
    }
    return userArmies.find((army) => army.entity_id === ownArmySelected.id);
  }, [userArmies, ownArmySelected, selectedHex.col, selectedHex.row]);

  const tabs = useMemo(
    () => [
      {
        key: "entities",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Entities</div>
          </div>
        ),
        component: <Entities position={hexPosition} ownArmy={ownArmy} />,
      },
      {
        key: "battles",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Battles</div>
          </div>
        ),
        component: <Battles position={hexPosition} ownArmy={ownArmy} />,
      },
    ],
    [selectedHex, userArmies, ownArmy],
  );

  return (
    hexPosition && (
      <div className="px-2 h-full">
        <CoordinatesAndBiome position={hexPosition} />
        {userArmies.length > 0 && (
          <SelectActiveArmy
            selectedEntity={ownArmySelected}
            setOwnArmySelected={setOwnArmySelected}
            userAttackingArmies={userArmies}
          />
        )}

        <Tabs selectedIndex={selectedTab} onChange={(index: any) => setSelectedTab(index)} className="h-full">
          <Tabs.List>
            {tabs.map((tab, index) => (
              <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
            ))}
          </Tabs.List>
          <Tabs.Panels className="">
            {tabs.map((tab, index) => (
              <Tabs.Panel key={index} className="h-full">
                {tab.component}
              </Tabs.Panel>
            ))}
          </Tabs.Panels>
        </Tabs>
      </div>
    )
  );
};

const SelectActiveArmy = ({
  selectedEntity,
  setOwnArmySelected,
  userAttackingArmies,
}: {
  selectedEntity:
    | {
        id: ID;
        position: Position;
      }
    | undefined;
  setOwnArmySelected: (val: { id: ID; position: Position } | undefined) => void;
  userAttackingArmies: ArmyInfo[];
}) => {
  return (
    <div className="w-[31rem]">
      <Select
        value={selectedEntity?.id.toString() || ""}
        onValueChange={(a: string) => {
          setOwnArmySelected({ id: ID(a), position: selectedEntity?.position || { x: 0, y: 0 } });
        }}
      >
        <SelectTrigger className="w-[31rem] px-2">
          <SelectValue placeholder="Your armies" />
        </SelectTrigger>
        <SelectContent className="text-gold w-[31rem]">
          {userAttackingArmies.map((army, index) => {
            return (
              <SelectItem
                className="flex justify-between text-sm w-full"
                key={index}
                value={army.entity_id?.toString() || ""}
              >
                <ArmyChip className={`w-[27rem] bg-green/10`} army={army} />
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};

const CoordinatesAndBiome = ({ position }: { position: Position }) => {
  return (
    <div className="p-2 flex justify-between text-xs">
      <div className="font-bold flex space-x-2 justify-between self-center ">
        <div>{`x: ${position.x?.toLocaleString()}`}</div>
        <div>{`y: ${position.y?.toLocaleString()}`}</div>
      </div>
      <HintModalButton className="top-1 right-1" section={HintSection.Combat} />
    </div>
  );
};
