import React, { useEffect, useRef, useState } from "react";
import { getPulseAnimation, hexToPixel, pixelToHex } from "../lib/hex-utils";
import { HexLocation } from "../model/types";

interface HexagonCanvasProps {
  width: number;
  height: number;
  hexSize: number;
  availableLocations: HexLocation[];
  occupiedLocations: HexLocation[];
  selectedLocation: HexLocation | null;
  onHexClick: (col: number, row: number) => void;
}

// Helper functions for rounded corners
function getLength(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

function getProportionPoint(
  x: number,
  y: number,
  segment: number,
  length: number,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const factor = segment / length;
  return { x: x - dx * factor, y: y - dy * factor };
}

function getOneRoundedCorner(
  ctx: CanvasRenderingContext2D,
  angularPoint: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  radius: number,
  pointsCount: number,
) {
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
  const p1Cross = getProportionPoint(angularPoint.x, angularPoint.y, segment, length1, dx1, dy1);
  const p2Cross = getProportionPoint(angularPoint.x, angularPoint.y, segment, length2, dx2, dy2);

  // Calculation of the coordinates of the circle center by the addition of angular vectors
  const dx = angularPoint.x * 2 - p1Cross.x - p2Cross.x;
  const dy = angularPoint.y * 2 - p1Cross.y - p2Cross.y;

  const L = getLength(dx, dy);
  const d = getLength(segment, radius);

  const circlePoint = getProportionPoint(angularPoint.x, angularPoint.y, d, L, dx, dy);

  // StartAngle and EndAngle of arc
  let startAngle = Math.atan2(p1Cross.y - circlePoint.y, p1Cross.x - circlePoint.x);
  const endAngle = Math.atan2(p2Cross.y - circlePoint.y, p2Cross.x - circlePoint.x);

  // Sweep angle
  let sweepAngle = endAngle - startAngle;

  // Some additional checks
  if (sweepAngle < 0) {
    sweepAngle = 2 * Math.PI + sweepAngle;
  }

  // Draw the arc
  ctx.arc(circlePoint.x, circlePoint.y, radius, startAngle, startAngle + sweepAngle);
}

export function HexagonCanvas({
  width,
  height,
  hexSize,
  availableLocations,
  occupiedLocations,
  selectedLocation,
  onHexClick,
}: HexagonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Canvas offset for panning
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Mouse down handler to start dragging
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    // Stop propagation to prevent drawer from closing
    event.stopPropagation();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Get mouse position relative to canvas
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setIsDragging(true);
    setDragStart({ x, y });
  };

  // Mouse move handler for dragging
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !canvasRef.current) return;

    // Stop propagation when dragging
    event.stopPropagation();
    event.preventDefault();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Get mouse position relative to canvas
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Calculate the drag distance
    const dx = x - dragStart.x;
    const dy = y - dragStart.y;

    // Update offset and drag start position
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setDragStart({ x, y });
  };

  // Mouse up and leave handlers to stop dragging
  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      event.stopPropagation();
      event.preventDefault();
    }
    setIsDragging(false);
  };

  const handleMouseLeave = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      event.stopPropagation();
    }
    setIsDragging(false);
  };

  // Touch event handlers for mobile
  const handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || event.touches.length !== 1) return;

    // Stop propagation to prevent drawer from closing
    event.stopPropagation();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];

    // Get touch position relative to canvas
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    setIsDragging(true);
    setDragStart({ x, y });
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || !canvasRef.current || event.touches.length !== 1) return;

    // Stop propagation and prevent default scrolling behavior
    event.stopPropagation();
    event.preventDefault();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];

    // Get touch position relative to canvas
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Calculate the drag distance
    const dx = x - dragStart.x;
    const dy = y - dragStart.y;

    // Update offset and drag start position
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setDragStart({ x, y });
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      event.stopPropagation();
    }
    setIsDragging(false);
  };

  // Click handler for the canvas
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // If we were dragging, don't register a click
    if (isDragging) {
      event.stopPropagation();
      return;
    }

    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Get click position relative to canvas
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    console.log(`Canvas clicked at x=${x}, y=${y}`);

    // Convert pixel position to hex coordinates
    // Adjust for canvas center and offset
    const adjustedX = x - width / 2 - offset.x;
    const adjustedY = y - height / 2 - offset.y;

    const hex = pixelToHex(adjustedX, adjustedY, hexSize);
    console.log(`Converted to hex: col=${hex.col}, row=${hex.row}`);

    // Check if the clicked hex is available
    const isAvailable = availableLocations.some((loc) => loc.col === hex.col && loc.row === hex.row);

    console.log(`Is hex available: ${isAvailable}`);

    if (isAvailable) {
      onHexClick(hex.col, hex.row);
    }
  };

  // Draw the hexagon grid
  const drawHexGrid = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Center the grid and apply offset
    ctx.translate(width / 2 + offset.x, height / 2 + offset.y);

    // Draw available hexagons
    availableLocations.forEach((hex) => {
      const isSelected =
        selectedLocation !== null && hex.col === selectedLocation.col && hex.row === selectedLocation.row;

      const isOccupied = occupiedLocations.some((loc) => loc.col === hex.col && loc.row === hex.row);

      drawRoundedHexagon(ctx, hex, hexSize, isSelected, isOccupied);
    });

    // Reset transformation
    ctx.resetTransform();

    // Draw drag indicator when dragging
    if (isDragging) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
      ctx.fillRect(0, 0, 60, 30);
      ctx.fillStyle = "#fff";
      ctx.font = "12px Arial";
      ctx.fillText("Dragging", 30, 20);
    }
  };

  // Draw a single rounded hexagon
  const drawRoundedHexagon = (
    ctx: CanvasRenderingContext2D,
    hex: HexLocation,
    size: number,
    isSelected: boolean,
    isOccupied: boolean,
  ) => {
    const { x, y } = hexToPixel(hex, size);
    const cornerRadius = size * 0.25; // Same ratio as in hexagon-geometry.ts

    // Apply a scale factor to create gaps between hexagons
    const gapScale = 0.975; // Reduce hexagon to 85% of its size to create gaps
    const effectiveSize = size * gapScale;

    // Generate hexagon corner points with the reduced size
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = ((2 * Math.PI) / 6) * i;
      const hx = x + effectiveSize * Math.cos(angle);
      const hy = y + effectiveSize * Math.sin(angle);
      points.push({ x: hx, y: hy });
    }

    // Start a new path
    ctx.beginPath();

    // Draw rounded hexagon
    for (let i = 0; i < points.length; i++) {
      const p1Index = i === 0 ? points.length - 1 : i - 1;
      const p2Index = (i + 1) % points.length;

      getOneRoundedCorner(ctx, points[i], points[p1Index], points[p2Index], cornerRadius, 5);
    }

    ctx.closePath();

    // Set fill color based on state
    if (isSelected) {
      // Pulse animation for selected hexagon
      const pulseValue = getPulseAnimation();
      // Fantasy-themed emerald/jade green with slight glow effect
      const green = Math.floor(120 + pulseValue * 100); // Vibrant green base
      const red = Math.floor(20 + pulseValue * 30); // Minimal red for richness
      const blue = Math.floor(80 + pulseValue * 60); // Blue component for magical feel
      ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;

      // Add a subtle glow effect for selected hexagons
      ctx.shadowColor = `rgba(0, 255, 180, 0.6)`;
      ctx.shadowBlur = 10;
    } else if (isOccupied) {
      ctx.fillStyle = "#ff5555"; // Red for occupied
      ctx.shadowBlur = 0; // Reset shadow
    } else {
      ctx.fillStyle = "#aaaaaa"; // Grey for available
      ctx.shadowBlur = 0; // Reset shadow
    }

    ctx.fill();

    // Reset shadow for border drawing
    ctx.shadowBlur = 0;

    // Draw border
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw coordinates inside hexagon
    ctx.fillStyle = "#ffffff";
    ctx.font = `${size / 4}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${hex.col},${hex.row}`, x, y);
  };

  // Animation loop
  const animate = () => {
    drawHexGrid();
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Setup and cleanup
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableLocations, occupiedLocations, selectedLocation, width, height, hexSize, offset, isDragging]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`border border-gray-300 rounded-md ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ touchAction: "none" }}
    />
  );
}
