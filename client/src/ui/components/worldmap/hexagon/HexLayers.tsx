import { DEPTH, FELT_CENTER, HEX_RADIUS } from "@/ui/config";
import { neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { Bvh } from "@react-three/drei";
import { throttle } from "lodash";
import { useCallback, useMemo } from "react";
import * as THREE from "three";
import { Color, InstancedMesh, Matrix4 } from "three";
import { useLocation } from "wouter";
import useUIStore from "../../../../hooks/store/useUIStore";
import { Hexagon } from "../../../../types/index";
import { getColRowFromUIPosition, getUIPositionFromColRow } from "../../../utils/utils";
import { BeachBiome } from "../../models/biomes/BeachBiome";
import { DeciduousForestBiome } from "../../models/biomes/DeciduousForestBiome";
import { DeepOceanBiome } from "../../models/biomes/DeepOceanBiome";
import { DesertBiome } from "../../models/biomes/DesertBiome";
import { GrasslandBiome } from "../../models/biomes/GrasslandBiome";
import { HexGrid } from "../../models/biomes/HexGrid";
import { OceanBiome } from "../../models/biomes/OceanBiome";
import { ScorchedBiome } from "../../models/biomes/ScorchedBiome";
import { ShrublandBiome } from "../../models/biomes/ShrublandBiome";
import { SnowBiome } from "../../models/biomes/SnowBiome";
import { SubtropicalDesertBiome } from "../../models/biomes/SubtropicalDesertBiome";
import { TaigaBiome } from "../../models/biomes/TaigaBiome";
import { TemperateDesertBiome } from "../../models/biomes/TemperateDesertBiome";
import { TemperateRainforestBiome } from "../../models/biomes/TemperateRainforestBiome";
import { TropicalRainforestBiome } from "../../models/biomes/TropicalRainforestBiome";
import { TropicalSeasonalForestBiome } from "../../models/biomes/TropicalSeasonalForestBiome";
import { TundraBiome } from "../../models/biomes/TundraBiome.js";
import { createHexagonGeometry } from "./HexagonGeometry";
import { useEventHandlers } from "./useEventHandlers";
import { getPositionsAtIndex } from "./utils";

type HexagonGridProps = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  explored: Map<number, Set<number>>;
};

type BiomeComponentType = React.ComponentType<{ hexes: Hexagon[]; zOffsets?: boolean }>;

interface BiomeComponentsMap {
  [key: string]: BiomeComponentType;
}

export const biomeComponents: BiomeComponentsMap = {
  snow: SnowBiome,
  bare: DesertBiome,
  grassland: GrasslandBiome,
  taiga: TaigaBiome,
  ocean: OceanBiome,
  deep_ocean: DeepOceanBiome,
  temperate_desert: TemperateDesertBiome,
  beach: BeachBiome,
  scorched: ScorchedBiome,
  shrubland: ShrublandBiome,
  subtropical_desert: SubtropicalDesertBiome,
  temperate_deciduous_forest: DeciduousForestBiome,
  tropical_rain_forest: TropicalRainforestBiome,
  tropical_seasonal_forest: TropicalSeasonalForestBiome,
  tundra: TundraBiome,
  temperate_rain_forest: TemperateRainforestBiome,
};

const color = new Color();

export const BiomesGrid = ({ startRow, endRow, startCol, endCol, explored }: HexagonGridProps) => {
  const hexData = useUIStore((state) => state.hexData);

  const { group } = useMemo(() => {
    if (!hexData) return { group: [], colors: [] };

    return {
      group: hexData.filter(({ col, row }) => {
        const adjustedCol = col - FELT_CENTER;
        const adjustedRow = row - FELT_CENTER;
        return adjustedCol >= startCol && adjustedCol <= endCol && adjustedRow >= startRow && adjustedRow <= endRow;
      }),
      colors: [],
    };
  }, [startRow, endRow, startCol, endCol, hexData]);

  const biomeHexes = useMemo(() => {
    const biomesAccumulator = Object.keys(biomeComponents).reduce((acc: any, biome) => {
      acc[biome] = [];
      return acc;
    }, {});

    // Function to safely add a hex to the accumulator without duplicates
    const addHexToBiomeAccumulator = (hex: any) => {
      if (!biomesAccumulator[hex.biome].includes(hex)) {
        biomesAccumulator[hex.biome].push(hex);
      }
    };

    explored.forEach((rowSet, col) => {
      if (col < startCol || col > endCol) return;
      rowSet.forEach((row) => {
        if (row < startRow || row > endRow) return;
        const tmpCol = col + FELT_CENTER;
        const tmpRow = row + FELT_CENTER;
        const hexIndex = group.findIndex((hex) => hex.col === tmpCol && hex.row === tmpRow);
        if (group[hexIndex]) {
          const { x, y, z } = getUIPositionFromColRow(group[hexIndex].col, group[hexIndex].row);
          addHexToBiomeAccumulator({ ...group[hexIndex], x, y, z });
        }
      });
    });

    // Please dont remove until mainnet
    // Uncomment to enable graphics test with all explored hexes
    //
    // Object.keys(biomeComponents).forEach((biome) => {
    //   biomesAccumulator[biome] = group.filter((hex) => hex.biome === biome);
    //   biomesAccumulator[biome] = biomesAccumulator[biome].map((hex: any) => {
    //     const { x, y, z } = getUIPositionFromColRow(hex.col, hex.row);
    //     return { ...hex, x, y, z };
    //   });
    // });

    return biomesAccumulator;
  }, [explored]);

  return (
    <>
      {Object.entries(biomeHexes).map(([biome, hexes]: any) => {
        const BiomeComponent = biomeComponents[biome];
        return hexes.length ? <BiomeComponent key={biome} hexes={hexes} /> : null;
      })}
      <HexGrid hexes={group} />
    </>
  );
};

