import * as THREE from "three";
import { createHexagonShape } from "../worldmap/hexagon/HexagonGeometry";
import { getUIPositionFromColRow } from "../../utils/utils";
import { biomes, getNeighborHexes } from "@bibliothecadao/eternum";
import { Hexagon } from "../../../types";
import { biomeComponents } from "../worldmap/hexagon/HexLayers";
import { useMemo } from "react";
import { HEX_RADIUS } from "@/ui/config";

const hexagonGeometry = new THREE.ExtrudeGeometry(createHexagonShape(HEX_RADIUS), { depth: 2, bevelEnabled: false });

const generateHexPositions = (biome: keyof typeof biomes, flat: boolean) => {
  const _color = new THREE.Color("gray");
  const center = { col: 10, row: 10 };
  const RADIUS = 4;
  const positions: { x: number; y: number; z: number; color: THREE.Color; col: number; row: number }[] = [];
  const hexColRows: any[] = [];
  const borderHexes: any[] = [];
  const existingPositions = new Set<string>();

  const addPosition = (col: number, row: number, x: number, y: number, z: number, isBorder: boolean) => {
    const key = `${col},${row}`;
    if (!existingPositions.has(key)) {
      existingPositions.add(key);
      positions.push({ x, y, z, color: _color, col, row });
      if (isBorder) {
        borderHexes.push({ x, y, z });
      } else {
        hexColRows.push({ x, y, z });
      }
    }
  };

  const isFlat = flat || ["ocean", "deep_ocean"].includes(biome);

  for (let i = 0; i < RADIUS; i++) {
    if (i === 0) {
      const { x, y, z } = getUIPositionFromColRow(center.col, center.row, true);
      const adjustedZ = !isFlat ? 0.32 + z : 0.32;
      addPosition(center.col, center.row, x, y, adjustedZ, false);

      getNeighborHexes(center.col, center.row).forEach((neighbor) => {
        const { x, y, z } = getUIPositionFromColRow(neighbor.col, neighbor.row, true);
        const adjustedZ = !isFlat ? 0.32 + z : 0.32;
        addPosition(neighbor.col, neighbor.row, x, y, adjustedZ, false);
      });
    } else {
      positions.forEach((position) => {
        getNeighborHexes(position.col, position.row).forEach((neighbor) => {
          const { x, y, z } = getUIPositionFromColRow(neighbor.col, neighbor.row, true);
          const isBorderHex = i === RADIUS - 1;
          const adjustedZ = !isBorderHex && !isFlat ? 0.32 + z : 0.32;
          addPosition(neighbor.col, neighbor.row, x, y, adjustedZ, isBorderHex);
        });
      });
    }
  }

  return { positions, hexColRows, borderHexes };
};

const defaultBiome = "snow";
const BigHexBiome = ({ biome, flat }: { biome: keyof typeof biomes; flat: boolean }) => {
  const { BiomeComponent, material } = useMemo(() => {
    const _biome = biome && biomes[biome] ? biome : defaultBiome;

    return {
      BiomeComponent: biomeComponents[_biome],
      material: new THREE.MeshPhongMaterial({ color: new THREE.Color(biomes[_biome]!.color) }),
    };
  }, [biome]);

  const {
    positions: hexPositions,
    hexColRows,
    borderHexes,
  } = useMemo(() => generateHexPositions(biome, flat), [biome]);

  const isFlat = flat || ["ocean", "deep_ocean"].includes(biome);

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
        <BiomeComponent hexes={hexColRows} zOffsets={!isFlat} />
        <BiomeComponent hexes={borderHexes} zOffsets={false} />
      </group>
    </group>
  );
};

export default BigHexBiome;
