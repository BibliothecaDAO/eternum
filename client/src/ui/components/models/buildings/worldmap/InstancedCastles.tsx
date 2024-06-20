import { useGLTF } from "@react-three/drei";
import { getUIPositionFromColRow, pseudoRandom } from "../../../../utils/utils";
import * as THREE from "three";
import { useMemo } from "react";
import { GLTF } from "three-stdlib";
import useUIStore from "@/hooks/store/useUIStore";
import { StructureType } from "@bibliothecadao/eternum";

type GLTFResult = GLTF & {
  nodes: {
    Castle_Wall: THREE.Mesh;
    Castle_Wall_1: THREE.Mesh;
  };
  materials: {
    Castle_Material_1: THREE.MeshStandardMaterial;
    Archer_Range_Material_1: THREE.MeshStandardMaterial;
  };
};

export function InstancedCastles() {
  const existingStructures = useUIStore((state) => state.existingStructures);

  const { nodes, materials } = useGLTF("/models/buildings/castle_lite.glb") as GLTFResult;

  const defaultTransform = new THREE.Matrix4().multiply(new THREE.Matrix4().makeScale(3, 3, 3));

  const geometry1 = nodes.Castle_Wall.geometry.clone();
  geometry1.applyMatrix4(defaultTransform);

  const geometry2 = nodes.Castle_Wall_1.geometry.clone();
  geometry2.applyMatrix4(defaultTransform);

  const meshes = useMemo(() => {
    const castles = existingStructures.filter((structure) => structure.type === StructureType.Realm);
    const instancedMesh1 = new THREE.InstancedMesh(geometry1, materials["Castle_Material_1"], castles.length);
    const instancedMesh2 = new THREE.InstancedMesh(geometry2, materials["Archer_Range_Material_1"], castles.length);
    instancedMesh1.castShadow = true;
    let idx = 0;
    let matrix = new THREE.Matrix4();
    castles.forEach((castle: any) => {
      const { x, y } = getUIPositionFromColRow(castle.col, castle.row, false);
      const seededRandom = pseudoRandom(x, y);
      matrix.makeRotationY((Math.PI / 3) * Math.floor(seededRandom * 6));
      matrix.setPosition(x, 1.5, -y);
      instancedMesh1.setMatrixAt(idx, matrix);
      instancedMesh2.setMatrixAt(idx, matrix);
      idx++;
    });

    instancedMesh1.computeBoundingSphere();
    instancedMesh1.frustumCulled = true;
    instancedMesh2.computeBoundingSphere();
    instancedMesh2.frustumCulled = true;
    return [instancedMesh1, instancedMesh2];
  }, [existingStructures]);

  return (
    <>
      <primitive object={meshes[0]} renderOrder={1} />
      <primitive object={meshes[1]} />
    </>
  );
}
