import { createHexagonGeometry, createHexagonShape } from "./components/three/HexagonBackground";
import { useEffect, useMemo, useState } from "react";
// @ts-ignore
import { Flags } from "../../components/worldmap/Flags.jsx";
import { Color, InstancedMesh, Matrix4, Vector3 } from "three";
import useUIStore from "../../hooks/store/useUIStore";
import { useDojo } from "../../DojoContext";
import { Subscription } from "rxjs";
import { getColRowFromUIPosition, getUIPositionFromColRow } from "../../utils/utils";
import { MyCastles, OtherCastles } from "./Castles";
import { Hyperstructures } from "./Hyperstructures";
import { biomes } from "@bibliothecadao/eternum";
import { throttle } from "lodash";
import * as THREE from "three";

export const DEPTH = 10;
export const HEX_RADIUS = 3;

const BIOMES = biomes as Record<string, { color: string; depth: number }>;

export interface Hexagon {
  idx: number;
  col: number;
  row: number;
  biome: string;
  explored: boolean | undefined;
  // address
  exploredBy: bigint | undefined;
}

type HexagonGridProps = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  explored: Map<number, Set<number>>;
};

const color = new Color();

export const HexagonGrid = ({ startRow, endRow, startCol, endCol, explored }: HexagonGridProps) => {
  const hexData = useUIStore((state) => state.hexData);

  const { group, colors } = useMemo(() => {
    if (!hexData) return { group: [], colors: [] };
    const filteredGroup = hexData.filter((hex) => {
      const col = hex.col - 2147483647;
      const row = hex.row - 2147483647;
      return col >= startCol && col <= endCol && row >= startRow && row <= endRow;
    });

    let colorValues: number[] = [];
    let idx = 0;

    // filteredGroup.forEach((hex) => {
    //   // const color = new Color("#202124");
    //   color.setStyle(BIOMES[hex.biome].color);
    //   const grayScaleColor = color; //getGrayscaleColor(color);
    //   // color.toArray(colorValues, idx * 3);
    //   grayScaleColor.toArray(colorValues, idx * 3);
    //   idx++;
    // });

    return { group: filteredGroup, colors: colorValues };
  }, [startRow, endRow, startCol, endCol, HEX_RADIUS, hexData]);

  // Create the mesh only once when the component is mounted
  const mesh: InstancedMesh = useMemo(() => {
    const hexagonGeometry = createHexagonGeometry(HEX_RADIUS, DEPTH);
    const hexMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: false,
      wireframe: false,
    });

    const instancedMesh = new InstancedMesh(hexagonGeometry, hexMaterial, group.length);
    let idx = 0;
    let matrix = new Matrix4();
    group.forEach((hex) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);
      // set the z position with math.random to have a random height
      matrix.setPosition(x, y, BIOMES[hex.biome].depth * 10);
      // set height of hex
      // matrix.setPosition(x, y, BIOMES[hex.biome].depth);

      instancedMesh.setMatrixAt(idx, matrix);

      color.setStyle(BIOMES[hex.biome].color);
      const luminance = getGrayscaleColor(color);
      color.setRGB(luminance, luminance, luminance);
      instancedMesh.setColorAt(idx, color);
      idx++;
    });

    // const colorAttribute = new InstancedBufferAttribute(new Float32Array(colors), 3);
    // instancedMesh.geometry.setAttribute("color", colorAttribute);
    instancedMesh.computeBoundingSphere();
    instancedMesh.frustumCulled = true;
    return instancedMesh;
  }, [group, colors]);

  useEffect(() => {
    explored.forEach((rowSet, col) => {
      if (col < startCol || col > endCol) return;
      rowSet.forEach((row) => {
        if (row < startRow || row > endRow) return;
        const tmpCol = col + 2147483647;
        const tmpRow = row + 2147483647;
        const hexIndex = group.findIndex((hex) => hex.col === tmpCol && hex.row === tmpRow);
        if (group[hexIndex] && mesh) {
          color.setStyle(BIOMES[group[hexIndex].biome].color);
          mesh.setColorAt(hexIndex, color);
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
      });
    });
  }, [startRow, startCol, endRow, endCol, explored, group, mesh]);

  return (
    <>
      <primitive object={mesh} />
    </>
  );
};

