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
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);

  // Click handler for the canvas
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Get click position relative to canvas
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    console.log(`Canvas clicked at x=${x}, y=${y}`);

    // Convert pixel position to hex coordinates
    // Adjust for canvas center
    const adjustedX = x - width / 2;
    const adjustedY = y - height / 2;

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

    // Center the grid
    ctx.translate(width / 2, height / 2);

    // Draw available hexagons
    availableLocations.forEach((hex) => {
      const isSelected =
        selectedLocation !== null && hex.col === selectedLocation.col && hex.row === selectedLocation.row;

      const isOccupied = occupiedLocations.some((loc) => loc.col === hex.col && loc.row === hex.row);

      drawHexagon(ctx, hex, hexSize, isSelected, isOccupied);
    });

    // Reset transformation
    ctx.resetTransform();
  };

  // Draw a single hexagon
  const drawHexagon = (
    ctx: CanvasRenderingContext2D,
    hex: HexLocation,
    size: number,
    isSelected: boolean,
    isOccupied: boolean,
  ) => {
    const { x, y } = hexToPixel(hex, size);

    // Start a new path
    ctx.beginPath();

    // Draw hexagon
    for (let i = 0; i < 6; i++) {
      const angle = ((2 * Math.PI) / 6) * i;
      const hx = x + size * Math.cos(angle);
      const hy = y + size * Math.sin(angle);

      if (i === 0) {
        ctx.moveTo(hx, hy);
      } else {
        ctx.lineTo(hx, hy);
      }
    }

    ctx.closePath();

    // Set fill color based on state
    if (isSelected) {
      // Pulse animation for selected hexagon
      const pulseValue = getPulseAnimation();
      const green = Math.floor(100 + pulseValue * 155); // Pulsing from darker to lighter green
      ctx.fillStyle = `rgb(0, ${green}, 0)`;
    } else if (isOccupied) {
      ctx.fillStyle = "#ff5555"; // Red for occupied
    } else {
      ctx.fillStyle = "#aaaaaa"; // Grey for available
    }

    ctx.fill();

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
    const frame = requestAnimationFrame(animate);
    setAnimationFrame(frame);
  };

  // Setup and cleanup
  useEffect(() => {
    animate();

    return () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableLocations, occupiedLocations, selectedLocation, width, height, hexSize]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleCanvasClick}
      className="border border-gray-300 rounded-md touch-action-manipulation"
      style={{ touchAction: "manipulation" }}
    />
  );
}
