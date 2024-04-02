import useUIStore from "../../../hooks/store/useUIStore";
import * as THREE from "three";
import { HEX_RADIUS } from "./WorldHexagon";
import { createHexagonPath } from "./HexagonGeometry";

const HighlightedHexes = () => {
  const tubeRadius = 0.064; // Adjust the tube radius (width) as needed
  const radialSegments = 8; // Adjust for smoother or sharper corners
  const tubularSegments = 64; // Adjust for a smoother or more faceted tube
  const hexagonPath = createHexagonPath(HEX_RADIUS);
  const hexagonGeometry = new THREE.TubeGeometry(
    hexagonPath as any,
    tubularSegments,
    tubeRadius,
    radialSegments,
    false,
  );

  const highlightPositions = useUIStore((state) => state.highlightPositions);
  const highlightColor = useUIStore((state) => state.highlightColor);

  return (
    <>
      {highlightPositions.map((highlightPosition, index) => {
        return (
          <mesh
            key={index}
            geometry={hexagonGeometry}
            rotation={[0, 0, 0]}
            position={[highlightPosition[0], 0.32, highlightPosition[1]]}
          >
            <meshBasicMaterial color={highlightColor} />
          </mesh>
        );
      })}
    </>
  );
};
export default HighlightedHexes;
