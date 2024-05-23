import { useDojo } from "@/hooks/context/DojoContext";
import { useQuery } from "@/hooks/helpers/useQuery";
import useUIStore from "@/hooks/store/useUIStore";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { ResourceIdToMiningType, ResourceMiningTypes, getUIPositionFromColRow } from "@/ui/utils/utils";
import {
  BuildingEnumToString,
  BuildingStringToEnum,
  BuildingType,
  ResourcesIds,
  biomes,
} from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, NotValue, getComponentValue } from "@dojoengine/recs";
import { useAnimations, useGLTF, useHelper } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BannerFlag } from "../worldmap/BannerFlag";
import { BuildingInfo } from "./SelectPreviewBuilding";
import { useBuildings } from "@/hooks/helpers/useBuildings";
import useRealmStore from "@/hooks/store/useRealmStore";
import { HexType, useHexPosition } from "@/hooks/helpers/useHexPosition";
import { useControls } from "leva";
import Button from "@/ui/elements/Button";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";

export enum ModelsIndexes {
  Castle = BuildingType.Castle,
  Farm = BuildingType.Farm,
  Fishery = BuildingType.FishingVillage,
  Barracks = BuildingType.Barracks,
  Market = BuildingType.Market,
  ArcheryRange = BuildingType.ArcheryRange,
  Stable = BuildingType.Stable,
  WorkersHut = BuildingType.WorkersHut,
  Storehouse = BuildingType.Storehouse,
  Bank = BuildingType.Bank,
  ShardsMine = BuildingType.ShardsMine,
}

const redColor = new THREE.Color("red");

export const ExistingBuildings = () => {
  const { hexPosition: globalHex } = useQuery();
  const existingBuildings = useUIStore((state) => state.existingBuildings);
  const setExistingBuildings = useUIStore((state) => state.setExistingBuildings);
  const { hexType } = useHexPosition();
  const sLightRef = useRef<any>();

  const {
    setup: {
      components: { Building },
    },
  } = useDojo();

  const models = useMemo(
    () => ({
      [ModelsIndexes.Castle]: useGLTF("/models/buildings/castle.glb"),
      [ModelsIndexes.Farm]: useGLTF("/models/buildings/farm.glb"),
      [ModelsIndexes.Fishery]: useGLTF("/models/buildings/fishery.glb"),
      [ModelsIndexes.Barracks]: useGLTF("/models/buildings/barracks.glb"),
      [ModelsIndexes.Market]: useGLTF("/models/buildings/market.glb"),
      [ModelsIndexes.ArcheryRange]: useGLTF("/models/buildings/archer_range.glb"),
      [ModelsIndexes.Stable]: useGLTF("/models/buildings/stable.glb"),
      [ModelsIndexes.WorkersHut]: useGLTF("/models/buildings/workers_hut.glb"),
      [ModelsIndexes.Storehouse]: useGLTF("/models/buildings/storehouse.glb"),
      [ModelsIndexes.Bank]: useGLTF("/models/buildings/bank.glb"),
      [ModelsIndexes.ShardsMine]: useGLTF("/models/buildings/mine.glb"),
      [ResourceMiningTypes.Forge]: useGLTF("/models/buildings/forge.glb"),
      [ResourceMiningTypes.Mine]: useGLTF("/models/buildings/mine.glb"),
      [ResourceMiningTypes.LumberMill]: useGLTF("/models/buildings/lumber_mill.glb"),
      [ResourceMiningTypes.Dragonhide]: useGLTF("/models/buildings/dragonhide.glb"),
    }),
    [],
  );
  const builtBuildings = useEntityQuery([
    Has(Building),
    HasValue(Building, { outer_col: BigInt(globalHex.col), outer_row: BigInt(globalHex.row) }),
    NotValue(Building, { entity_id: 0n }),
    NotValue(Building, { produced_resource_type: ResourcesIds.Earthenshard }),
  ]);

  useEffect(() => {
    let _tmp = builtBuildings.map((entity) => {
      const productionModelValue = getComponentValue(Building, entity);
      const type = productionModelValue?.category
        ? BuildingStringToEnum[productionModelValue.category as keyof typeof BuildingStringToEnum]
        : BuildingType.None;

      return {
        col: Number(productionModelValue?.inner_col),
        row: Number(productionModelValue?.inner_row),
        type: type as BuildingType,
        entity: entity,
        resource: productionModelValue?.produced_resource_type,
      };
    });
    setExistingBuildings(_tmp);
  }, [builtBuildings]);

  const { x, y } = getUIPositionFromColRow(10, 10, true);

  const { sLightPosition, sLightIntensity, power } = useControls("Spot Light", {
    sLightPosition: { value: { x, y: 12, z: -y }, label: "Position" },
    sLightIntensity: { value: 75, min: 0, max: 100, step: 0.01 },
    power: { value: 2000, min: 0, max: 10000, step: 1 },
  });

  const middleBuidingCategory =
    hexType === HexType.BANK
      ? ModelsIndexes.Bank
      : hexType === HexType.SHARDSMINE
      ? ModelsIndexes.ShardsMine
      : BuildingType.Castle;

  return (
    <>
      {existingBuildings.map((building, index) => (
        <BuiltBuilding
          key={index}
          models={models}
          buildingCategory={building.type}
          position={{ col: building.col, row: building.row }}
          resource={building.resource}
        />
      ))}
      {hexType !== HexType.EMPTY && (
        <group>
          <BuiltBuilding
            models={models}
            buildingCategory={middleBuidingCategory}
            position={{ col: 10, row: 10 }}
            rotation={new THREE.Euler(0, Math.PI * 1.5, 0)}
          />
          <pointLight
            ref={sLightRef}
            position={[sLightPosition.x, sLightPosition.y, sLightPosition.z]}
            color="#fff"
            intensity={sLightIntensity}
            power={power}
          />
        </group>
      )}
      {hexType === HexType.REALM && (
        <group position={[x - 1.65, 3.5, -y]}>
          <BannerFlag />
        </group>
      )}
    </>
  );
};

