import { useGLTF } from "@react-three/drei";
import { getUIPositionFromColRow, pseudoRandom } from "../../../utils/utils";
import * as THREE from "three";
import { useMemo } from "react";
import { Hexagon } from "../../../types";
import { GLTF } from "three-stdlib";

type SnowBiomeGLTF = GLTF & {
  nodes: {
    Mountains_1: THREE.Mesh;
    Mountains_2: THREE.Mesh;
  };
  materials: {
    Rock: THREE.MeshStandardMaterial;
    Snow: THREE.MeshStandardMaterial;
  };
};

export function SnowBiome({ hexes, zOffsets }: { hexes: Hexagon[]; zOffsets?: boolean }) {
  const { nodes, materials } = useGLTF("/models/biomes/snow.glb") as SnowBiomeGLTF;

  const snowMaterial = new THREE.MeshMatcapMaterial({
    color: 0xffffff,
    vertexColors: false,
  });

  const rockMaterial = new THREE.MeshMatcapMaterial({
    color: 0x827f6a,
    vertexColors: false,
  });

  const defaultTransform = new THREE.Matrix4()
    .makeRotationX(Math.PI / 2)
    .multiply(new THREE.Matrix4().makeScale(3, 3, 3));

  const mountains1Geometry = nodes.Mountains_1.geometry.clone();
  mountains1Geometry.applyMatrix4(defaultTransform);

  const mountains2Geometry = nodes.Mountains_2.geometry.clone();
  mountains2Geometry.applyMatrix4(defaultTransform);

  const meshes = useMemo(() => {
    const instancedMeshRock = new THREE.InstancedMesh(mountains1Geometry, rockMaterial, hexes.length);
    const instancedMeshSnow = new THREE.InstancedMesh(mountains2Geometry, snowMaterial, hexes.length);

    let idx = 0;
    let matrix = new THREE.Matrix4();
    hexes.forEach((hex: Hexagon) => {
      const { x, y, z } = getUIPositionFromColRow(hex.col, hex.row);
      // rotate hex randomly on 60 * n degrees
      const seededRandom = pseudoRandom(hex.col, hex.row);
      matrix.makeRotationZ((Math.PI / 3) * Math.floor(seededRandom * 6));
      matrix.setPosition(x, y, zOffsets ? 0.32 + z : 0.32);
      instancedMeshRock.setMatrixAt(idx, matrix);
      instancedMeshSnow.setMatrixAt(idx, matrix);
      idx++;
    });

    instancedMeshRock.computeBoundingSphere();
    instancedMeshRock.frustumCulled = true;
    instancedMeshSnow.computeBoundingSphere();
    instancedMeshSnow.frustumCulled = true;
    return [instancedMeshRock, instancedMeshSnow];
  }, [hexes]);

  return (
    <>
      <primitive object={meshes[0]} />
      <primitive object={meshes[1]} />
    </>
  );
}
