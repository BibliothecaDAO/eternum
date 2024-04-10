import useUIStore from "../../../hooks/store/useUIStore";
import * as THREE from "three";
import { createHexagonShape } from "../worldmap/hexagon/HexagonGeometry";
import { HEX_RADIUS } from "../worldmap/hexagon/WorldHexagon";
import { getEntityIdFromKeys, getUIPositionFromColRow } from "../../utils/utils";
import { Bvh, useGLTF } from "@react-three/drei";
import { useState } from "react";
import { useBuildingSound } from "../../../hooks/useUISound";
import { useDojo } from "@/hooks/context/DojoContext";
import useRealmStore from "@/hooks/store/useRealmStore";
import { BuildingType, ResourcesIds, BuildingStringToEnum } from "@bibliothecadao/eternum";
import { useQuery } from "@/hooks/helpers/useQuery";
import { BuildingTooltip } from "../cityview/BuildingTooltip";
import { Component, Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { CairoOption, CairoOptionVariant } from "starknet";
import { useEntityQuery } from "@dojoengine/react";

// 1. Working and fairly smooth minimal lag and good transitions. And the construction OS box is nice
// 2. Graphics are good and the hexagons are well placed

export const isHexOccupied = (col: number, row: number, buildings: any[]) => {
  return buildings.some((building) => building.col === col && building.row === row);
};

const GroundGrid = () => {
  const { hexPosition: globalHex } = useQuery();

  const { playBuildingSound } = useBuildingSound();
  const hexPositions = generateHexPositions();
  const {
    previewBuilding,
    hoveredBuildHex,
    setHoveredBuildHex,
    existingBuildings,
    setExistingBuildings,
    selectedResource,
    setResourceId,
  } = useUIStore((state) => ({
    previewBuilding: state.previewBuilding,
    hoveredBuildHex: state.hoveredBuildHex,
    setHoveredBuildHex: state.setHoveredBuildHex,
    existingBuildings: state.existingBuildings,
    setExistingBuildings: state.setExistingBuildings,
    selectedResource: state.selectedResource,
    setResourceId: state.setResourceId,
  }));
  const { realmEntityId } = useRealmStore();

  const {
    account: { account },
    setup: {
      systemCalls: { create_building },
      components: { Building },
    },
  } = useDojo();

  const models = useGLTF([
    "/models/buildings/castle.glb",
    "/models/buildings/farm.glb",
    // "/models/buildings/fishery.glb",
    "/models/buildings/mine.glb",
    "/models/buildings/stable.glb",
    "/models/buildings/workhut.glb",
    "/models/buildings/archer_range.glb",
    "/models/buildings/barracks.glb",
    "/models/buildings/market.glb",
    "/models/buildings/storehouse.glb",
  ]);

  const handlePlacement = async (col: number, row: number, previewBuilding: BuildingType) => {
    await create_building({
      signer: account,
      entity_id: realmEntityId,
      building_coord: {
        x: col.toString(),
        y: row.toString(),
      },
      building_category: previewBuilding,
      produce_resource_type:
        previewBuilding == BuildingType.Resource && selectedResource
          ? new CairoOption<Number>(CairoOptionVariant.Some, selectedResource)
          : new CairoOption<Number>(CairoOptionVariant.None, 0),
    });
  };

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
      <group rotation={[Math.PI / -2, 0, 0]} position={[0, 2, 0]}>
        <Bvh firstHitOnly>
          {hexPositions.map((hexPosition, index) => (
            <Hexagon
              key={index}
              position={hexPosition}
              onPointerMove={() =>
                previewBuilding && setHoveredBuildHex({ col: hexPosition.col, row: hexPosition.row })
              }
              onClick={() => {
                if (previewBuilding && !isHexOccupied(hexPosition.col, hexPosition.row, existingBuildings)) {
                  handlePlacement(hexPosition.col, hexPosition.row, previewBuilding);
                  playBuildingSound(previewBuilding);
                }
              }}
            />
          ))}
        </Bvh>
      </group>
    </>
  );
};

export const BuiltBuilding = ({
  position,
  onPointerMove,
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

const hexagonGeometry = new THREE.ShapeGeometry(createHexagonShape(HEX_RADIUS));
const mainColor = new THREE.Color(0.21389107406139374, 0.14227265119552612, 0.06926480680704117);
const secondaryColor = mainColor.clone().lerp(new THREE.Color(1, 1, 1), 0.2);

export const Hexagon = ({ position, onClick, onPointerMove }: { position: any; onClick: any; onPointerMove: any }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <group position={[position.x, position.y, position.z]} onPointerMove={onPointerMove} onClick={onClick}>
      <mesh geometry={hexagonGeometry} scale={0.5} position={[0, 0, 0.01]}>
        <meshMatcapMaterial color={secondaryColor} />
      </mesh>
      {showTooltip ? <BuildingTooltip resourceId={10} /> : null}

      <mesh
        geometry={hexagonGeometry}
        // onPointerEnter={(e) => {
        //   e.stopPropagation();
        //   setShowTooltip(true);
        // }}
        // onPointerLeave={(e) => {
        //   e.stopPropagation();
        //   setShowTooltip(false);
        // }}
      >
        <meshMatcapMaterial color={mainColor} />
      </mesh>
    </group>
  );
};

export const generateHexPositions = () => {
  const _color = new THREE.Color("gray");
  const center = { col: 4, row: 4 };
  const addOffset = center.row % 2 === 0 && center.row > 0 ? 0 : 1;
  const radius = 4;
  const positions = [] as any[];
  const normalizedCenter = { col: 4, row: 4 };
  const shifted = { col: center.col - normalizedCenter.col, row: center.row - normalizedCenter.row };
  for (let _row = normalizedCenter.row - radius; _row <= normalizedCenter.row + radius; _row++) {
    const basicCount = 9;
    const decrease = Math.abs(_row - radius);
    const colsCount = basicCount - decrease;
    let startOffset = _row % 2 === 0 ? (decrease > 0 ? Math.floor(decrease / 2) : 0) : Math.floor(decrease / 2);
    if (addOffset > 0 && _row % 2 !== 0) {
      if (center.row < 0 && center.row % 2 === 0) startOffset += 1;
    }
    for (
      let _col = startOffset + normalizedCenter.col - radius;
      _col < normalizedCenter.col - radius + colsCount + startOffset;
      _col++
    ) {
      positions.push({
        ...getUIPositionFromColRow(_col + shifted.col, _row + shifted.row, true),
        z: 0.315,
        color: _color,
        col: _col + shifted.col,
        row: _row + shifted.row,
        startOffset: startOffset,
      });
    }
  }

  return positions;
};

export default GroundGrid;
