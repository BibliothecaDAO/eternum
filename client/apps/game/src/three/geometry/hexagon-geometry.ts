import * as THREE from "three";
import { HEX_SIZE } from "@/three/scenes/constants";

export const createHexagonShape = (radius: number) => {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    // Adjust the angle to start the first point at the top
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();

  return shape;
};

const edgesGeometry = new THREE.EdgesGeometry(new THREE.ShapeGeometry(createHexagonShape(HEX_SIZE)));
const edgesMaterial = new THREE.LineBasicMaterial({
  color: "black",
  linewidth: 1,
  transparent: true,
  opacity: 0.15,
});

const hexagonEdgeMesh = new THREE.LineSegments(edgesGeometry, edgesMaterial);
hexagonEdgeMesh.rotateX(Math.PI / 2);
