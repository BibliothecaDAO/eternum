import * as THREE from "three";

export const borderHexMaterial = new THREE.MeshStandardMaterial({
  color: "green",
  vertexColors: false,
  transparent: true,
  opacity: 0.4, // Start fully transparent
  wireframe: false,
});
