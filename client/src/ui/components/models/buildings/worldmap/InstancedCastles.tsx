import { Points, useGLTF, useTexture } from "@react-three/drei";
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

const neutralColor = new THREE.Color(0xffffff);
const myColor = new THREE.Color("lime");

export function InstancedCastles() {
  const existingStructures = useUIStore((state) => state.existingStructures);

  const { nodes, materials } = useGLTF("/models/buildings/castle_lite.glb") as GLTFResult;

  const mapLabel = useTexture("/textures/realm_label.png", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
  });
  const particlesMaterial = new THREE.PointsMaterial();
  particlesMaterial.size = 20;
  particlesMaterial.vertexColors = true;
  particlesMaterial.sizeAttenuation = true;
  particlesMaterial.transparent = true;
  particlesMaterial.map = mapLabel;
  particlesMaterial.alphaTest = 0.001;
  particlesMaterial.depthTest = false;
  particlesMaterial.toneMapped = true;
  //particlesMaterial.colorWrite = false;

  const defaultTransform = new THREE.Matrix4().multiply(new THREE.Matrix4().makeScale(3, 3, 3));

  const geometry1 = nodes.Castle_Wall.geometry.clone();
  geometry1.applyMatrix4(defaultTransform);

  const geometry2 = nodes.Castle_Wall_1.geometry.clone();
  geometry2.applyMatrix4(defaultTransform);

  const meshes = useMemo(() => {
    const castles = existingStructures.filter((structure) => structure.type === StructureType.Realm);
    const instancedMesh1 = new THREE.InstancedMesh(geometry1, materials["Castle_Material_1"], castles.length);
    const instancedMesh2 = new THREE.InstancedMesh(geometry2, materials["Archer_Range_Material_1"], castles.length);
    const positionsBuffer = new Float32Array(castles.length * 3);
    const colorsBuffer = new Float32Array(castles.length * 3);
    instancedMesh1.castShadow = true;
    let idx = 0;
    let matrix = new THREE.Matrix4();
    castles.forEach((castle: any) => {
      const { x, y } = getUIPositionFromColRow(castle.col, castle.row, false);
      const seededRandom = pseudoRandom(x, y);
      matrix.makeRotationY((Math.PI / 3) * Math.floor(seededRandom * 6));
      matrix.setPosition(x, 1.5, -y);
      positionsBuffer.set([x, 8, -y], idx * 3);
      if (castle.isMine) {
        colorsBuffer.set([myColor.r, neutralColor.g, neutralColor.b], idx * 3);
      } else {
        colorsBuffer.set([neutralColor.r, neutralColor.g, neutralColor.b], idx * 3);
      }
      instancedMesh1.setMatrixAt(idx, matrix);
      instancedMesh2.setMatrixAt(idx, matrix);
      idx++;
    });

    instancedMesh1.computeBoundingSphere();
    instancedMesh1.frustumCulled = true;
    instancedMesh2.computeBoundingSphere();
    instancedMesh2.frustumCulled = true;
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute("position", new THREE.BufferAttribute(positionsBuffer, 3));
    pointsGeometry.setAttribute("color", new THREE.BufferAttribute(colorsBuffer, 3));
    const pointsObjects = new THREE.Points(pointsGeometry, particlesMaterial);
    pointsObjects.frustumCulled = true;
    pointsObjects.renderOrder = 3;
    return [instancedMesh1, instancedMesh2, pointsObjects];
  }, [existingStructures]);

  return (
    <>
      <primitive object={meshes[0]} renderOrder={1} />
      <primitive object={meshes[1]} />
      <primitive object={meshes[2]} />
    </>
  );
}
