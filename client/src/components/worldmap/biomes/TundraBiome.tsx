import { useGLTF } from "@react-three/drei";
import { getUIPositionFromColRow } from "../../../utils/utils";
import * as THREE from "three";
import { useMemo } from "react";
import { Hexagon } from "src/types";
import { GLTF } from "three-stdlib";

type GLTFResult = GLTF & {
  nodes: {
    Tundra_Terrain_1: THREE.Mesh;
    Tundra_Terrain_2: THREE.Mesh;
    Tundra_Terrain_3: THREE.Mesh;
    Tundra_Terrain_4: THREE.Mesh;
    Tundra_Shrubs: THREE.Mesh;
    Tundra_Rocks: THREE.Mesh;
    Tundra_Snow: THREE.Mesh;
  };
  materials: {
    ["Tundra Grass"]: THREE.MeshStandardMaterial;
    ["Tundra Dirt"]: THREE.MeshStandardMaterial;
    ["Tundra Green Grass"]: THREE.MeshStandardMaterial;
    ["Tundra Shrub"]: THREE.MeshStandardMaterial;
    ["Tundra Rock"]: THREE.MeshStandardMaterial;
    ["Tundra Snow"]: THREE.MeshStandardMaterial;
  };
};
export function TundraBiome({ hexes }: { hexes: Hexagon[] }) {
  const { nodes, materials: _materials } = useGLTF("/models/biomes/tundra.glb") as GLTFResult;

  const defaultTransform = new THREE.Matrix4()
    .makeRotationX(Math.PI / 2)
    .multiply(new THREE.Matrix4().makeScale(3, 3, 3));

  const geometries = useMemo(() => {
    return [
      nodes.Tundra_Terrain_1.geometry.clone(),
      nodes.Tundra_Terrain_2.geometry.clone(),
      nodes.Tundra_Terrain_3.geometry.clone(),
      nodes.Tundra_Terrain_4.geometry.clone(),
      nodes.Tundra_Shrubs.geometry.clone(),
      nodes.Tundra_Rocks.geometry.clone(),
      nodes.Tundra_Snow.geometry.clone(),
    ].map((geometry) => {
      geometry.applyMatrix4(defaultTransform);
      return geometry;
    });
  }, [nodes]);

  const materials = useMemo(() => {
    return [
      _materials["Tundra Grass"],
      _materials["Tundra Dirt"],
      _materials["Tundra Green Grass"],
      _materials["Tundra Shrub"],
      _materials["Tundra Shrub"],
      _materials["Tundra Rock"],
      _materials["Tundra Snow"],
    ];
  }, [_materials]);

  const meshes = useMemo(() => {
    const instancedMeshes = [...geometries].map((geometry, idx) => {
      const instancedMesh = new THREE.InstancedMesh(geometry, materials[idx], hexes.length);
      return instancedMesh;
    });

    let idx = 0;
    let matrix = new THREE.Matrix4();
    hexes.forEach((hex: Hexagon) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);
      // rotate hex randomly on 60 * n degrees
      matrix.makeRotationZ((Math.PI / 3) * Math.floor(Math.random() * 6));
      matrix.setPosition(x, y, 0.33);
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
        <primitive object={mesh} key={idx} />
      ))}
    </>
  );
}
