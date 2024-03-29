import * as THREE from "three";
import { createHexagonShape } from "../../worldmap/hexagon/HexagonGeometry";
import { HEX_RADIUS } from "../../worldmap/hexagon/WorldHexagon";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { Instances, Instance } from "@react-three/drei";
import { biomes } from "@bibliothecadao/eternum";

const BigHexBiome = ({ biome }: { biome: keyof typeof biomes }) => {
  const biomeData = biomes[biome];
  const hexagonGeometry = new THREE.ExtrudeGeometry(createHexagonShape(HEX_RADIUS), { depth: 2, bevelEnabled: false });
  const _color = new THREE.Color(biomeData.color);
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
        // Randomly increase z for inner hexes, disable it if hex is placed on border
        const isBorderHex =
          _row === normalizedCenter.row - radius ||
          _row === normalizedCenter.row + radius ||
          _col === startOffset + normalizedCenter.col - radius ||
          _col === normalizedCenter.col - radius + colsCount + startOffset - 1;
        const zIncrease = !isBorderHex ? Math.random() * 2 : 0;
        positions.push({
          ...getUIPositionFromColRow(_col + shifted.col, _row + shifted.row, true),
          z: 0.32 + zIncrease,
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

  return (
    <group rotation={[Math.PI / -2, 0, 0]} position={[0, 0, 0]}>
      <Instances geometry={hexagonGeometry} material={new THREE.MeshMatcapMaterial({ color: _color })}>
        {hexPositions.map((hexPosition, index) => (
          <Instance key={index} position={[hexPosition.x, hexPosition.y, hexPosition.z]} />
        ))}
      </Instances>
    </group>
  );
};

export default BigHexBiome;
