import { useDojo } from "@/hooks/context/DojoContext";
import { useQuery } from "@/hooks/helpers/useQuery";
import useUIStore from "@/hooks/store/useUIStore";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { BuildingStringToEnum } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useGLTF } from "@react-three/drei";

export const ExistingBuildings = () => {
  const { hexPosition: globalHex } = useQuery();
  const { previewBuilding, setHoveredBuildHex, existingBuildings } = useUIStore((state) => state);

  const {
    setup: {
      components: { Building },
    },
  } = useDojo();

  const models = useGLTF([
    "/models/buildings/castle.glb",
    "/models/buildings/farm.glb",
    "/models/buildings/fishery.glb",
    "/models/buildings/mine.glb",
    "/models/buildings/stable.glb",
    "/models/buildings/workhut.glb",
    "/models/buildings/archer_range.glb",
    "/models/buildings/barracks.glb",
    "/models/buildings/market.glb",
    "/models/buildings/storehouse.glb",
  ]);

  const builtBuildings = useEntityQuery([
    Has(Building),
    HasValue(Building, { outer_col: BigInt(globalHex.col), outer_row: BigInt(globalHex.row) }),
  ]);

  return (
    <>
      {builtBuildings.map((entity) => {
        const productionModelValue = getComponentValue(Building, entity);

        return (
          productionModelValue && (
            <BuiltBuilding
              key={entity}
              models={models}
              buildingCategory={
                BuildingStringToEnum[productionModelValue.category as keyof typeof BuildingStringToEnum]
              }
              position={{ col: Number(productionModelValue.inner_col), row: Number(productionModelValue.inner_row) }}
              onPointerMove={() =>
                previewBuilding &&
                setHoveredBuildHex({
                  col: Number(productionModelValue.inner_col),
                  row: Number(productionModelValue.inner_row),
                })
              }
            />
          )
        );
      })}
      {existingBuildings.map((building, index) => {
        const position = getUIPositionFromColRow(building.col, building.row, true);
        return <primitive scale={3} object={models[0].scene} key={index} position={[position.x, 2.33, -position.y]} />;
      })}
    </>
  );
};

export const BuiltBuilding = ({
  position,
  models,
  buildingCategory,
}: {
  position: any;
  onPointerMove: any;
  models: any;
  buildingCategory: number;
}) => {
  const { x, y } = getUIPositionFromColRow(position.col, position.row, true);

  return <primitive scale={3} object={models[buildingCategory].scene.clone()} position={[x, 2.33, -y]} />;
};
