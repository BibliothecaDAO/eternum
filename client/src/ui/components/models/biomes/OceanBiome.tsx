import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { pseudoRandom } from "../../../utils/utils";

export function OceanBiome({ hexes, zOffsets }: { hexes: any[]; zOffsets?: boolean }) {
  const { nodes, materials } = useGLTF("/models/biomes/ocean.glb") as any;

  const defaultTransform = new THREE.Matrix4()
    .makeRotationX(Math.PI / 2)
    .multiply(new THREE.Matrix4().makeScale(3, 3, 3));

  const geometry = nodes.Ocean.geometry.clone();
  geometry.applyMatrix4(defaultTransform);

  materials["Ocean Water"].depthWrite = false;

  const mesh = useMemo(() => {
    const instancedMesh = new THREE.InstancedMesh(geometry, materials["Ocean Water"], hexes.length);
    instancedMesh.receiveShadow = true;
    let idx = 0;
    let matrix = new THREE.Matrix4();
    hexes.forEach((hex: any) => {
      const { x, y, z } = hex;
      // rotate hex randomly on 60 * n degrees
      const seededRandom = pseudoRandom(hex.x, hex.y);
      matrix.makeRotationZ((Math.PI / 3) * Math.floor(seededRandom * 6));
      matrix.setPosition(x, y, zOffsets ? z : 0.32);
      instancedMesh.setMatrixAt(idx, matrix);
      idx++;
    });

    instancedMesh.computeBoundingSphere();
    instancedMesh.frustumCulled = true;
    return instancedMesh;
  }, [hexes]);

  return <primitive object={mesh} renderOrder={1} />;
}
