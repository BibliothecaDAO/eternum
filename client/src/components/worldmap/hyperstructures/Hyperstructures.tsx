import HyperstructureFinished from "./models/HyperstructureFinished";
import { Hexagon } from "../../../types";
import useUIStore from "../../../hooks/store/useUIStore";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { biomes } from "@bibliothecadao/eternum";
import { Detailed } from "@react-three/drei";
import HyperstructureFinishedLowpoly from "./models/HyperstructureFinishedLowpoly";

type Hyperstructures = {
  hexData: Hexagon[];
};

const BIOMES = biomes as Record<string, { color: string; depth: number }>;

export const Hyperstructures = ({ hexData }: Hyperstructures) => {
  const hyperstructures = useUIStore((state) => state.hyperstructures);

  return (
    <group>
      {hyperstructures.map((hyperstructure, i) => {
        if (hyperstructure) {
          const {
            position: { x, y },
            uiPosition,
          } = hyperstructure;
          const hexIndex = hexData.findIndex((h) => h.col === x && h.row === y);
          const depth = BIOMES[hexData[hexIndex].biome].depth;
          // to have the exact height of the hexagon and place hyperstructure on top
          const hexPosition = getUIPositionFromColRow(x, y);
          return (
            <Detailed distances={[0, 550]} key={i}>
              <HyperstructureFinished
                hyperstructure={hyperstructure}
                scale={6}
                position={[uiPosition.x, 0.31, -uiPosition.y]}
              />
              <HyperstructureFinishedLowpoly
                hyperstructure={hyperstructure}
                scale={6}
                position={[uiPosition.x, 0.31, -uiPosition.y]}
              />
            </Detailed>
          );
        }
      })}
    </group>
  );
};
