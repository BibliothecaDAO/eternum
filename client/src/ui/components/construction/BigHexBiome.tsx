import * as THREE from "three";
import { createHexagonShape } from "../worldmap/hexagon/HexagonGeometry";
import { FELT_CENTER, HEX_RADIUS } from "../worldmap/hexagon/WorldHexagon";
import { getUIPositionFromColRow } from "../../utils/utils";
import { biomes, getNeighborHexes } from "@bibliothecadao/eternum";
import { Hexagon } from "../../../types";
import { biomeComponents } from "../worldmap/hexagon/HexLayers";
import { useMemo } from "react";

const hexagonGeometry = new THREE.ExtrudeGeometry(createHexagonShape(HEX_RADIUS), { depth: 2, bevelEnabled: false });

const generateHexPositions = (biome: keyof typeof biomes) => {
  const _color = new THREE.Color("gray");
  const center = { col: 10, row: 10 };
  const RADIUS = 4;
  const positions = [] as any[];
  const hexColRows = [] as Hexagon[];
  const borderHexes = [] as Hexagon[];
  for (let i = 0; i < RADIUS; i++) {
    if (i === 0) {
      const { x, y, z } = getUIPositionFromColRow(center.col, center.row, true);

      positions.push({
        x,
        y,
        z: !["ocean", "deep_ocean"].includes(biome) ? 0.32 + z : 0.32,
        color: _color,
        col: center.col,
        row: center.row,
      });
      hexColRows.push({
        col: center.col + FELT_CENTER,
        row: center.row + FELT_CENTER,
      } as Hexagon);

      getNeighborHexes(center.col, center.row).forEach((neighbor) => {
        const { x, y, z } = getUIPositionFromColRow(neighbor.col, neighbor.row, true);

        positions.push({
          x,
          y,
          z: !["ocean", "deep_ocean"].includes(biome) ? 0.32 + z : 0.32,
          color: _color,
          col: neighbor.col,
          row: neighbor.row,
        });
        hexColRows.push({
          col: neighbor.col + FELT_CENTER,
          row: neighbor.row + FELT_CENTER,
        } as Hexagon);
      });
    } else {
      positions.forEach((position) => {
        getNeighborHexes(position.col, position.row).forEach((neighbor) => {
          if (!positions.find((p) => p.col === neighbor.col && p.row === neighbor.row)) {
            const isBorderHex = i === 3;
            const { x, y, z } = getUIPositionFromColRow(neighbor.col, neighbor.row, true);
            positions.push({
              x,
              y,
              z: !isBorderHex && !["ocean", "deep_ocean"].includes(biome) ? 0.32 + z : 0.32,
              color: _color,
              col: neighbor.col,
              row: neighbor.row,
            });
            if (isBorderHex) {
              borderHexes.push({
                col: neighbor.col + FELT_CENTER,
                row: neighbor.row + FELT_CENTER,
              } as Hexagon);
            } else {
              hexColRows.push({
                col: neighbor.col + FELT_CENTER,
                row: neighbor.row + FELT_CENTER,
              } as Hexagon);
            }
          }
        });
      });
    }
  }

  return { positions, hexColRows, borderHexes };
};

const BigHexBiome = ({ biome }: { biome: keyof typeof biomes }) => {
  const { BiomeComponent, material } = useMemo(() => {
    return {
      BiomeComponent: biomeComponents[biome],
      material: new THREE.MeshMatcapMaterial({ color: new THREE.Color(biomes[biome]?.color) }),
    };
  }, [biome]);

  const { positions: hexPositions, hexColRows, borderHexes } = useMemo(() => generateHexPositions(biome), [biome]);

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
