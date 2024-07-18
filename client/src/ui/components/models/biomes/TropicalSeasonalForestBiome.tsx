import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { GLTF } from "three-stdlib";
import { pseudoRandom } from "../../../utils/utils";

type GLTFResult = GLTF & {
  nodes: {
    Tropical_Seasonal_Forest_Terrain: THREE.Mesh;
    Tropical_Seasonal_Trees_1: THREE.Mesh;
    Tropical_Seasonal_Trees_2: THREE.Mesh;
    Tropical_Seasonal_Trees_3: THREE.Mesh;
    Tropical_Seasonal_Treecover: THREE.Mesh;
  };
  materials: {
    ["Tropical Seasonal Forest Dirt"]: THREE.MeshStandardMaterial;
    ["Tropical Seasonal Forest Leaves"]: THREE.MeshStandardMaterial;
    ["Tropical Seasonal Forest Wood"]: THREE.MeshStandardMaterial;
    ["Tropical Seasonal Brown Forest Leaves"]: THREE.MeshStandardMaterial;
  };
};

export function TropicalSeasonalForestBiome({ hexes, zOffsets }: { hexes: any[]; zOffsets?: boolean }) {
  const { nodes, materials: _materials } = useGLTF("/models/biomes/tropicalSeasonalForest.glb") as GLTFResult;

  const defaultTransform = new THREE.Matrix4()
    .makeRotationX(Math.PI / 2)
    .multiply(new THREE.Matrix4().makeScale(3, 3, 3));

  const geometries = useMemo(() => {
    return [
      nodes.Tropical_Seasonal_Forest_Terrain.geometry.clone(),
      nodes.Tropical_Seasonal_Trees_1.geometry.clone(),
      nodes.Tropical_Seasonal_Trees_2.geometry.clone(),
      nodes.Tropical_Seasonal_Trees_3.geometry.clone(),
      nodes.Tropical_Seasonal_Treecover.geometry.clone(),
    ].map((geometry) => {
      geometry.applyMatrix4(defaultTransform);
      return geometry;
    });
  }, [nodes]);

  const materials = useMemo(() => {
    return [
      _materials["Tropical Seasonal Forest Dirt"],
      _materials["Tropical Seasonal Forest Leaves"],
      _materials["Tropical Seasonal Forest Wood"],
      _materials["Tropical Seasonal Brown Forest Leaves"],
      _materials["Tropical Seasonal Forest Leaves"],
    ];
  }, [_materials]);

  materials[0].depthWrite = false;
  materials[1].depthWrite = false;
  // materials[2].depthWrite = false;
  // materials[3].depthWrite = false;
  // materials[4].depthWrite = false;

  const meshes = useMemo(() => {
    const instancedMeshes = [...geometries].map((geometry, idx) => {
      const instancedMesh = new THREE.InstancedMesh(geometry, materials[idx], hexes.length);
      return instancedMesh;
    });
    instancedMeshes[0].receiveShadow = true;
    instancedMeshes[1].castShadow = true;
    instancedMeshes[2].castShadow = true;
    instancedMeshes[3].castShadow = true;
    let idx = 0;
    let matrix = new THREE.Matrix4();
    hexes.forEach((hex: any) => {
      const { x, y, z } = hex;
      // rotate hex randomly on 60 * n degrees
      const seededRandom = pseudoRandom(hex.x, hex.y);
      matrix.makeRotationZ((Math.PI / 3) * Math.floor(seededRandom * 6));
      matrix.setPosition(x, y, zOffsets ? z : 0.32);
      instancedMeshes.forEach((mesh) => {
        mesh.setMatrixAt(idx, matrix);
      });
      idx++;
    });

    instancedMeshes.forEach((mesh) => {
      mesh.computeBoundingSphere();
      mesh.frustumCulled = true;
    });
    return instancedMeshes;
  }, [hexes]);

  return (
    <>
      {meshes.map((mesh, idx) => (
        <primitive object={mesh} key={idx} renderOrder={1} />
      ))}
    </>
  );
}
