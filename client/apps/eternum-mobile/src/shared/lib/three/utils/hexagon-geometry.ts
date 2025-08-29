import * as THREE from "three";
import { HEX_SIZE } from "./utils";

export const createHexagonShape = (radius: number) => {
  const shape = new THREE.Shape();

  // For isometric-like hexagon: width = height * 1.6, tile side length = height / 2
  // radius parameter represents the height/2, so height = radius * 2
  const height = radius * 2;
  const width = height * 1.6;
  const sideLength = height / 2;

  // Calculate the horizontal radius (half width)
  const horizontalRadius = width / 2;

  // Create hexagon points with isometric proportions
  // Top and bottom points use the original radius (height/2)
  // Side points use the horizontal radius (width/2)
  const points = [
    { x: 0, y: radius }, // Top
    { x: horizontalRadius, y: sideLength / 2 }, // Top-right
    { x: horizontalRadius, y: -sideLength / 2 }, // Bottom-right
    { x: 0, y: -radius }, // Bottom
    { x: -horizontalRadius, y: -sideLength / 2 }, // Bottom-left
    { x: -horizontalRadius, y: sideLength / 2 }, // Top-left
  ];

  // Create the shape
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y);
  }
  shape.closePath();

  return shape;
};

export const createRoundedHexagonShape = (radius: number, cornerRadius: number = radius * 0.15) => {
  const shape = new THREE.Shape();

  // For isometric-like hexagon: width = height * 1.6, tile side length = height / 2
  // radius parameter represents the height/2, so height = radius * 2
  const height = radius * 2;
  const width = height * 1.6;
  const sideLength = height / 2;

  // Calculate the horizontal radius (half width)
  const horizontalRadius = width / 2;

  // Create hexagon points with isometric proportions
  const points = [
    new THREE.Vector2(0, radius), // Top
    new THREE.Vector2(horizontalRadius, sideLength / 2), // Top-right
    new THREE.Vector2(horizontalRadius, -sideLength / 2), // Bottom-right
    new THREE.Vector2(0, -radius), // Bottom
    new THREE.Vector2(-horizontalRadius, -sideLength / 2), // Bottom-left
    new THREE.Vector2(-horizontalRadius, sideLength / 2), // Top-left
  ];

  // Create the path with rounded corners
  // First, calculate the start point for the first segment (after the curve from the last point)
  const lastIndex = points.length - 1;
  const firstIndex = 0;
  const secondIndex = 1;
  
  // Calculate vectors for the last-to-first segment
  const lastToFirstDx = points[firstIndex].x - points[lastIndex].x;
  const lastToFirstDy = points[firstIndex].y - points[lastIndex].y;
  const lastToFirstDistance = Math.sqrt(lastToFirstDx * lastToFirstDx + lastToFirstDy * lastToFirstDy);
  const lastToFirstRadius = Math.min(cornerRadius, lastToFirstDistance / 2);
  
  // Calculate vectors for the first-to-second segment
  const firstToSecondDx = points[secondIndex].x - points[firstIndex].x;
  const firstToSecondDy = points[secondIndex].y - points[firstIndex].y;
  const firstToSecondDistance = Math.sqrt(firstToSecondDx * firstToSecondDx + firstToSecondDy * firstToSecondDy);
  const firstToSecondRadius = Math.min(cornerRadius, firstToSecondDistance / 2);
  
  // Calculate the start point (after the curve from the last point)
  const firstDirX = firstToSecondDx / firstToSecondDistance;
  const firstDirY = firstToSecondDy / firstToSecondDistance;
  const startX = points[firstIndex].x + firstDirX * firstToSecondRadius;
  const startY = points[firstIndex].y + firstDirY * firstToSecondRadius;
  
  // Start the shape at this point
  shape.moveTo(startX, startY);
  
  // Now process all points
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const nextNext = points[(i + 2) % points.length];
    
    // Calculate the direction vector between current and next point
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Limit corner radius to half the side length
    const actualRadius = Math.min(cornerRadius, distance / 2);
    
    // Calculate the direction vector for the next segment
    const nextDx = nextNext.x - next.x;
    const nextDy = nextNext.y - next.y;
    const nextDistance = Math.sqrt(nextDx * nextDx + nextDy * nextDy);
    const nextRadius = Math.min(cornerRadius, nextDistance / 2);
    
    // Calculate points for the rounded corner
    const dirX = dx / distance;
    const dirY = dy / distance;
    const nextDirX = nextDx / nextDistance;
    const nextDirY = nextDy / nextDistance;
    
    // End point of current segment (before the curve)
    const segEndX = next.x - dirX * actualRadius;
    const segEndY = next.y - dirY * actualRadius;
    
    // Start point of next segment (after the curve)
    const nextSegStartX = next.x + nextDirX * nextRadius;
    const nextSegStartY = next.y + nextDirY * nextRadius;
    
    // Draw line to the end of the current segment
    shape.lineTo(segEndX, segEndY);
    
    // Add the quadratic curve around the corner
    shape.quadraticCurveTo(next.x, next.y, nextSegStartX, nextSegStartY);
  }
  
  // Close the shape
  shape.closePath();

  return shape;
};

// Helper functions for rounded corners
function getLength(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

function getProportionPoint(
  point: THREE.Vector2,
  segment: number,
  length: number,
  dx: number,
  dy: number,
): THREE.Vector2 {
  const factor = segment / length;
  return new THREE.Vector2(point.x - dx * factor, point.y - dy * factor);
}

function getRoundPoints(points: THREE.Vector2[], radius: number, pointsCount: number): THREE.Vector2[] {
  if (points.length < 3) return points;
  if (pointsCount < 2) pointsCount = 2;

  const allPoints: THREE.Vector2[] = [];

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
  angularPoint: THREE.Vector2,
  p1: THREE.Vector2,
  p2: THREE.Vector2,
  radius: number,
  pointsCount: number,
): THREE.Vector2[] {
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
  const points: THREE.Vector2[] = [];

  // Generate points along the arc
  const angleStep = sweepAngle / (pointsCount - 1);

  for (let i = 0; i < pointsCount; i++) {
    const angle = startAngle + i * angleStep;
    const x = circlePoint.x + Math.cos(angle) * radius;
    const y = circlePoint.y + Math.sin(angle) * radius;
    points.push(new THREE.Vector2(x, y));
  }

  return points;
}

// Create shared edge geometry for hexagon borders
const edgesGeometry = new THREE.EdgesGeometry(new THREE.ShapeGeometry(createHexagonShape(HEX_SIZE)));
const edgesMaterial = new THREE.LineBasicMaterial({
  color: "black",
  linewidth: 1,
  transparent: true,
  opacity: 0.15,
});

export const hexagonEdgeMesh = new THREE.LineSegments(edgesGeometry, edgesMaterial);
hexagonEdgeMesh.rotateX(Math.PI / 2);
