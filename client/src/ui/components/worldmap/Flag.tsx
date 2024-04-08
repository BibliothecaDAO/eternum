import { useGLTF } from "@react-three/drei";
import { Vector3 } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Matrix4 } from "three";
import * as THREE from "three"; // Import THREE

type FlagProps = {
  angle: number;
  position: Vector3;
  order: string;
};

export function Flag({ angle, position, order, ...props }: FlagProps) {
  const { nodes, materials } = useGLTF("/models/flags_1-transformed.glb") as any;

  const [woodGeometry, setWoodGeometry] = useState<any>(null);
  const [flagGeometry, setFlagGeometry] = useState<any>(null);

  useEffect(() => {
    const defaultTransform = new Matrix4().makeRotationX(-Math.PI / 2).multiply(new Matrix4().makeScale(0.1, 0.1, 0.1));

    const _woodMesh = nodes.Plane003_1.geometry;
    const _flagMesh = nodes.Plane003.geometry;

    let woodGeometry = _woodMesh.clone();
    let flagGeometry = _flagMesh.clone();

    woodGeometry.applyMatrix4(defaultTransform);
    flagGeometry.applyMatrix4(defaultTransform);

    setWoodGeometry(woodGeometry);
    setFlagGeometry(flagGeometry);
  }, [nodes, materials, order, position]);

  // @ts-ignore
  const modifiedPosition = new THREE.Vector3(position.x, position.y + 4, position.z);

  return (
    <>
      <group
        {...props}
        dispose={null}
        scale={5}
        position={modifiedPosition}
        rotation={[-Math.PI / 2, Math.PI, -angle - Math.PI / 2]}
      >
        <mesh
          // position={position}
          geometry={woodGeometry}
          material={materials.Wood}
        />
        <mesh
          // position={position}
          geometry={flagGeometry}
          material={materials[order]}
        />
      </group>
    </>
  );
}

useGLTF.preload("/models/flags_1-transformed.glb");
