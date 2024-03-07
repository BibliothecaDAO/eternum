import HyperstructureFinished from "./hyperstructures/models/HyperstructureFinished";
import { Hexagon } from "./HexGrid";
import useUIStore from "../../hooks/store/useUIStore";
import { getUIPositionFromColRow } from "../../utils/utils";
import { biomes } from "@bibliothecadao/eternum";
import { Detailed } from "@react-three/drei";
import HyperstructureFinishedLowpoly from "./hyperstructures/models/HyperstructureFinishedLowpoly";

type Hyperstructures = {
  hexData: Hexagon[];
};

const BIOMES = biomes as Record<string, { color: string; depth: number }>;

export const Hyperstructures = ({ hexData }: Hyperstructures) => {
  const hyperstructures = useUIStore((state) => state.hyperstructures);
  const flatMode = localStorage.getItem("flatMode");

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
                position={[uiPosition.x, flatMode ? 0.31 : depth * 10 + 10.3, -uiPosition.y]}
              />
              <HyperstructureFinishedLowpoly
                hyperstructure={hyperstructure}
                scale={6}
                position={[uiPosition.x, flatMode ? 0.31 : depth * 10 + 10.3, -uiPosition.y]}
              />
            </Detailed>
          );
        }
      })}
    </group>
  );
};
