import { useDojo } from "@/hooks/context/DojoContext";
import { useQuery } from "@/hooks/helpers/useQuery";
import useUIStore from "@/hooks/store/useUIStore";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { BuildingStringToEnum, BuildingType } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";

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
        type: type - 1,
      };
    });
    setExistingBuildings(_tmp);
  }, [builtBuildings]);

  const castlePosition = useMemo(() => getUIPositionFromColRow(4, 4, true), []);

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
      <primitive scale={3} object={models[0].scene} position={[castlePosition.x, 2.33, -castlePosition.y]} />
    </>
  );
};

export const BuiltBuilding = ({
  position,
  models,
  buildingCategory,
}: {
  position: any;
  models: any;
  buildingCategory: number;
}) => {
  const { x, y } = getUIPositionFromColRow(position.col, position.row, true);
  const model = useMemo(() => models[buildingCategory].scene.clone(), [buildingCategory, models]);

  const { actions } = useAnimations(models[buildingCategory].animations, model);

  useEffect(() => {
    setTimeout(() => {
      if (actions["windmill_fan_rotation"]) {
        actions["windmill_fan_rotation"].play();
      }
    }, Math.random() * 1000);
  }, [actions]);

  return <primitive dropShadow scale={3} object={model} position={[x, 2.33, -y]} />;
};
