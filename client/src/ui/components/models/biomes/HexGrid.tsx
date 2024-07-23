import { useMemo } from "react";
import * as THREE from "three";
import { Hexagon } from "../../../../types";
import { getUIPositionFromColRow } from "../../../utils/utils";

const hexagonGeometry = new THREE.RingGeometry(3, 2.94, 6, 1);
const defaultTransform = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI, 0, Math.PI / 2));
hexagonGeometry.applyMatrix4(defaultTransform);
const hexMaterial = new THREE.MeshBasicMaterial({
  color: 0x000,
  transparent: true,
  opacity: 0.15,
});

export function HexGrid({ hexes }: { hexes: Hexagon[] }) {
  const meshes = useMemo(() => {
    const instancedMesh = new THREE.InstancedMesh(hexagonGeometry, hexMaterial, hexes.length);

    let idx = 0;
    let matrix = new THREE.Matrix4();
    hexes.forEach((hex: Hexagon) => {
      const { x, y, z } = getUIPositionFromColRow(hex.col, hex.row);

      matrix.setPosition(x, y, 0.3);
      instancedMesh.setMatrixAt(idx, matrix);
      idx++;
    });

    instancedMesh.computeBoundingSphere();
    instancedMesh.frustumCulled = true;
    return [instancedMesh];
  }, [hexes]);

  return (
    <>
      <primitive object={meshes[0]} />
    </>
  );
}
