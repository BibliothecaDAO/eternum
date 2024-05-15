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

  return (
    <group>
      {castles.map((castle) => {
        const { uiPos: position, index, depth } = castle;
        if (index === -1) return null;

        return (
          <group key={index} position={[position.x, 0.31, -position.y]}>
            {/* {selectedEntity && selectedEntity.id == castle.id && <ArmyMenu entityId={castle.id} />} */}
            <directionalLight
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-near={10}
              shadow-camera-far={2500}
              shadow-camera-left={-75}
              shadow-camera-right={75}
              shadow-camera-top={75}
              shadow-camera-bottom={-75}
              shadow-bias={0.04}
              position={[0, 2000, 0]}
              color={"#fff"}
              intensity={1.35}
            ></directionalLight>

            <primitive
              object={model.scene.clone()}
              scale={4}
              name="castle"
              castShadow
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
          <group>
            <directionalLight
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-far={75}
              shadow-camera-left={-75}
              shadow-camera-right={75}
              shadow-camera-top={75}
              shadow-camera-bottom={-75}
              shadow-bias={0.04}
              position={[position.x, 20, position.y]}
              color={"#fff"}
              intensity={1.65}
            ></directionalLight>
            <pointLight
              position={[position.x, 12, position.y - 18]}
              color="#fff"
              intensity={75}
              power={2000}
            />

            <primitive
              key={index}
              scale={3}
              name="castle"
              object={model.scene.clone()}
              // rotate the castle in a random manner based on a seed
              rotation={[0, pseudoRandom(position.x, position.y) * 2 * Math.PI, 0]}
              position={[position.x, 0.31, -position.y]}
            />
          </group>
        );
      })}
    </group>
  );
};
