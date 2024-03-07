import { useGLTF } from "@react-three/drei";
import { getUIPositionFromColRow } from "../../../utils/utils";
import * as THREE from "three";
import { useMemo } from "react";

export function DeepOceanBiome({ hexes }) {
  const { nodes, materials } = useGLTF("/models/deepOcean.glb");

  const defaultTransform = new THREE.Matrix4()
    .makeRotationX(Math.PI / 2)
    .multiply(new THREE.Matrix4().makeScale(3, 3, 3));

  const geometry = nodes.Deep_Ocean.geometry.clone();
  geometry.applyMatrix4(defaultTransform);

  const mesh = useMemo(() => {
    const instancedMesh = new THREE.InstancedMesh(geometry, materials["Deep Ocean Water"], hexes.length);
    let idx = 0;
    let matrix = new THREE.Matrix4();
    hexes.forEach((hex) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);
      // rotate hex randomly on 60 * n degrees
      matrix.makeRotationZ((Math.PI / 3) * Math.floor(Math.random() * 6));
      matrix.setPosition(x, y, 0.33);
      instancedMesh.setMatrixAt(idx, matrix);
      idx++;
    });

    instancedMesh.computeBoundingSphere();
    instancedMesh.frustumCulled = true;
    return instancedMesh;
  }, [hexes]);

  return <primitive object={mesh} />;
}
