import useUIStore from "../../../hooks/store/useUIStore";
import * as THREE from "three";
import { createHexagonShape } from "../../worldmap/hexagon/HexagonGeometry";
import { HEX_RADIUS } from "../../worldmap/hexagon/WorldHexagon";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { Html } from "@react-three/drei";

const HexBuildGrid = () => {
  const hexagonGeometry = new THREE.ShapeGeometry(createHexagonShape(HEX_RADIUS));

  const _color = new THREE.Color("gray");
  const center = { col: 4, row: 4 };

  const generateHexPositions = (center: { col: number; row: number }) => {
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

  const hexPositions = generateHexPositions(center);
  const buildMode = useUIStore((state) => state.buildMode);
  const hoveredBuildHex = useUIStore((state) => state.hoveredBuildHex);
  const setHoveredBuildHex = useUIStore((state) => state.setHoveredBuildHex);
  const builtCastles = useUIStore((state) => state.builtCastles);
  const setBuiltCastles = useUIStore((state) => state.setBuiltCastles);

  return (
    <group rotation={[Math.PI / -2, 0, 0]} position={[0, 2, 0]}>
      {hexPositions.map((hexPosition, index) => {
        return (
          <group
            key={index}
            position={[hexPosition.x, hexPosition.y, hexPosition.z]}
            onPointerMove={(e) => {
              if (buildMode) {
                setHoveredBuildHex({ col: hexPosition.col, row: hexPosition.row });
              }
            }}
            onClick={() => {
              if (buildMode) {
                setBuiltCastles([...builtCastles, { col: hexPosition.col, row: hexPosition.row }]);
              }
            }}
          >
            <mesh geometry={hexagonGeometry}>
              <meshMatcapMaterial
                color={
                  hoveredBuildHex.col === hexPosition.col && hoveredBuildHex.row === hexPosition.row && buildMode
                    ? "limegreen"
                    : _color
                }
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

export default HexBuildGrid;
