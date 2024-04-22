import { useGLTF } from "@react-three/drei";
import realmHexPositions from "../../../../../data/geodata/hex/realmHexPositions.json";
import { useMemo, useState } from "react";
import { useGetRealms } from "../../../../../hooks/helpers/useRealm";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { HexPositions, getRealmUIPosition, pseudoRandom } from "../../../../utils/utils";
import { biomes } from "@bibliothecadao/eternum";
import useUIStore from "../../../../../hooks/store/useUIStore";
import { ArmyMenu } from "../../../worldmap/armies/ArmyMenu";
import { Hexagon } from "../../../../../types";

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
  const realms = useGetRealms();
  const model = useGLTF("/models/buildings/castle.glb");

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

  return (
    <group>
      {castles.map((castle) => {
        const { uiPos: position, index, depth } = castle;
        if (index === -1) return null;
        const isHovered = hoveredCastleId === castle.id;
        return (
          <group key={index} position={[position.x, 0.31, -position.y]}>
            {selectedEntity && selectedEntity.id == castle.id && <ArmyMenu entityId={castle.id} />}
            <primitive
              object={model.scene.clone()}
              scale={3}
              name="castle"
              castShadow
              onClick={(e: any) => onClick(e, castle)}
              onPointerEnter={() => {
                setHoveredCastleId(castle.id);
              }}
              onPointerOut={() => {
                setHoveredCastleId(null);
              }}
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

  const model = useGLTF("/models/buildings/castle.glb");

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
          <primitive
            key={index}
            scale={3}
            name="castle"
            object={model.scene.clone()}
            // rotate the castle in a random manner based on a seed
            rotation={[0, pseudoRandom(position.x, position.y) * 2 * Math.PI, 0]}
            position={[position.x, 0.31, -position.y]}
          />
        );
      })}
    </group>
  );
};
