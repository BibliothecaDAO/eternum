import useUIStore from "../../../hooks/store/useUIStore";
import * as THREE from "three";
import { createHexagonShape } from "../../worldmap/hexagon/HexagonGeometry";
import { HEX_RADIUS } from "../../worldmap/hexagon/WorldHexagon";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { Html } from "@react-three/drei";
import { useCallback } from "react";

export const isHexOccupied = (col: number, row: number, builtCastles: any[]) => {
  return builtCastles.some((castle) => castle.col === col && castle.row === row);
};

const HexBuildGrid = () => {
  const hexagonGeometry = new THREE.ShapeGeometry(createHexagonShape(HEX_RADIUS));

  const hexPositions = generateHexPositions();
  const { buildMode, hoveredBuildHex, setHoveredBuildHex, builtCastles, setBuiltCastles } = useUIStore((state) => ({
    buildMode: state.buildMode,
    hoveredBuildHex: state.hoveredBuildHex,
    setHoveredBuildHex: state.setHoveredBuildHex,
    builtCastles: state.builtCastles,
    setBuiltCastles: state.setBuiltCastles,
  }));

  const getColorForHexagon = (hexPosition: any, buildMode: any, hoveredBuildHex: any) => {
    if (buildMode) {
      if (hoveredBuildHex.col === hexPosition.col && hoveredBuildHex.row === hexPosition.row) {
        if (isHexOccupied(hexPosition.col, hexPosition.row, builtCastles)) {
          return "red";
        }
        return "limegreen";
      }
    }
    return "gray";
  };

  return (
    <group rotation={[Math.PI / -2, 0, 0]} position={[0, 2, 0]}>
      {hexPositions.map((hexPosition, index) => (
        <Hexagon
          key={index}
          position={hexPosition}
          geometry={hexagonGeometry}
          color={getColorForHexagon(hexPosition, buildMode, hoveredBuildHex)}
          onPointerMove={() => buildMode && setHoveredBuildHex({ col: hexPosition.col, row: hexPosition.row })}
          onClick={() =>
            buildMode &&
            !isHexOccupied(hexPosition.col, hexPosition.row, builtCastles) &&
            setBuiltCastles([...builtCastles, { col: hexPosition.col, row: hexPosition.row }])
          }
        />
      ))}
    </group>
  );
};

const Hexagon = ({
  position,
  geometry,
  color,
  onPointerMove,
  onClick,
}: {
  position: any;
  geometry: any;
  color: any;
  onPointerMove: any;
  onClick: any;
}) => (
  <mesh
    position={[position.x, position.y, position.z]}
    onPointerMove={onPointerMove}
    onClick={onClick}
    geometry={geometry}
  >
    <meshMatcapMaterial color={color} />
  </mesh>
);

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
        z: 0.32,
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
