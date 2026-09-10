import * as THREE from "three";

/** The buildable-hex band: a quiet parchment line that reads on every biome and never writes depth. */
export const interactiveHexMaterial = new THREE.MeshBasicMaterial({
  color: 0xf6f1e5,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  toneMapped: false,
});
