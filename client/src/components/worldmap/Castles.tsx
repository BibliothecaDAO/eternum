import { useGLTF } from "@react-three/drei";
import realmHexPositions from "../../geodata/hex/realmHexPositions.json";
import { MutableRefObject, useMemo } from "react";
import { useGetRealms } from "../../hooks/helpers/useRealm";
import useRealmStore from "../../hooks/store/useRealmStore";
import { HexPositions, getRealmUIPosition } from "../../utils/utils";
import { GLTF } from "three-stdlib";
import { DEPTH, Hexagon, getPositionsAtIndex } from "./HexGrid";
import { ExtrudeGeometry, InstancedMesh, MeshBasicMaterial } from "three";
import { biomes } from "@bibliothecadao/eternum";

// @ts-nocheck
type GLTFResult = GLTF & {
  nodes: {
    bridge: THREE.Mesh;
    bridge_1: THREE.Mesh;
    archer_tower: THREE.Mesh;
    barracks: THREE.Mesh;
    mage_tower: THREE.Mesh;
    castle: THREE.Mesh;
    banner: THREE.Mesh;
    banner_1: THREE.Mesh;
    ["market-stall"]: THREE.Mesh;
    ["market-stall_1"]: THREE.Mesh;
    caravan: THREE.Mesh;
    caravan_1: THREE.Mesh;
    ["army-tent-big001"]: THREE.Mesh;
    ["army-tent-big001_1"]: THREE.Mesh;
    ["army-tent-big001"]: THREE.Mesh;
    ["army-tent-big001_1"]: THREE.Mesh;
    ["army-tent-big001"]: THREE.Mesh;
    ["army-tent-big001_1"]: THREE.Mesh;
    ["army-tent-big001"]: THREE.Mesh;
    ["army-tent-big001_1"]: THREE.Mesh;
    ["mount-rest033"]: THREE.Mesh;
    ["mount-rest034"]: THREE.Mesh;
    pier: THREE.Mesh;
    pier_1: THREE.Mesh;
    ["pier-small021"]: THREE.Mesh;
    boat: THREE.Mesh;
    boat_1: THREE.Mesh;
    tower: THREE.Mesh;
    tower_1: THREE.Mesh;
    ["wall-straight"]: THREE.Mesh;
    ["wall-straight_1"]: THREE.Mesh;
    ["wall-straight_2"]: THREE.Mesh;
    ["army-tent-big"]: THREE.Mesh;
    ["army-tent-big_1"]: THREE.Mesh;
    ["tent-small"]: THREE.Mesh;
    ["timber-wall"]: THREE.Mesh;
    ["timber-wall_1"]: THREE.Mesh;
    ["timber-wall_2"]: THREE.Mesh;
    granary: THREE.Mesh;
    granary_1: THREE.Mesh;
    granary_2: THREE.Mesh;
    granary_3: THREE.Mesh;
    ["covered-boxes"]: THREE.Mesh;
    ["covered-boxes_1"]: THREE.Mesh;
    ["box-pile"]: THREE.Mesh;
    ["army-tent-big002"]: THREE.Mesh;
    ["market-stall_2"]: THREE.Mesh;
    ["market-stall_3"]: THREE.Mesh;
    caravan_2: THREE.Mesh;
    caravan_3: THREE.Mesh;
    ["store-square"]: THREE.Mesh;
    ["store-square_1"]: THREE.Mesh;
    ["store-square_2"]: THREE.Mesh;
    ["roofed-market"]: THREE.Mesh;
    ["roofed-market_1"]: THREE.Mesh;
    ["triangular-market"]: THREE.Mesh;
    ["triangular-market_1"]: THREE.Mesh;
    ["triangular-market_2"]: THREE.Mesh;
    fence: THREE.Mesh;
    ["house-1"]: THREE.Mesh;
    ["house-1_1"]: THREE.Mesh;
    ["house-1_2"]: THREE.Mesh;
    ["house-2"]: THREE.Mesh;
    ["house-2_1"]: THREE.Mesh;
    ["house-2_2"]: THREE.Mesh;
    ["house-3"]: THREE.Mesh;
    ["house-3_1"]: THREE.Mesh;
    ["house-3_2"]: THREE.Mesh;
    ["house-4"]: THREE.Mesh;
    ["house-4_1"]: THREE.Mesh;
    ["house-5"]: THREE.Mesh;
    ["house-5_1"]: THREE.Mesh;
  };
  materials: {
    PaletteMaterial004: THREE.MeshStandardMaterial;
    PaletteMaterial005: THREE.MeshStandardMaterial;
    PaletteMaterial006: THREE.MeshStandardMaterial;
    PaletteMaterial001: THREE.MeshStandardMaterial;
    PaletteMaterial010: THREE.MeshStandardMaterial;
    PaletteMaterial002: THREE.MeshStandardMaterial;
    PaletteMaterial003: THREE.MeshStandardMaterial;
    PaletteMaterial007: THREE.MeshStandardMaterial;
    PaletteMaterial008: THREE.MeshStandardMaterial;
    PaletteMaterial009: THREE.MeshStandardMaterial;
    PaletteMaterial011: THREE.MeshStandardMaterial;
  };
};

