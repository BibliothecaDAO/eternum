import { useGLTF } from "@react-three/drei";
import { getUIPositionFromColRow, pseudoRandom } from "../../../../utils/utils";
import * as THREE from "three";
import { useMemo } from "react";
import { GLTF } from "three-stdlib";
import useUIStore from "@/hooks/store/useUIStore";
import { StructureType } from "@bibliothecadao/eternum";

type GLTFResult = GLTF & {
  nodes: {
    Bank_1: THREE.Mesh;
    Bank_2: THREE.Mesh;
  };
  materials: {
    Bank_Material_Stone: THREE.MeshStandardMaterial;
    M_bank_gold: THREE.MeshStandardMaterial;
  };
};

export function InstancedBanks() {
  const existingStructures = useUIStore((state) => state.existingStructures);

  const { nodes, materials } = useGLTF("/models/buildings/bank_lite.glb") as GLTFResult;

  const defaultTransform = new THREE.Matrix4().makeRotationX(Math.PI / 2);

  const geometry1 = nodes.Bank_1.geometry.clone();
  geometry1.applyMatrix4(defaultTransform);

  const geometry2 = nodes.Bank_2.geometry.clone();
  geometry2.applyMatrix4(defaultTransform);

  const meshes = useMemo(() => {
    const structures = existingStructures.filter((structure) => structure.type === StructureType.Bank);
    const instancedMesh1 = new THREE.InstancedMesh(geometry1, materials["Bank_Material_Stone"], structures.length);
    const instancedMesh2 = new THREE.InstancedMesh(geometry2, materials["M_bank_gold"], structures.length);
    instancedMesh1.castShadow = true;
    let idx = 0;
    let matrix = new THREE.Matrix4();
    structures.forEach((structure: any) => {
      const { x, y } = getUIPositionFromColRow(structure.col, structure.row, false);
      const seededRandom = pseudoRandom(x, y);
      matrix.makeRotationY((Math.PI / 3) * Math.floor(seededRandom * 6));
      matrix.setPosition(x, 0.32, -y);
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
