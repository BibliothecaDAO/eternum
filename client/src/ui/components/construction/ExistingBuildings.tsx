import { useDojo } from "@/hooks/context/DojoContext";
import { useQuery } from "@/hooks/helpers/useQuery";
import useUIStore from "@/hooks/store/useUIStore";
import { BaseThreeTooltip } from "@/ui/elements/BaseThreeTooltip";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { BuildingEnumToString, BuildingStringToEnum, BuildingType, ResourcesIds } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useAnimations, useGLTF, useHelper } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BuildingInfo } from "./SelectPreviewBuilding";

enum ModelsIndexes {
  Castle = BuildingType.Castle,
  Mine = 21,
  Farm = BuildingType.Farm,
  Fishery = BuildingType.FishingVillage,
  Barracks = BuildingType.Barracks,
  Market = BuildingType.Market,
  ArcheryRange = BuildingType.ArcheryRange,
  Stable = BuildingType.Stable,
  Forge = 22,
  LumberMill = 23,
  WorkersHut = BuildingType.WorkersHut,
  Storehouse = BuildingType.Storehouse,
}

const ResourceIdToModelIndex: Partial<Record<ResourcesIds, ModelsIndexes>> = {
  [ResourcesIds.Copper]: ModelsIndexes.Forge,
  [ResourcesIds.ColdIron]: ModelsIndexes.Forge,
  [ResourcesIds.Ignium]: ModelsIndexes.Forge,
  [ResourcesIds.Gold]: ModelsIndexes.Forge,
  [ResourcesIds.Silver]: ModelsIndexes.Forge,
  [ResourcesIds.Diamonds]: ModelsIndexes.Mine,
  [ResourcesIds.Sapphire]: ModelsIndexes.Mine,
  [ResourcesIds.Ruby]: ModelsIndexes.Mine,
  [ResourcesIds.DeepCrystal]: ModelsIndexes.Mine,
  [ResourcesIds.TwilightQuartz]: ModelsIndexes.Mine,
  [ResourcesIds.EtherealSilica]: ModelsIndexes.Mine,
  [ResourcesIds.Stone]: ModelsIndexes.Mine,
  [ResourcesIds.Coal]: ModelsIndexes.Mine,
  [ResourcesIds.Obsidian]: ModelsIndexes.Mine,
  [ResourcesIds.TrueIce]: ModelsIndexes.Mine,
  [ResourcesIds.Wood]: ModelsIndexes.LumberMill,
  [ResourcesIds.Hartwood]: ModelsIndexes.LumberMill,
  [ResourcesIds.Ironwood]: ModelsIndexes.LumberMill,
  [ResourcesIds.Mithral]: ModelsIndexes.Forge,
  [ResourcesIds.Dragonhide]: ModelsIndexes.Forge,
  [ResourcesIds.AlchemicalSilver]: ModelsIndexes.Forge,
  [ResourcesIds.Adamantine]: ModelsIndexes.Forge,
};

export const ExistingBuildings = () => {
  const { hexPosition: globalHex } = useQuery();
  const { existingBuildings, setExistingBuildings } = useUIStore((state) => state);

  const {
    setup: {
      components: { Building },
    },
  } = useDojo();

  const models = useMemo(
    () => ({
      [ModelsIndexes.Castle]: useGLTF("/models/buildings/castle.glb"),
      [ModelsIndexes.Mine]: useGLTF("/models/buildings/mine.glb"),
      [ModelsIndexes.Farm]: useGLTF("/models/buildings/farm.glb"),
      [ModelsIndexes.Fishery]: useGLTF("/models/buildings/fishery.glb"),
      [ModelsIndexes.Barracks]: useGLTF("/models/buildings/barracks.glb"),
      [ModelsIndexes.Market]: useGLTF("/models/buildings/market.glb"),
      [ModelsIndexes.ArcheryRange]: useGLTF("/models/buildings/archer_range.glb"),
      [ModelsIndexes.Stable]: useGLTF("/models/buildings/stable.glb"),
      [ModelsIndexes.WorkersHut]: useGLTF("/models/buildings/workers_hut.glb"),
      [ModelsIndexes.Storehouse]: useGLTF("/models/buildings/storehouse.glb"),
      [ModelsIndexes.Forge]: useGLTF("/models/buildings/forge.glb"),
      [ModelsIndexes.LumberMill]: useGLTF("/models/buildings/lumber_mill.glb"),
    }),
    [],
  );

  const builtBuildings = useEntityQuery([
    Has(Building),
    HasValue(Building, { outer_col: BigInt(globalHex.col), outer_row: BigInt(globalHex.row) }),
  ]);

  useEffect(() => {
    const _tmp = builtBuildings.map((entity) => {
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
      <BuiltBuilding
        models={models}
        buildingCategory={BuildingType.Castle}
        position={{ col: 4, row: 4 }}
        rotation={new THREE.Euler(0, Math.PI * 1.5, 0)}
      />
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

  useHelper(lightRef, THREE.PointLightHelper, 1, "green");

  const { x, y } = getUIPositionFromColRow(position.col, position.row, true);

  const modelIndex = useMemo(() => {
    if (buildingCategory === BuildingType.Resource && resource) {
      return ResourceIdToModelIndex[resource] || ModelsIndexes.Mine;
    }
    return buildingCategory;
  }, [buildingCategory, resource]);

  const model = useMemo(() => {
    let model = models[modelIndex];

    model.scene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });
    return model.scene.clone();
  }, [modelIndex, models]);

  const { actions } = useAnimations(models[modelIndex].animations, model);

  useEffect(() => {
    setTimeout(() => {
      for (const action in actions) {
        actions[action]?.play();
      }
    }, Math.random() * 1000);
  }, [actions]);

  const [hover, setHover] = useState(false);

  return (
    <group
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      position={[x, 2.33, -y]}
      rotation={rotation}
    >
      <primitive dropShadow scale={3} object={model} />
      {hover && <HoverBuilding building={buildingCategory} />}
    </group>
  );
};

const HoverBuilding = ({ building }: { building: BuildingType }) => {
  return (
    <BaseThreeTooltip distanceFactor={20}>
      <div className="flex flex-col  text-sm p-1 space-y-1">
        <div className="font-bold text-center">
          {BuildingEnumToString[building as keyof typeof BuildingEnumToString]}
        </div>
        {/* <BuildingInfo buildingId={building} /> */}
      </div>
    </BaseThreeTooltip>
  );
};