type CastlesProps = {
  hexData: Hexagon[];
  meshRef: MutableRefObject<InstancedMesh<ExtrudeGeometry, MeshBasicMaterial> | undefined>;
};

const BIOMES = biomes as Record<string, { color: string; depth: number }>;

export const OtherCastles = ({ hexData, meshRef }: CastlesProps) => {
  const { nodes, materials } = useGLTF("/models/realm-buildings-transformed.glb") as GLTFResult;
  const realms = useGetRealms();

  const realmPositions = realmHexPositions as HexPositions;

  let castles = useMemo(() => {
    return realms
      .map((realm) => {
        const colrow = realmPositions[Number(realm.realmId).toString()][0];
        const hexIndex = hexData.findIndex((h) => h.col === colrow.col && h.row === colrow.row);
        // to have the exact height of the hexagon and place castle on top
        return {
          position: getRealmUIPosition(realm.realmId),
          index: hexIndex,
          depth: BIOMES[hexData[hexIndex].biome].depth,
        };
      })
      .filter(Boolean);
  }, []);

  return (
    <group>
      {castles.map((castle) => {
        const { position, index, depth } = castle;
        if (index === -1 || !meshRef.current) return null;
        const matrix = getPositionsAtIndex(meshRef.current, index);
        return (
          <mesh
            key={index}
            scale={0.03}
            name="castle"
            castShadow
            geometry={nodes.castle.geometry}
            material={materials.PaletteMaterial011}
            position={[position.x, DEPTH + depth * DEPTH, -position.y]}
          />
        );
      })}
    </group>
  );
};

export const MyCastles = ({ hexData, meshRef }: CastlesProps) => {
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const { nodes, materials } = useGLTF("/models/realm-buildings-transformed.glb") as GLTFResult;

  const realmPositions = realmHexPositions as HexPositions;

  let castles = useMemo(() => {
    return realmEntityIds
      .map((entity) => {
        const colrow = realmPositions[Number(entity.realmId).toString()][0];
        const hexIndex = hexData.findIndex((h) => h.col === colrow.col && h.row === colrow.row);
        // to have the exact height of the hexagon and place castle on top
        return {
          position: getRealmUIPosition(entity.realmId),
          index: hexIndex,
          depth: BIOMES[hexData[hexIndex].biome].depth,
        };
      })
      .filter(Boolean);
  }, []);

  return (
    <group>
      {castles.map((castle) => {
        const { position, index, depth } = castle;
        if (index === -1 || !meshRef.current) return null;
        // const height = meshPositions[index * 3];
        const matrix = getPositionsAtIndex(meshRef.current, index);
        return (
          <mesh
            key={index}
            scale={0.03}
            name="castle"
            castShadow
            geometry={nodes.castle.geometry}
            material={materials.PaletteMaterial004}
            // rotate the castle in a random manner based on a seed
            rotation={[0, Math.random() * 2 * Math.PI, 0]}
            position={[position.x, DEPTH + depth * DEPTH, -position.y]}
            // position={[position.x, height + 1, -position.y]}
          />
        );
      })}
    </group>
  );
};
