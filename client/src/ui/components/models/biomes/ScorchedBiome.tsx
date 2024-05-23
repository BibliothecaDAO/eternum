import { useGLTF } from "@react-three/drei";
import { getUIPositionFromColRow, pseudoRandom } from "../../../utils/utils";
import * as THREE from "three";
import { useMemo } from "react";
import { Hexagon } from "../../../../types";
import { GLTF } from "three-stdlib";

type GLTFResult = GLTF & {
  nodes: {
    Scorched_Terrain: THREE.Mesh;
    Lava: THREE.Mesh;
  };
  materials: {
    ["Scorched Rock"]: THREE.MeshStandardMaterial;
    Lava: THREE.MeshStandardMaterial;
  };
};

export function ScorchedBiome({ hexes, zOffsets }: { hexes: any[]; zOffsets?: boolean }) {
  const { nodes, materials } = useGLTF("/models/biomes/scorched.glb") as GLTFResult;

  const defaultTransform = new THREE.Matrix4()
    .makeRotationX(Math.PI / 2)
    .multiply(new THREE.Matrix4().makeScale(3, 3, 3));

  const geometry1 = nodes.Scorched_Terrain.geometry.clone();
  geometry1.applyMatrix4(defaultTransform);

  const geometry2 = nodes.Lava.geometry.clone();
  geometry2.applyMatrix4(defaultTransform);

  const meshes = useMemo(() => {
    const instancedMesh1 = new THREE.InstancedMesh(geometry1, materials["Scorched Rock"], hexes.length);
    const instancedMesh2 = new THREE.InstancedMesh(geometry2, materials.Lava, hexes.length);

    let idx = 0;
    let matrix = new THREE.Matrix4();
    hexes.forEach((hex: any) => {
      const { x, y, z } = hex;
      // rotate hex randomly on 60 * n degrees
      const seededRandom = pseudoRandom(hex.x, hex.y);
      matrix.makeRotationZ((Math.PI / 3) * Math.floor(seededRandom * 6));
      matrix.setPosition(x, y, zOffsets ? 0.32 + z : 0.32);
      instancedMesh1.setMatrixAt(idx, matrix);
      instancedMesh2.setMatrixAt(idx, matrix);
      idx++;
    });

    instancedMesh1.computeBoundingSphere();
    instancedMesh1.frustumCulled = true;
    instancedMesh2.computeBoundingSphere();
    instancedMesh2.frustumCulled = true;
    return [instancedMesh1, instancedMesh2];
  }, [hexes]);

  return (
    <>
      <primitive object={meshes[0]} />
      <primitive object={meshes[1]} />
    </>
  );
}
