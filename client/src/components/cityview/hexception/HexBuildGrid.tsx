import useUIStore from "../../../hooks/store/useUIStore";
import * as THREE from "three";
import { createHexagonShape } from "../../worldmap/hexagon/HexagonGeometry";
import { HEX_RADIUS } from "../../worldmap/hexagon/WorldHexagon";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { Html, Merged, useGLTF } from "@react-three/drei";
import { useCallback } from "react";

export const isHexOccupied = (col: number, row: number, buildings: any[]) => {
  return buildings.some((building) => building.col === col && building.row === row);
};

const HexBuildGrid = () => {
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

  return (
    <group rotation={[Math.PI / -2, 0, 0]} position={[0, 2, 0]}>
      {hexPositions.map((hexPosition, index) => (
        <Hexagon
          key={index}
          position={hexPosition}
          onPointerMove={() => previewBuilding && setHoveredBuildHex({ col: hexPosition.col, row: hexPosition.row })}
          onClick={() =>
            previewBuilding &&
            !isHexOccupied(hexPosition.col, hexPosition.row, existingBuildings) &&
            setExistingBuildings([
              ...existingBuildings,
              { col: hexPosition.col, row: hexPosition.row, type: previewBuilding },
            ])
          }
        />
      ))}
    </group>
  );
};

const Hexagon = ({ position, onPointerMove, onClick }: { position: any; onPointerMove: any; onClick: any }) => {
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

const generateHexPositions = () => {
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

export default HexBuildGrid;
