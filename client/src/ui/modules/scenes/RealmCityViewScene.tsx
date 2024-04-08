import { useEffect, useMemo } from "react";
import useUIStore from "../../../hooks/store/useUIStore";
import { useTexture } from "@react-three/drei";
import BuildArea from "../../components/construction/BuildArea";
import { HexPositions, getUIPositionFromColRow } from "../../utils/utils";
import BigHexBiome from "../../components/construction/BigHexBiome";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useGetRealm } from "../../../hooks/helpers/useRealm";
import realmHexPositions from "../../../data/geodata/hex/realmHexPositions.json";
import { biomes, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";

export const RealmCityViewScene = () => {
  const realmPositions = realmHexPositions as HexPositions;
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const { realmEntityId } = useRealmStore();
  const { realm } = useGetRealm(realmEntityId);
  const hexData = useUIStore((state) => state.hexData);

  const { neighborHexes, realmHex } = useMemo(() => {
    if (!realm) return { neighborHexes: [], realmHex: undefined };
    const realmPosition = realmPositions[Number(realm?.realmId)];
    const realmHex = hexData?.find((hex) => hex.col === realmPosition[0].col && hex.row === realmPosition[0].row);

    const neighborOffsets = realmPosition[0].row % 2 !== 0 ? neighborOffsetsEven : neighborOffsetsOdd;
    const neighborHexes = neighborOffsets.map((neighbor: { i: number; j: number; direction: number }) => {
      const tmpCol = realmPosition[0].col + neighbor.i;
      const tmpRow = realmPosition[0].row + neighbor.j;
      return { col: tmpCol, row: tmpRow };
    });
    return { neighborHexes, realmHex };
  }, [realm]);

  const neighborHexesInsideView = useMemo(() => {
    return hexData?.filter((hex) =>
      neighborHexes?.some((neighborHex: any) => neighborHex.col === hex.col && neighborHex.row === hex.row),
    );
  }, [hexData, neighborHexes]);

  useEffect(() => {
    setIsLoadingScreenEnabled(false);
  }, []);

  const texture = useTexture({
    map: "/textures/paper/paper-color.jpg",
    displacementMap: "/textures/paper/paper-height.jpg",
    roughnessMap: "/textures/paper/paper-roughness.jpg",
    normalMap: "/textures/paper/paper-normal.jpg",
  });

  const mainPosition = getUIPositionFromColRow(0, 0, true);
  const pos = getUIPositionFromColRow(7, 4, true);
  const pos2 = getUIPositionFromColRow(-7, 5, true);
  const pos3 = getUIPositionFromColRow(-7, -4, true);
  const pos4 = getUIPositionFromColRow(7, -5, true);
  const pos5 = getUIPositionFromColRow(0, 9, true);
  const pos6 = getUIPositionFromColRow(0, -9, true);
  return (
    <>
      {realmHex && (
        <group position={[mainPosition.x, 0, -mainPosition.y]} rotation={[0, 0, 0]}>
          <BuildArea />
        </group>
      )}

      {neighborHexesInsideView && neighborHexesInsideView.length > 0 && (
        <group>
          <group position={[pos.x, 0, -pos.y]} rotation={[0, 0, 0]}>
            <BigHexBiome biome={neighborHexesInsideView[0].biome as any} />
          </group>
          <group position={[pos2.x, 0, -pos2.y]}>
            <BigHexBiome biome={neighborHexesInsideView[1].biome as any} />
          </group>
          <group position={[pos3.x, 0, -pos3.y]}>
            <BigHexBiome biome={neighborHexesInsideView[2].biome as any} />
          </group>
          <group position={[pos4.x, 0, -pos4.y]}>
            <BigHexBiome biome={neighborHexesInsideView[3].biome as any} />
          </group>
          <group position={[pos5.x, 0, -pos5.y]}>
            <BigHexBiome biome={neighborHexesInsideView[4].biome as any} />
          </group>
          <group position={[pos6.x, 0, -pos6.y]}>
            <BigHexBiome biome={neighborHexesInsideView[5].biome as any} />
          </group>
        </group>
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[2668, 1390.35]} />
        <meshStandardMaterial {...texture} />
      </mesh>
    </>
  );
};
