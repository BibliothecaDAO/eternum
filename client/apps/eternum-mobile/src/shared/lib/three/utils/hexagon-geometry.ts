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
  // const lastIndex = points.length - 1;
  const firstIndex = 0;
  const secondIndex = 1;

  // Calculate vectors for the last-to-first segment
  //const lastToFirstDx = points[firstIndex].x - points[lastIndex].x;
  //const lastToFirstDy = points[firstIndex].y - points[lastIndex].y;
  //const lastToFirstDistance = Math.sqrt(lastToFirstDx * lastToFirstDx + lastToFirstDy * lastToFirstDy);
  // const lastToFirstRadius = Math.min(cornerRadius, lastToFirstDistance / 2);

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
