import { useDojo } from "@/hooks/context/DojoContext";
import { useQuery } from "@/hooks/helpers/useQuery";
import useUIStore from "@/hooks/store/useUIStore";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { BuildingStringToEnum, BuildingType, ResourcesIds } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useAnimations, useGLTF, useHelper } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

enum ModelsIndexes {
  Castle = 0,
  Mine = 1,
  Farm = 2,
  Fishery = 3,
  Barracks = 4,
  Market = 5,
  ArcheryRange = 6,
  Stable = 7,
  Forge = 8,
  LumberMill = 9,
  WorkersHut = 10,
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

  const models = useGLTF([
    "/models/buildings/castle.glb",
    "/models/buildings/mine.glb",
    "/models/buildings/farm.glb",
    "/models/buildings/fishery.glb",
    "/models/buildings/barracks.glb",
    "/models/buildings/market.glb",
    "/models/buildings/archer_range.glb",
    "/models/buildings/stable.glb",
    "/models/buildings/forge.glb",
    "/models/buildings/lumber_mill.glb",
    "/models/buildings/workers_hut.glb",
  ]);
  useEffect(() => {
    models.forEach((model) => {
      model.scene.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = true;
        }
      });
    });
  }, [models]);

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
  const { x, y } = getUIPositionFromColRow(position.col, position.row, true);

  const modelIndex = useMemo(() => {
    if (buildingCategory === BuildingType.Resource && resource) {
      return ResourceIdToModelIndex[resource] || ModelsIndexes.Mine;
    }
    return buildingCategory - 1;
  }, [buildingCategory, resource]);

  const model = useMemo(() => {
    return models[modelIndex].scene.clone();
  }, [modelIndex, models]);

  const lightRef = useRef<any>();

  useHelper(lightRef, THREE.PointLightHelper, 1, "green");

  const { actions } = useAnimations(models[modelIndex].animations, model);

  useEffect(() => {
    setTimeout(() => {
      for (const action in actions) {
        actions[action]?.play();
      }
    }, Math.random() * 1000);
  }, [actions]);

  return (
    <group position={[x, 2.33, -y]} rotation={rotation}>
      <primitive dropShadow scale={3} object={model} />
      {modelIndex === ModelsIndexes.ArcheryRange && (
        <pointLight ref={lightRef} position={[0, 2.6, 0]} intensity={0.6} power={150} color={"yellow"} decay={3.5} />
      )}
    </group>
  );
};
