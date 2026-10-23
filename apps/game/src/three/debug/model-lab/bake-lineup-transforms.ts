import { Matrix3, Matrix4, Mesh, Vector3, type BufferGeometry, type Object3D } from "three";

/** Instancing consumes geometry in placement space; preserve nested transforms in static comparison exports. */
export function bakeLineupTransforms(scene: Object3D): void {
  scene.updateMatrixWorld(true);
  const identity = new Matrix4();
  scene.traverse((node) => {
    if (!(node instanceof Mesh) || node.matrixWorld.equals(identity)) return;
    const matrix = node.matrixWorld.clone();
    const geometry: BufferGeometry = node.geometry.clone();
    geometry.applyMatrix4(matrix);
    const direction = new Matrix3().setFromMatrix4(matrix);
    const normal = new Matrix3().getNormalMatrix(matrix);
    const point = new Vector3();
    for (const [name, targets] of Object.entries(geometry.morphAttributes)) {
      for (const target of targets) {
        for (let i = 0; i < target.count; i++) {
          point.fromBufferAttribute(target, i);
          if (name === "position") {
            if (geometry.morphTargetsRelative) point.applyMatrix3(direction);
            else point.applyMatrix4(matrix);
          } else if (name === "normal") point.applyMatrix3(normal);
          target.setXYZ(i, point.x, point.y, point.z);
        }
      }
    }
    node.geometry = geometry;
  });
  scene.traverse((node) => {
    node.position.set(0, 0, 0);
    node.quaternion.identity();
    node.scale.set(1, 1, 1);
    node.updateMatrix();
  });
  scene.updateMatrixWorld(true);
}
