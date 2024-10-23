import * as THREE from "three";

export const interactiveHexMaterial = new THREE.MeshStandardMaterial({
  color: "green",
  vertexColors: false,
  transparent: true,
  opacity: 0.3, // Start fully transparent
  wireframe: false,
});
