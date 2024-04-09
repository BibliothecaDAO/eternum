import useUIStore from "../../../hooks/store/useUIStore";
import * as THREE from "three";
import { createHexagonShape } from "../worldmap/hexagon/HexagonGeometry";
import { HEX_RADIUS } from "../worldmap/hexagon/WorldHexagon";
import { getEntityIdFromKeys, getUIPositionFromColRow } from "../../utils/utils";
import { Html, Merged, useGLTF } from "@react-three/drei";
import { useCallback } from "react";
import { useBuildingSound } from "../../../hooks/useUISound";
import { useDojo } from "@/hooks/context/DojoContext";
import useRealmStore from "@/hooks/store/useRealmStore";
import { BuildingType, ResourcesIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { useQuery } from "@/hooks/helpers/useQuery";

export const isHexOccupied = (col: number, row: number, buildings: any[]) => {
  return buildings.some((building) => building.col === col && building.row === row);
};

const GroundGrid = () => {
  const { hexPosition: globalHex } = useQuery();

  const { playBuildingSound } = useBuildingSound();
  const hexPositions = generateHexPositions();
  const { previewBuilding, hoveredBuildHex, setHoveredBuildHex, existingBuildings, setExistingBuildings } = useUIStore(
    (state) => ({
      previewBuilding: state.previewBuilding,
      hoveredBuildHex: state.hoveredBuildHex,
      setHoveredBuildHex: state.setHoveredBuildHex,
      existingBuildings: state.existingBuildings,
      setExistingBuildings: state.setExistingBuildings,
    }),
  );
  const { realmEntityId } = useRealmStore();

  const {
    account: { account },
    setup: {
      systemCalls: { create_building },
    },
  } = useDojo();

  const handlePlacement = async (col: number, row: number) => {
    await create_building({
      signer: account,
      entity_id: realmEntityId,
      building_coord: {
        x: col.toString(),
        y: row.toString(),
      },
      building_category: BuildingType.Farm,
      produce_resource_type: 1,
    });
  };
  //
  return (
    <>
      {hexPositions.map((hexPosition, index) => (
        <BuiltBuilding
          key={index}
          outerPosition={globalHex}
          position={hexPosition}
          onPointerMove={() => previewBuilding && setHoveredBuildHex({ col: hexPosition.col, row: hexPosition.row })}
          onClick={() => {
            if (previewBuilding && !isHexOccupied(hexPosition.col, hexPosition.row, existingBuildings)) {
              handlePlacement(hexPosition.col, hexPosition.row);
              setExistingBuildings([
                ...existingBuildings,
                { col: hexPosition.col, row: hexPosition.row, type: previewBuilding },
              ]);
              playBuildingSound(previewBuilding);
            }
          }}
        />
      ))}
      <group rotation={[Math.PI / -2, 0, 0]} position={[0, 2, 0]}>
        {hexPositions.map((hexPosition, index) => (
          <Hexagon
            key={index}
            position={hexPosition}
            onPointerMove={() => previewBuilding && setHoveredBuildHex({ col: hexPosition.col, row: hexPosition.row })}
            onClick={() => {
              if (previewBuilding && !isHexOccupied(hexPosition.col, hexPosition.row, existingBuildings)) {
                handlePlacement(hexPosition.col, hexPosition.row);
                // setExistingBuildings([
                //   ...existingBuildings,
                //   { col: hexPosition.col, row: hexPosition.row, type: previewBuilding },
                // ]);
                playBuildingSound(previewBuilding);
              }
            }}
          />
        ))}
      </group>
    </>
  );
};

export const BuiltBuilding = ({
  outerPosition,
  position,
  onPointerMove,
  onClick,
}: {
  outerPosition: { col: number; row: number };
  position: any;
  onPointerMove: any;
  onClick: any;
}) => {
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

  const {
    setup: {
      components: { Building },
    },
  } = useDojo();

  const builtBuilding = useComponentValue(
    Building,
    getEntityIdFromKeys([
      BigInt(outerPosition.col),
      BigInt(outerPosition.row),
      BigInt(position.col),
      BigInt(position.row),
    ]),
  );

  const { x, y } = getUIPositionFromColRow(position.col, position.row, true);

  if (builtBuilding) return <primitive scale={3} object={models[2].scene.clone()} position={[x, 2.33, -y]} />;
};

export const Hexagon = ({ position, onPointerMove, onClick }: { position: any; onPointerMove: any; onClick: any }) => {
  const hexagonGeometry = new THREE.ShapeGeometry(createHexagonShape(HEX_RADIUS));
  const mainColor = new THREE.Color(0.21389107406139374, 0.14227265119552612, 0.06926480680704117);
  const secondaryColor = mainColor.clone().lerp(new THREE.Color(1, 1, 1), 0.2);

  return (
    <group position={[position.x, position.y, position.z]} onPointerMove={onPointerMove} onClick={onClick}>
      <mesh geometry={hexagonGeometry} scale={0.5} position={[0, 0, 0.01]}>
        <meshMatcapMaterial color={secondaryColor} />
      </mesh>
      <mesh geometry={hexagonGeometry}>
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
