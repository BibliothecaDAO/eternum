import * as THREE from "three";
import { createHexagonShape } from "../worldmap/hexagon/HexagonGeometry";
import { FELT_CENTER, HEX_RADIUS } from "../worldmap/hexagon/WorldHexagon";
import { getUIPositionFromColRow } from "../../utils/utils";
import { biomes } from "@bibliothecadao/eternum";
import { Hexagon } from "../../../types";
import { biomeComponents } from "../worldmap/hexagon/HexLayers";
import { useMemo } from "react";

const center = { col: 4, row: 4 };
const hexagonGeometry = new THREE.ExtrudeGeometry(createHexagonShape(HEX_RADIUS), { depth: 2, bevelEnabled: false });

const generateHexPositions = (center: { col: number; row: number }, biome: keyof typeof biomes) => {
  const addOffset = center.row % 2 === 0 && center.row > 0 ? 0 : 1;
  const radius = 4;
  const positions = [] as any[];
  const hexColRows = [] as Hexagon[];
  const borderHexes = [] as Hexagon[];
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
      const { x, y, z } = getUIPositionFromColRow(_col + shifted.col + FELT_CENTER, _row + shifted.row + FELT_CENTER);
      positions.push({
        x,
        y,
        z: !isBorderHex && !["ocean", "deep_ocean"].includes(biome) ? 0.32 + z : 0.32,
        col: _col + shifted.col,
        row: _row + shifted.row,
        startOffset: startOffset,
      });
      if (!isBorderHex) {
        hexColRows.push({ col: _col + shifted.col + FELT_CENTER, row: _row + shifted.row + FELT_CENTER } as Hexagon);
      } else {
        borderHexes.push({ col: _col + shifted.col + FELT_CENTER, row: _row + shifted.row + FELT_CENTER } as Hexagon);
      }
    }
  }

  return { positions, hexColRows, borderHexes };
};

const BigHexBiome = ({ biome }: { biome: keyof typeof biomes }) => {
  const { BiomeComponent, material } = useMemo(() => {
    return {
      BiomeComponent: biomeComponents[biome],
      material: new THREE.MeshMatcapMaterial({ color: new THREE.Color(biomes[biome].color) }),
    };
  }, [biome]);

  const {
    positions: hexPositions,
    hexColRows,
    borderHexes,
  } = useMemo(() => generateHexPositions(center, biome), [biome]);

  const hexesInstancedMesh = useMemo(() => {
    const _tmp = new THREE.InstancedMesh(hexagonGeometry, material, hexPositions.length);
    const _tmpMatrix = new THREE.Matrix4();
    hexPositions.forEach((hexPosition, index) => {
      _tmpMatrix.setPosition(hexPosition.x, hexPosition.y, hexPosition.z);
      _tmp.setMatrixAt(index, _tmpMatrix);
    });
    return _tmp;
  }, [hexPositions, material]);

  return (
    <group rotation={[Math.PI / -2, 0, 0]} position={[0, 0, 0]}>
      <primitive object={hexesInstancedMesh} />
      <group position={[0, 0, 2.01]}>
        <BiomeComponent hexes={hexColRows} zOffsets={!["ocean", "deep_ocean"].includes(biome)} />
        <BiomeComponent hexes={borderHexes} zOffsets={false} />
      </group>
    </group>
  );
};

export default BigHexBiome;
