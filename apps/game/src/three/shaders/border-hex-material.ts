import * as THREE from "three";

/**
 * The buildable-hex band. Its geometry carries the two tones (a light core in a dark casing) that make it read on every
 * ground, so the material adds no colour of its own; it never writes depth.
 */
export const interactiveHexMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.8,
  depthWrite: false,
  toneMapped: false,
});
