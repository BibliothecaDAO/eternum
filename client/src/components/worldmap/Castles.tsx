import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { useRealm } from "../../hooks/helpers/useRealm";
import { useDojo } from "../../DojoContext";
import useRealmStore from "../../hooks/store/useRealmStore";
import hexDataJson from "../../geodata/hex/hexData.json";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Position } from "@bibliothecadao/eternum";
import { getRealmUIPosition, getUIPositionFromColRow } from "../../utils/utils";
import { GLTF } from "three-stdlib";
import { Hexagon, getPositionsFromMesh } from "./HexGrid";
import { ExtrudeGeometry, InstancedMesh, MeshBasicMaterial } from "three";

// @ts-nocheck
type GLTFResult = GLTF & {
  nodes: {
    bridge: THREE.Mesh;
    bridge_1: THREE.Mesh;
    bridge: THREE.Mesh;
    bridge_1: THREE.Mesh;
    archer_tower: THREE.Mesh;
    barracks: THREE.Mesh;
    mage_tower: THREE.Mesh;
    castle: THREE.Mesh;
    banner: THREE.Mesh;
    banner_1: THREE.Mesh;
    banner: THREE.Mesh;
    banner_1: THREE.Mesh;
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
    pier: THREE.Mesh;
    pier_1: THREE.Mesh;
    pier: THREE.Mesh;
    pier_1: THREE.Mesh;
    ["pier-small021"]: THREE.Mesh;
    boat: THREE.Mesh;
    boat_1: THREE.Mesh;
    boat: THREE.Mesh;
    boat_1: THREE.Mesh;
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

type ContextType = Record<string, React.ForwardRefExoticComponent<JSX.IntrinsicElements["mesh"]>>;

const hexData: Hexagon[] = hexDataJson as Hexagon[];

export const Castles = (mesh: InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>) => {
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const { nodes, materials } = useGLTF("/models/realm-buildings-transformed.glb") as GLTFResult;

  let castles = useMemo(() => {
    return realmEntityIds
      .map((entity) => {
        const hexIndex = hexData.findIndex((h) => h.col === entity.col && h.row === entity.row);
        return { position: getRealmUIPosition(entity.realmId), index: hexIndex };
      })
      .filter(Boolean);
  }, []);

  const meshPositions = getPositionsFromMesh(mesh);

  return (
    <group>
      {castles.map((castle) => {
        const { position, index } = castle;
        if (index === -1 || !meshPositions) return null;
        const height = meshPositions[index * 3];
        console.log({ height });
        return (
          <mesh
            scale={0.03}
            name="castle"
            castShadow
            geometry={nodes.castle.geometry}
            material={materials.PaletteMaterial004}
            position={[position.x, 15, -position.y]}
            // position={[position.x, height + 1, -position.y]}
          />
        );
      })}
    </group>
  );
};