export const BuiltBuilding = ({
  position,
  models,
  buildingCategory,
  rotation,
  resource,
}: {
  position: any;
  models: any;
  buildingCategory: number;
  rotation?: THREE.Euler;
  resource?: ResourcesIds;
}) => {
  const lightRef = useRef<any>();
  const isDestroyMode = useUIStore((state) => state.isDestroyMode);
  const { destroyBuilding } = useBuildings();
  const { realmEntityId } = useRealmStore();
  const [popupOpened, setPopupOpened] = useState(false);

  useHelper(lightRef, THREE.PointLightHelper, 1, "green");

  const { x, y } = getUIPositionFromColRow(position.col, position.row, true);

  const modelIndex = useMemo(() => {
    if (buildingCategory === BuildingType.Resource && resource) {
      return ResourceIdToMiningType[resource] || ResourceMiningTypes.Mine;
    }
    return buildingCategory;
  }, [buildingCategory, resource]);

  const model = useMemo(() => {
    let model = models[modelIndex];
    if (!model) return new THREE.Mesh();
    model.scene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        if (buildingCategory === BuildingType.FishingVillage && child.name === "Water") {
          child.castShadow = false;
          child.material.color.set(biomes["ocean"].color);
        }
        if (popupOpened) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.8; // Adjust opacity level as needed
        } else {
          child.material = child.material.clone();
          child.material.transparent = false;
          child.material.opacity = 1; // Adjust opacity level as needed
        }
      }
    });
    return model.scene.clone();
  }, [modelIndex, models, popupOpened]);

  const { actions } = useAnimations(models[modelIndex]?.animations || [], model);
  const { play: playDestroyWooden } = useUiSounds(soundSelector.destroyWooden);
  const { play: playDestroyStone } = useUiSounds(soundSelector.destroyStone);

  useEffect(() => {
    setTimeout(() => {
      for (const action in actions) {
        actions[action]?.play();
      }
    }, Math.random() * 1000);
  }, [actions]);

  const canBeDestroyed =
    buildingCategory !== BuildingType.Castle &&
    buildingCategory !== BuildingType.Bank &&
    buildingCategory! !== BuildingType.ShardsMine;

  const destroyButton = canBeDestroyed && (
    <Button
      onClick={() => {
        destroyBuilding(realmEntityId, position.col, position.row);
        if (
          buildingCategory === BuildingType.Resource &&
          (ResourceIdToMiningType[resource!] === ResourceMiningTypes.Forge ||
            ResourceIdToMiningType[resource!] === ResourceMiningTypes.Mine)
        ) {
          playDestroyStone();
        } else {
          playDestroyWooden();
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
    <group
      onClick={() => setPopupOpened(true)}
      onContextMenu={() => setPopupOpened(true)}
      position={[x, 2.31, -y]}
      rotation={rotation}
      onPointerMissed={(_e) => {
        setPopupOpened(false);
      }}
    >
      <primitive dropShadow scale={3} object={model} />
      {!isDestroyMode && popupOpened && (
        <HoverBuilding destroyButton={destroyButton} building={buildingCategory} entityId={realmEntityId} />
      )}
    </group>
  );
};

const HoverBuilding = ({
  building,
  entityId,
  destroyButton,
}: {
  destroyButton: React.ReactNode;
  building: BuildingType;
  entityId: bigint;
}) => {
  return (
    <BaseThreeTooltip distanceFactor={30} position={Position.BOTTOM_RIGHT}>
      <div className="flex flex-col p-1 space-y-1 text-sm">
        {/* <div className="font-bold text-center">
          {BuildingEnumToString[building as keyof typeof BuildingEnumToString]}
        </div> */}
        <BuildingInfo buildingId={building} entityId={entityId} extraButtons={[destroyButton]} />
      </div>
    </BaseThreeTooltip>
  );
};
