import { useGLTF } from "@react-three/drei";
import realmHexPositions from "../../geodata/hex/realmHexPositions.json";
import { useMemo, useState } from "react";
import { useGetRealms } from "../../hooks/helpers/useRealm";
import useRealmStore from "../../hooks/store/useRealmStore";
import { HexPositions, getRealmUIPosition, pseudoRandom } from "../../utils/utils";
import { GLTF } from "three-stdlib";
import { biomes } from "@bibliothecadao/eternum";
import useUIStore from "../../hooks/store/useUIStore";
import { ArmyMenu } from "./armies/ArmyMenu";
import { Hexagon } from "../../types";

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

type Castle = {
  uiPos: { x: number; y: number };
  contractPos: { x: number; y: number };
  index: number;
  depth: number;
  id: bigint;
};

type CastlesProps = {
  hexData: Hexagon[];
};

const BIOMES = biomes as Record<string, { color: string; depth: number }>;

export const OtherCastles = ({ hexData }: CastlesProps) => {
  const { nodes, materials } = useGLTF("/models/realm-buildings-transformed.glb") as GLTFResult;
  const realms = useGetRealms();

  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const setSelectedEntity = useUIStore((state) => state.setSelectedEntity);
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const [hoveredCastleId, setHoveredCastleId] = useState<bigint | null>(null);

  const realmPositions = realmHexPositions as HexPositions;

  let castles = useMemo(() => {
    return realms
      .filter((realm) => !realmEntityIds.map((r) => r.realmEntityId).includes(realm.entity_id))
      .map((realm) => {
        const colrow = realmPositions[Number(realm.realmId).toString()][0];
        const hexIndex = hexData.findIndex((h) => h.col === colrow.col && h.row === colrow.row);
        // to have the exact height of the hexagon and place castle on top
        return {
          uiPos: getRealmUIPosition(realm.realmId),
          contractPos: { x: colrow.col, y: colrow.row },
          index: hexIndex,
          depth: BIOMES[hexData[hexIndex].biome].depth,
          id: realm.entity_id,
        };
      })
      .filter(Boolean) as Castle[];
  }, []);

  const onClick = (e: any, castle: Castle) => {
    e.stopPropagation();
    setSelectedEntity({ id: castle.id, position: castle.contractPos });
  };

  const hoverMaterial = materials.PaletteMaterial011.clone();
  hoverMaterial.color.set("red");

  return (
    <group>
      {castles.map((castle) => {
        const { uiPos: position, index, depth } = castle;
        if (index === -1) return null;
        const isHovered = hoveredCastleId === castle.id;
        return (
          <group key={index} position={[position.x, 0.31, -position.y]}>
            {selectedEntity && selectedEntity.id == castle.id && <ArmyMenu entityId={castle.id} />}
            <mesh
              scale={0.03}
              name="castle"
              castShadow
              onClick={(e) => onClick(e, castle)}
              onPointerEnter={() => {
                setHoveredCastleId(castle.id);
              }}
              onPointerOut={() => {
                setHoveredCastleId(null);
              }}
              geometry={nodes.castle.geometry}
              material={isHovered ? hoverMaterial : materials.PaletteMaterial011}
              rotation={[0, pseudoRandom(position.x, position.y) * 2 * Math.PI, 0]}
            />
          </group>
        );
      })}
    </group>
  );
};

export const MyCastles = ({ hexData }: CastlesProps) => {
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

        if (index === -1) return null;
        return (
          <mesh
            key={index}
            scale={0.03}
            name="castle"
            castShadow
            geometry={nodes.castle.geometry}
            material={materials.PaletteMaterial004}
            // rotate the castle in a random manner based on a seed
            rotation={[0, pseudoRandom(position.x, position.y) * 2 * Math.PI, 0]}
            position={[position.x, 0.31, -position.y]}
          />
        );
      })}
    </group>
  );
};
