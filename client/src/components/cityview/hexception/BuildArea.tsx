import { useGLTF } from "@react-three/drei";
import useUIStore from "../../../hooks/store/useUIStore";
import HexBuildGrid, { hasBuilding } from "./HexBuildGrid";
import * as THREE from "three";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { useEffect, useMemo } from "react";

const BuildArea = () => {
  const hoveredBuildHex = useUIStore((state) => state.hoveredBuildHex);
  const buildMode = useUIStore((state) => state.buildMode);
  const builtCastles = useUIStore((state) => state.builtCastles);

  const castleCoords = useMemo(() => {
    return getUIPositionFromColRow(hoveredBuildHex.col, hoveredBuildHex.row, true);
  }, [hoveredBuildHex]);

  return (
    <group>
      {buildMode && (
        <group position={[castleCoords.x, 2.32, -castleCoords.y]}>
          <Castle transparent color={hasBuilding(hoveredBuildHex.col, hoveredBuildHex.row) ? "red" : "green"} />
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

const Castle = ({ transparent, color = "green" }: { transparent?: boolean; color?: string }) => {
  const { nodes, materials } = useGLTF("/models/realm-buildings-transformed.glb");
  const transparentMaterial = new THREE.MeshStandardMaterial();
  const _color = new THREE.Color(color);

  if (transparent) {
    transparentMaterial.color = _color;
    transparentMaterial.transparent = true;
    transparentMaterial.opacity = 0.5;
  }

  useEffect(() => {
    _color.setColorName(color);
    transparentMaterial.color = _color;
  }, [color]);

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
