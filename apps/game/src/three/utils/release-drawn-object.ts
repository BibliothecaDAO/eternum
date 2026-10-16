import type { Object3D, Object3DEventMap } from "three";

type DisposableObject3D = Object3D<Object3DEventMap & { dispose: object }>;

/**
 * Lets the renderer forget, for good, an object it drew. three's WebGPU renderer keeps a render object for every drawn
 * mesh until the mesh or its material fires `dispose`; disposing the geometry is not enough, and a shared material
 * outlives the mesh, so a mesh dropped without this keeps its render object, GPU bindings and arrays for the rest of
 * the session. Call it where a drawn object leaves the scene for good; its owner still disposes what it owns.
 */
export function releaseDrawnObject(root: Object3D): void {
  root.traverse((object) => (object as DisposableObject3D).dispatchEvent({ type: "dispose" }));
}
