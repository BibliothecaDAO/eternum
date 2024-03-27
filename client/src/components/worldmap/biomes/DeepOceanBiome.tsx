import { useGLTF } from "@react-three/drei";
import { getUIPositionFromColRow, pseudoRandom } from "../../../utils/utils";
import * as THREE from "three";
import { useMemo } from "react";
import { Hexagon } from "../../../types";

export function DeepOceanBiome({ hexes }: { hexes: Hexagon[] }) {
  const { nodes, materials } = useGLTF("/models/biomes/deepOcean.glb") as any;

  const defaultTransform = new THREE.Matrix4()
    .makeRotationX(Math.PI / 2)
    .multiply(new THREE.Matrix4().makeScale(3, 3, 3));

  const geometry = nodes.Deep_Ocean.geometry.clone();
  geometry.applyMatrix4(defaultTransform);

  const mesh = useMemo(() => {
    const instancedMesh = new THREE.InstancedMesh(geometry, materials["Deep Ocean Water"], hexes.length);
    let idx = 0;
    let matrix = new THREE.Matrix4();
    hexes.forEach((hex: Hexagon) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);
      // rotate hex randomly on 60 * n degrees
      const seededRandom = pseudoRandom(hex.col, hex.row);
      matrix.makeRotationZ((Math.PI / 3) * Math.floor(seededRandom * 6));
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
