import * as THREE from "three";

export const createHexagonGeometry = (radius: number, depth: number) => {
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

  return new THREE.ShapeGeometry(shape);
};

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

export const createHexagonPath = (radius: number) => {
  const path = new THREE.CurvePath();
  const points = [];
  for (let i = 0; i <= 6; i++) {
    // Loop one more time to close the hexagon
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    points.push(new THREE.Vector3(x, 0, y)); // Assuming hexagon lies on XZ plane
  }
  for (let i = 0; i < points.length - 1; i++) {
    const lineCurve = new THREE.LineCurve3(points[i], points[i + 1]);
    path.add(lineCurve);
  }

  return path;
};
