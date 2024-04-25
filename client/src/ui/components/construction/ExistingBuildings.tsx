import { useDojo } from "@/hooks/context/DojoContext";
import { useQuery } from "@/hooks/helpers/useQuery";
import useUIStore from "@/hooks/store/useUIStore";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { BuildingStringToEnum, BuildingType } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useAnimations, useGLTF, useHelper } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

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
        type: type,
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
}: {
  position: any;
  models: any;
  buildingCategory: number;
  rotation?: THREE.Euler;
}) => {
  const { x, y } = getUIPositionFromColRow(position.col, position.row, true);
  const modelIndex = useMemo(() => buildingCategory - 1, [buildingCategory]);
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
      {buildingCategory === BuildingType.ArcheryRange && (
        <pointLight ref={lightRef} position={[0, 2.6, 0]} intensity={0.6} power={150} color={"yellow"} decay={3.5} />
      )}
    </group>
  );
};
