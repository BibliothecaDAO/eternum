import { MeshStandardMaterial } from "three";

export const transparentHexMaterial = new MeshStandardMaterial({
  color: "green",
  vertexColors: false,
  transparent: true,
  opacity: 0, // Start fully transparent
  wireframe: false,
});
