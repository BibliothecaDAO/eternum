import { useGLTF } from "@react-three/drei";
import { getUIPositionFromColRow } from "../../../utils/utils";
import * as THREE from "three";
import { useMemo } from "react";

type GLTFResult = GLTF & {
  nodes: {
    Beach_Terrain: THREE.Mesh;
    Palm_Trees_1: THREE.Mesh;
    Palm_Trees_2: THREE.Mesh;
  };
  materials: {
    ["White Sand"]: THREE.MeshStandardMaterial;
    ["Palm Trunk"]: THREE.MeshStandardMaterial;
    ["Palm Leaves"]: THREE.MeshStandardMaterial;
  };
};

export function BeachBiome({ hexes }) {
  const { nodes, materials } = useGLTF("/models/beach.glb") as GLTFResult;

  const defaultTransform = new THREE.Matrix4()
    .makeRotationX(Math.PI / 2)
    .multiply(new THREE.Matrix4().makeScale(3, 3, 3));

  const geometry1 = nodes.Beach_Terrain.geometry.clone();
  geometry1.applyMatrix4(defaultTransform);

  const geometry2 = nodes.Palm_Trees_1.geometry.clone();
  geometry2.applyMatrix4(defaultTransform);

  const geometry3 = nodes.Palm_Trees_2.geometry.clone();
  geometry3.applyMatrix4(defaultTransform);

  const meshes = useMemo(() => {
    const instancedMesh1 = new THREE.InstancedMesh(geometry1, materials["White Sand"], hexes.length);
    const instancedMesh2 = new THREE.InstancedMesh(geometry2, materials["Palm Trunk"], hexes.length);
    const instancedMesh3 = new THREE.InstancedMesh(geometry3, materials["Palm Leaves"], hexes.length);

    let idx = 0;
    let matrix = new THREE.Matrix4();
    hexes.forEach((hex) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);
      // rotate hex randomly on 60 * n degrees
      matrix.makeRotationZ((Math.PI / 3) * Math.floor(Math.random() * 6));
      matrix.setPosition(x, y, 0.33);
      instancedMesh1.setMatrixAt(idx, matrix);
      instancedMesh2.setMatrixAt(idx, matrix);
      instancedMesh3.setMatrixAt(idx, matrix);
      idx++;
    });

    instancedMesh1.computeBoundingSphere();
    instancedMesh1.frustumCulled = true;
    instancedMesh2.computeBoundingSphere();
    instancedMesh2.frustumCulled = true;
    instancedMesh3.computeBoundingSphere();
    instancedMesh3.frustumCulled = true;
    return [instancedMesh1, instancedMesh2, instancedMesh3];
  }, [hexes]);

  return (
    <>
      <primitive object={meshes[0]} />
      <primitive object={meshes[1]} />
      <primitive object={meshes[2]} />
    </>
  );
}
