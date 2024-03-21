import useUIStore from "../../../hooks/store/useUIStore";
import * as THREE from "three";
import { createHexagonShape } from "./HexagonGeometry";
import { HEX_RADIUS } from "./WorldHexagon";

const HighlightedHexes = () => {
  const hexagonGeometry = new THREE.ShapeGeometry(createHexagonShape(HEX_RADIUS));

  const highlightPositions = useUIStore((state) => state.highlightPositions);
  const highlightColor = useUIStore((state) => state.highlightColor);

  return (
    <>
      {highlightPositions.map((highlightPosition, index) => {
        return (
          <mesh
            key={index}
            geometry={hexagonGeometry}
            rotation={[Math.PI / -2, 0, 0]}
            position={[highlightPosition[0], 0.32, highlightPosition[1]]}
          >
            <meshMatcapMaterial color={highlightColor} transparent opacity={0.75} depthTest={false} />
          </mesh>
        );
      })}
    </>
  );
};

export default HighlightedHexes;
