import * as THREE from "three";

/** The buildable-hex band: the terrain grid's grey, a step more present, and it never writes depth. */
export const interactiveHexMaterial = new THREE.MeshBasicMaterial({
  color: 0xc9c4b9,
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
  toneMapped: false,
});