export const WorldMap = () => {
  const {
    setup: {
      updates: {
        eventUpdates: { exploreMapEvents },
      },
    },
  } = useDojo();

  const hexData = useUIStore((state) => state.hexData);
  const setHexData = useUIStore((state) => state.setHexData);

  useEffect(() => {
    fetch("/jsons/hexData.json")
      .then((response) => response.json())
      .then((data) => setHexData(data as Hexagon[]));
  }, []);

  const rows = 300;
  const cols = 500;

  // @dev: in case we want to use multiple smaller mesh instances
  const hexagonGrids = useMemo(() => {
    const hexagonGrids = [];
    for (let i = 0; i < rows; i += 25) {
      const startRow = i;
      const endRow = startRow + 25;
      for (let j = 0; j < cols; j += 25) {
        const startCol = j;
        const endCol = startCol + 25;
        hexagonGrids.push({ startRow, endRow, startCol, endCol });
      }
    }
    return hexagonGrids;
  }, []);

  const hexagonGeometry = new THREE.ShapeGeometry(createHexagonShape(HEX_RADIUS));
  const [highlightPosition, setHighlightPosition] = useState<[number, number, number]>([0, 0, 0]);

  const hoverHandler = (e: any) => {
    const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
    if (intersect) {
      const instanceId = intersect.instanceId;
      const mesh = intersect.object;
      const pos = getPositionsAtIndex(mesh, instanceId);
      if (pos) {
        setHighlightPosition([pos.x, -pos.y, pos.z]);
        //mesh.setColorAt(instanceId, color.setHex(0xffffff));
        //mesh.instanceColor.needsUpdate = true;
      }
    }
  };

  const setClickedHex = useUIStore((state) => state.setClickedHex);

  const clickHandler = (e: any) => {
    const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
    if (intersect) {
      const instanceId = intersect.instanceId;
      const mesh = intersect.object;
      const pos = getPositionsAtIndex(mesh, instanceId);
      if (pos) {
        const { col, row } = getColRowFromUIPosition(pos.x, pos.y);
        setClickedHex({ col, row, hexIndex: instanceId });
        //change color
      }
    }
  };

  const throttledHoverHandler = useMemo(() => throttle(hoverHandler, 50), []);
  const flatMode = localStorage.getItem("flatMode");
  const [exploredHexes, setExploredHexes] = useState<Map<number, Set<number>>>(new Map());

  // use effect to change the color of the selected hex if it's been successfuly explored
  useEffect(() => {
    let subscription: Subscription | undefined;

    const subscribeToExploreEvents = async () => {
      const observable = await exploreMapEvents();
      const sub = observable.subscribe((event) => {
        if (event && hexData) {
          const col = Number(event.keys[2]) - 2147483647;
          const row = Number(event.keys[3]) - 2147483647;
          setExploredHexes((prev) => {
            const newMap = new Map(prev);
            const rowSet = newMap.get(col) || new Set();
            rowSet.add(row);
            newMap.set(col, rowSet);
            return newMap;
          });
        }
      });
      subscription = sub;
    };
    subscribeToExploreEvents();

    return () => {
      subscription?.unsubscribe();
    };
  }, [hexData]);

  return (
    <group onPointerEnter={(e) => throttledHoverHandler(e)}>
      <mesh rotation={[Math.PI / -2, 0, 0]} frustumCulled={true}>
        {hexagonGrids.map((grid, index) => {
          return (
            <group onClick={clickHandler} key={index}>
              <HexagonGrid {...grid} explored={exploredHexes} />
            </group>
          );
        })}
      </mesh>
      <mesh
        geometry={hexagonGeometry}
        rotation={[Math.PI / -2, 0, 0]}
        position={[highlightPosition[0], highlightPosition[2] + 10.3, highlightPosition[1]]}
      >
        <meshMatcapMaterial color={0xffffff} transparent opacity={0.75} />
      </mesh>
      {hexData && <MyCastles hexData={hexData} />}
      {hexData && <OtherCastles hexData={hexData} />}
      {hexData && <Hyperstructures hexData={hexData} />}
      <Flags></Flags>
    </group>
  );
};

const matrix = new Matrix4();
const positions = new Vector3();

export const getPositionsAtIndex = (mesh: InstancedMesh<any, any>, index: number) => {
  if (!mesh || !mesh.isInstancedMesh) {
    console.error("The provided mesh is not an InstancedMesh.");
    return null;
  }

  mesh.getMatrixAt(index, matrix);
  positions.setFromMatrixPosition(matrix);

  return positions;
};

const getGrayscaleColor = (color: Color) => {
  const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  return luminance;
};
