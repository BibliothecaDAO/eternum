import { useGLTF } from "@react-three/drei";
import { getUIPositionFromColRow, pseudoRandom } from "../../../utils/utils";
import * as THREE from "three";
import { useMemo } from "react";
import { Hexagon } from "../../../../types";

export function DesertBiome({ hexes, zOffsets }: { hexes: any[]; zOffsets?: boolean }) {
  const { nodes, materials } = useGLTF("/models/biomes/desert.glb") as any;

  const defaultTransform = new THREE.Matrix4()
    .makeRotationX(Math.PI / 2)
    .multiply(new THREE.Matrix4().makeScale(3, 3, 3));

  const desertGeometry = nodes.Desert.geometry.clone();
  desertGeometry.applyMatrix4(defaultTransform);

  materials.Sand.depthWrite = false;

  const mesh = useMemo(() => {
    const instancedMesh = new THREE.InstancedMesh(desertGeometry, materials.Sand, hexes.length);
    instancedMesh.receiveShadow = true;

    let idx = 0;
    let matrix = new THREE.Matrix4();
    hexes.forEach((hex: any) => {
      const { x, y, z } = hex;
      // rotate hex randomly on 60 * n degrees
      const seededRandom = pseudoRandom(hex.x, hex.y);
      matrix.makeRotationZ((Math.PI / 3) * Math.floor(seededRandom * 6));
      matrix.setPosition(x, y, zOffsets ? 0.34 + z : 0.34);
      instancedMesh.setMatrixAt(idx, matrix);
      idx++;
    });

    instancedMesh.computeBoundingSphere();
    instancedMesh.frustumCulled = true;
    return instancedMesh;
  }, [hexes]);

  return <primitive object={mesh} renderOrder={1} />;
}