const hexagonGeometry = createHexagonGeometry(HEX_RADIUS, DEPTH);
const hexTransparentMaterial = new THREE.MeshStandardMaterial({
  color: "green",
  vertexColors: false,
  transparent: true,
  opacity: 0, // Start fully transparent
  wireframe: false,
});

const hexMaterial = new THREE.MeshStandardMaterial({
  color: "green",
  vertexColors: false,
  transparent: true,
  opacity: 0.4, // Start fully transparent
  wireframe: false,
});

export const HexagonGrid = ({ startRow, endRow, startCol, endCol, explored }: HexagonGridProps) => {
  const hexData = useUIStore((state) => state.hexData);
  const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);
  const moveCameraToColRow = useUIStore((state) => state.moveCameraToColRow);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  const { hoverHandler, clickHandler, mouseOutHandler } = useEventHandlers(explored);

  const { group } = useMemo(() => {
    if (!hexData) return { group: [], colors: [] };
    const filteredGroup = hexData.filter((hex) => {
      const col = hex.col - FELT_CENTER;
      const row = hex.row - FELT_CENTER;
      return col >= startCol && col <= endCol && row >= startRow && row <= endRow;
    });

    return { group: filteredGroup };
  }, [startRow, endRow, startCol, endCol, hexData]);

  const { revealed: revealedHexes, borders } = useMemo(() => {
    const revealed: Hexagon[] = [];
    const borders: Hexagon[] = [];
    explored.forEach((rowSet, col) => {
      if (col < startCol || col > endCol) return;
      rowSet.forEach((row) => {
        if (row < startRow || row > endRow) return;
        const tmpCol = col + FELT_CENTER;
        const tmpRow = row + FELT_CENTER;
        const hexIndex = group.findIndex((hex) => hex.col === tmpCol && hex.row === tmpRow);
        if (group[hexIndex]) {
          revealed.push(group[hexIndex]);
        }
      });
    });
    revealed.forEach((hex) => {
      const neighborOffsets = hex.row % 2 === 0 ? neighborOffsetsEven : neighborOffsetsOdd;
      neighborOffsets.forEach((neighbor: { i: number; j: number; direction: number }) => {
        const tmpCol = hex.col + neighbor.i;
        const tmpRow = hex.row + neighbor.j;
        const ind = group.findIndex((hex) => hex.col === tmpCol && hex.row === tmpRow);
        if (
          group[ind] &&
          !revealed.some((hex) => hex.col === tmpCol && hex.row === tmpRow) &&
          !borders.some((hex) => hex.col === tmpCol && hex.row === tmpRow)
        ) {
          borders.push(group[ind]);
        }
      });
    });
    return { revealed, borders };
  }, [group, explored]);

  // Create the mesh only once when the component is mounted
  const mesh: InstancedMesh = useMemo(() => {
    const instancedMesh = new InstancedMesh(hexagonGeometry, hexTransparentMaterial, revealedHexes.length);
    let idx = 0;
    let matrix = new Matrix4();

    revealedHexes.forEach((hex) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);
      matrix.setPosition(x, y, 0.31);

      instancedMesh.setMatrixAt(idx, matrix);
      instancedMesh.setColorAt(idx, color.setRGB(0.4, 0.4, 0.4));

      idx++;
    });

    instancedMesh.computeBoundingSphere();
    instancedMesh.frustumCulled = true;
    return instancedMesh;
  }, [revealedHexes]);

  const borderMesh: InstancedMesh = useMemo(() => {
    const instancedMesh = new InstancedMesh(hexagonGeometry, hexMaterial, borders.length);
    let idx = 0;
    let matrix = new Matrix4();
    borders.forEach((hex) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);
      matrix.setPosition(x, y, 0.31);
      instancedMesh.setMatrixAt(idx, matrix);
      instancedMesh.setColorAt(idx, color.setRGB(0.4, 0.4, 0.4));
      idx++;
    });
    instancedMesh.computeBoundingSphere();
    instancedMesh.frustumCulled = true;
    return instancedMesh;
  }, [borders]);

  const throttledHoverHandler = useMemo(() => throttle(hoverHandler, 50), []);

  const [_, setLocation] = useLocation();

  const goToHex = useCallback(
    (e: any) => {
      const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
      if (!intersect) return;
      const instanceId = intersect.instanceId;
      const mesh = intersect.object;
      const pos = getPositionsAtIndex(mesh, instanceId);
      if (!pos) return;
      const colRow = getColRowFromUIPosition(pos.x, pos.y);
      moveCameraToColRow(colRow.col, colRow.row, 1.5, true);
      setTimeout(() => {
        setIsLoadingScreenEnabled(true);
      }, 1000);
      setTimeout(() => {
        setLocation(`/hex?col=${colRow.col}&row=${colRow.row}`);
      }, 1300);
    },
    [moveCameraToTarget],
  );

  return (
    <Bvh firstHitOnly>
      <group onPointerEnter={(e) => throttledHoverHandler(e)} onClick={clickHandler} onPointerOut={mouseOutHandler}>
        <primitive object={mesh} onDoubleClick={goToHex} />
        <primitive object={borderMesh} onDoubleClick={goToHex} />
      </group>
    </Bvh>
  );
};
