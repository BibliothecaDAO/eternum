import { useGLTF } from "@react-three/drei";
import useUIStore from "../../../hooks/store/useUIStore";
import HexBuildGrid from "./HexBuildGrid";
import * as THREE from "three";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { useMemo } from "react";

const BuildArea = () => {
  const hoveredBuildHex = useUIStore((state) => state.hoveredBuildHex);
  const buildMode = useUIStore((state) => state.buildMode);
  const builtCastles = useUIStore((state) => state.builtCastles);
  const setBuiltCastles = useUIStore((state) => state.setBuiltCastles);

  const castleCoords = useMemo(() => {
    return getUIPositionFromColRow(hoveredBuildHex.col, hoveredBuildHex.row, true);
  }, [hoveredBuildHex]);

  return (
    <group>
      {buildMode && (
        <group position={[castleCoords.x, 2.32, -castleCoords.y]}>
          <Castle transparent />
        </group>
      )}
      {builtCastles.map((castle) => {
        const castleCoords = getUIPositionFromColRow(castle.col, castle.row, true);
        return (
          <group position={[castleCoords.x, 2.32, -castleCoords.y]}>
            <Castle />
          </group>
        );
      })}
      <HexBuildGrid />
    </group>
  );
};

export default BuildArea;

const Castle = ({ transparent }: { transparent?: boolean }) => {
  const { nodes, materials } = useGLTF("/models/realm-buildings-transformed.glb");
  const transparentMaterial = new THREE.MeshStandardMaterial();
  transparentMaterial.transparent = true;
  transparentMaterial.opacity = 0.5;

  return (
    <mesh
      scale={0.03}
      name="castle"
      castShadow
      geometry={nodes.castle.geometry}
      material={transparent ? transparentMaterial : materials.PaletteMaterial011}
    />
  );
};
