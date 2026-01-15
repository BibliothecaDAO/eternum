import { HEX_SIZE } from "@/three/constants";
import { EdgesGeometry, LineBasicMaterial, LineSegments, Shape, ShapeGeometry, Vector2 } from "three";

export const createHexagonShape = (radius: number) => {
  const shape = new Shape();
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

export const createRoundedHexagonShape = (radius: number, cornerRadius: number = radius * 0.15) => {
  const shape = new Shape();

  // Calculate points of the hexagon
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    points.push(new Vector2(x, y));
  }

  // Get rounded corner points
  const roundedPoints = getRoundPoints(points, cornerRadius, 5);

  // Create shape from rounded points
  shape.moveTo(roundedPoints[0].x, roundedPoints[0].y);
  for (let i = 1; i < roundedPoints.length; i++) {
    shape.lineTo(roundedPoints[i].x, roundedPoints[i].y);
  }

  return shape;
};

// Helper functions for rounded corners
function getLength(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

function getProportionPoint(point: Vector2, segment: number, length: number, dx: number, dy: number): Vector2 {
  const factor = segment / length;
  return new Vector2(point.x - dx * factor, point.y - dy * factor);
}

function getRoundPoints(points: Vector2[], radius: number, pointsCount: number): Vector2[] {
  if (points.length < 3) return points;
  if (pointsCount < 2) pointsCount = 2;

  const allPoints: Vector2[] = [];

  for (let i = 0; i < points.length; i++) {
    let p1Index = i - 1;
    let angPIndex = i;
    let p2Index = i + 1;

    if (p1Index < 0) p1Index = points.length - 1;
    if (p2Index > points.length - 1) p2Index = 0;

    const cornerPoints = getOneRoundedCorner(points[angPIndex], points[p1Index], points[p2Index], radius, pointsCount);

    // Copy to return array
    for (let j = 0; j < cornerPoints.length; j++) {
      allPoints.push(cornerPoints[j]);
    }
  }

  // Close the path
  allPoints.push(allPoints[0].clone());

  return allPoints;
}

function getOneRoundedCorner(
  angularPoint: Vector2,
  p1: Vector2,
  p2: Vector2,
  radius: number,
  pointsCount: number,
): Vector2[] {
  // Vector 1
  const dx1 = angularPoint.x - p1.x;
  const dy1 = angularPoint.y - p1.y;

  // Vector 2
  const dx2 = angularPoint.x - p2.x;
  const dy2 = angularPoint.y - p2.y;

  // Angle between vector 1 and vector 2 divided by 2
  const angle = (Math.atan2(dy1, dx1) - Math.atan2(dy2, dx2)) / 2;

  // The length of segment between angular point and the points of intersection
  // with the circle of a given radius
  const tan = Math.abs(Math.tan(angle));
  let segment = radius / tan;

  // Check the segment
  const length1 = getLength(dx1, dy1);
  const length2 = getLength(dx2, dy2);

  const length = Math.min(length1, length2);

  if (segment > length) {
    segment = length;
    radius = length * tan;
  }

  // Points of intersection are calculated by the proportion between
  // the coordinates of the vector, length of vector and the length of the segment
  const p1Cross = getProportionPoint(angularPoint, segment, length1, dx1, dy1);
  const p2Cross = getProportionPoint(angularPoint, segment, length2, dx2, dy2);

  // Calculation of the coordinates of the circle center by the addition of angular vectors
  const dx = angularPoint.x * 2 - p1Cross.x - p2Cross.x;
  const dy = angularPoint.y * 2 - p1Cross.y - p2Cross.y;

  const L = getLength(dx, dy);
  const d = getLength(segment, radius);

  const circlePoint = getProportionPoint(angularPoint, d, L, dx, dy);

  // StartAngle and EndAngle of arc
  let startAngle = Math.atan2(p1Cross.y - circlePoint.y, p1Cross.x - circlePoint.x);
  const endAngle = Math.atan2(p2Cross.y - circlePoint.y, p2Cross.x - circlePoint.x);

  // Sweep angle
  let sweepAngle = endAngle - startAngle;

  // Some additional checks
  if (sweepAngle < 0) {
    sweepAngle = 2 * Math.PI + sweepAngle;
  }

  // Array to store generated points
  const points: Vector2[] = [];

  // Generate points along the arc
  const angleStep = sweepAngle / (pointsCount - 1);

  for (let i = 0; i < pointsCount; i++) {
    const angle = startAngle + i * angleStep;
    const x = circlePoint.x + Math.cos(angle) * radius;
    const y = circlePoint.y + Math.sin(angle) * radius;
    points.push(new Vector2(x, y));
  }

  return points;
}

const edgesGeometry = new EdgesGeometry(new ShapeGeometry(createHexagonShape(HEX_SIZE)));
const edgesMaterial = new LineBasicMaterial({
  color: "black",
  linewidth: 1,
  transparent: true,
  opacity: 0.15,
});

const hexagonEdgeMesh = new LineSegments(edgesGeometry, edgesMaterial);
hexagonEdgeMesh.rotateX(Math.PI / 2);
